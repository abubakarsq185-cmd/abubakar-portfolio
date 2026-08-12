import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { permissionsForRoles, type Actor } from '@gymguide/types';
import {
  MAX_PER_MEMBER_PER_WEEK_CAP,
  listAutomations,
  loadAutomationActivity,
  setAutomationActive,
  updateAutomation,
} from '../../apps/web/src/server/services/automations';
import { closePools } from '../../apps/web/src/server/db/pool';
import { ownerClient } from './helpers';

/**
 * Automation authoring.
 *
 * These send messages to people who did not ask to hear from anyone today, so
 * the constraints that stop a gym annoying its own members are the point: a
 * manager cannot escape marketing consent, cannot silence quiet hours on a
 * routine nudge, and cannot raise the contact ceiling.
 */
describe('automation authoring', () => {
  let owner: Client;
  let manager: Actor;
  let coach: Actor;

  /** Every automation's state before the tests, restored afterwards. */
  let snapshot: Array<Record<string, unknown>> = [];

  async function automationByKey(key: string) {
    const automations = await listAutomations(manager);
    const found = automations.find((automation) => automation.key === key);
    if (!found) throw new Error(`No automation seeded with key ${key}`);
    return found;
  }

  function baseEdits(automation: Awaited<ReturnType<typeof automationByKey>>) {
    return {
      name: automation.name,
      description: automation.description ?? '',
      channels: automation.channels,
      respectQuietHours: automation.respectQuietHours,
      quietHoursStart: automation.quietHoursStart,
      quietHoursEnd: automation.quietHoursEnd,
      maxPerMemberPerWeek: automation.maxPerMemberPerWeek,
      cooldownHours: automation.cooldownHours,
      createsStaffTask: automation.createsStaffTask,
      taskAssigneeRole: automation.taskAssigneeRole,
      isActive: automation.isActive,
    };
  }

  beforeAll(async () => {
    owner = await ownerClient();

    const { rows: managerRows } = await owner.query<{ id: string; organization_id: string; branch_id: string }>(
      `select u.id, u.organization_id, sa.branch_id from users u
         join staff_assignments sa on sa.user_id = u.id
        where u.email = 'manager.dha@apexfitness.pk'`,
    );
    manager = {
      userId: managerRows[0]!.id,
      organizationId: managerRows[0]!.organization_id,
      role: 'branch_manager',
      roles: ['branch_manager'],
      permissions: permissionsForRoles(['branch_manager']),
      branchIds: [managerRows[0]!.branch_id],
      isPlatformAdmin: false,
      fullName: 'Sadia Rehman',
      email: 'manager.dha@apexfitness.pk',
    };

    const { rows: coachRows } = await owner.query<{ id: string; branch_id: string }>(
      `select u.id, sa.branch_id from users u join staff_assignments sa on sa.user_id = u.id
        where u.email = 'coach@apexfitness.pk'`,
    );
    coach = {
      userId: coachRows[0]!.id,
      organizationId: manager.organizationId,
      role: 'coach',
      roles: ['coach'],
      permissions: permissionsForRoles(['coach']),
      branchIds: [coachRows[0]!.branch_id],
      isPlatformAdmin: false,
      fullName: 'Hassan Raza',
      email: 'coach@apexfitness.pk',
    };

    const { rows } = await owner.query(`select * from automations`);
    snapshot = rows as Array<Record<string, unknown>>;
  }, 30_000);

  afterAll(async () => {
    for (const row of snapshot) {
      await owner.query(
        `update automations
            set name = $2, description = $3, channels = $4, requires_opt_in = $5,
                respect_quiet_hours = $6, quiet_hours_start = $7, quiet_hours_end = $8,
                max_per_member_per_week = $9, cooldown_hours = $10, creates_staff_task = $11,
                task_assignee_role = $12, is_active = $13
          where id = $1`,
        [
          row.id,
          row.name,
          row.description,
          row.channels,
          row.requires_opt_in,
          row.respect_quiet_hours,
          row.quiet_hours_start,
          row.quiet_hours_end,
          row.max_per_member_per_week,
          row.cooldown_hours,
          row.creates_staff_task,
          row.task_assignee_role,
          row.is_active,
        ],
      );
    }
    await closePools();
    await owner?.end();
  });

  it('lists every automation with what it did and whether its channels can deliver', async () => {
    const automations = await listAutomations(manager);
    expect(automations.length).toBeGreaterThan(5);
    expect(automations.every((automation) => automation.channels.length > 0)).toBe(true);
    // Nothing is configured with live providers in a test environment, so every
    // channel except in_app should be reported as logged-only rather than live.
    const push = automations.find((automation) => automation.channels.includes('push'));
    expect(push?.unavailableChannels).toContain('push');
  });

  it('classifies marketing triggers from the trigger, not from a flag someone can clear', async () => {
    const birthday = await automationByKey('birthday');
    expect(birthday.isMarketing).toBe(true);

    const payment = await automationByKey('payment_due');
    expect(payment.isMarketing).toBe(false);
  });

  it('will not let a manager turn off consent for a marketing automation', async () => {
    const birthday = await automationByKey('birthday');
    await owner.query('update automations set requires_opt_in = false where id = $1', [birthday.automationId]);

    const result = await updateAutomation(manager, birthday.automationId, baseEdits(birthday));
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toMatch(/consent/i);

    const { rows } = await owner.query<{ requires_opt_in: boolean }>(
      'select requires_opt_in from automations where id = $1',
      [birthday.automationId],
    );
    // Forced back on: consent is the member's to give.
    expect(rows[0]!.requires_opt_in).toBe(true);
  });

  it('never holds an urgent trigger for quiet hours, even if asked to', async () => {
    const escalation = await automationByKey('escalation_alert');
    expect(escalation.isUrgent).toBe(true);

    const result = await updateAutomation(manager, escalation.automationId, {
      ...baseEdits(escalation),
      respectQuietHours: true,
    });
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toMatch(/urgent/i);

    const { rows } = await owner.query<{ respect_quiet_hours: boolean }>(
      'select respect_quiet_hours from automations where id = $1',
      [escalation.automationId],
    );
    expect(rows[0]!.respect_quiet_hours).toBe(false);
  });

  it('keeps quiet hours on a routine nudge', async () => {
    const missed = await automationByKey('missed_workout');
    expect(missed.isUrgent).toBe(false);

    const result = await updateAutomation(manager, missed.automationId, {
      ...baseEdits(missed),
      respectQuietHours: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    });
    expect(result.ok, result.message).toBe(true);

    const reloaded = await automationByKey('missed_workout');
    expect(reloaded.respectQuietHours).toBe(true);
    expect(reloaded.quietHoursStart).toBe('22:00');
    expect(reloaded.quietHoursEnd).toBe('08:00');
  });

  it('refuses to raise the contact ceiling past the cap, but allows lowering it', async () => {
    const nudge = await automationByKey('onboarding_nudge');

    const tooMany = await updateAutomation(manager, nudge.automationId, {
      ...baseEdits(nudge),
      maxPerMemberPerWeek: MAX_PER_MEMBER_PER_WEEK_CAP + 3,
    });
    expect(tooMany.ok).toBe(false);
    expect(tooMany.message).toMatch(/at most/i);

    const fewer = await updateAutomation(manager, nudge.automationId, {
      ...baseEdits(nudge),
      maxPerMemberPerWeek: 1,
    });
    expect(fewer.ok, fewer.message).toBe(true);
    expect((await automationByKey('onboarding_nudge')).maxPerMemberPerWeek).toBe(1);
  });

  it('refuses an automation with no channel at all', async () => {
    const nudge = await automationByKey('onboarding_nudge');
    const result = await updateAutomation(manager, nudge.automationId, { ...baseEdits(nudge), channels: [] });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/at least one channel/i);
  });

  it('refuses a malformed quiet-hours time rather than storing something meaningless', async () => {
    const nudge = await automationByKey('onboarding_nudge');
    const result = await updateAutomation(manager, nudge.automationId, {
      ...baseEdits(nudge),
      quietHoursStart: 'half nine',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/21:30|time/i);
  });

  it('will not create a task with nobody to pick it up', async () => {
    const nudge = await automationByKey('onboarding_nudge');
    const result = await updateAutomation(manager, nudge.automationId, {
      ...baseEdits(nudge),
      createsStaffTask: true,
      taskAssigneeRole: null,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/which role/i);
  });

  it('switches an automation off and records who did it', async () => {
    const milestone = await automationByKey('milestone');
    const result = await setAutomationActive(manager, milestone.automationId, false);
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toMatch(/nothing further/i);

    expect((await automationByKey('milestone')).isActive).toBe(false);

    const { rows } = await owner.query<{ count: string }>(
      `select count(*) as count from audit_logs where entity_id = $1 and entity_type = 'automation'`,
      [milestone.automationId],
    );
    expect(Number(rows[0]!.count)).toBeGreaterThan(0);
  });

  it('does not let a coach change automations', async () => {
    expect(coach.permissions).not.toContain('automations.write');
    const nudge = await automationByKey('onboarding_nudge');

    const edit = await updateAutomation(coach, nudge.automationId, baseEdits(nudge));
    expect(edit.ok).toBe(false);
    expect(edit.message).toMatch(/permission/i);

    const toggle = await setAutomationActive(coach, nudge.automationId, false);
    expect(toggle.ok).toBe(false);
    expect(toggle.message).toMatch(/permission/i);
  });

  it('reports what the automations actually did, including why messages were skipped', async () => {
    const activity = await loadAutomationActivity(manager);
    expect(activity.totals.sent + activity.totals.skipped + activity.totals.failed).toBeGreaterThan(0);
    expect(activity.recent.length).toBeGreaterThan(0);
    expect(activity.recent[0]!.automationName).toBeTruthy();
  });
});
