import 'server-only';
/**
 * Automation authoring.
 *
 * These are messages sent to real people who did not ask to be messaged today.
 * The constraints exist to stop a gym turning its own members against it:
 *
 *   • Marketing needs opt-in, and that is not a checkbox a manager can clear.
 *     Whether a trigger is marketing is a property of the trigger, not a
 *     setting — "birthday" is marketing however it is dressed up.
 *   • Quiet hours are honoured for anything that is not an escalation. Nobody
 *     needs a nudge about a missed workout at half past two in the morning.
 *   • There is a ceiling on how often any one member can be contacted, and
 *     lowering it is always allowed while raising it past the cap is not.
 *
 * A channel that has no working provider can be selected, but the interface
 * says so plainly rather than pretending the message will arrive.
 */
import type { Actor, NotificationChannel, RoleCode } from '@gymguide/types';
import { can } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant } from '../db/pool';
import { recordAudit } from '../audit';
import { availableNotificationChannels } from '../adapters/notifications';

export const TRIGGER_KINDS = [
  'member_enrolled',
  'onboarding_incomplete',
  'trial_ending',
  'workout_missed',
  'inactive_7_days',
  'inactive_14_days',
  'payment_due',
  'payment_failed',
  'membership_expiring',
  'birthday',
  'workout_milestone',
  'checkin_missing',
  'class_waitlist_promoted',
  'escalation_raised',
  'manual',
] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

export const TRIGGER_LABELS: Record<TriggerKind, string> = {
  member_enrolled: 'A member joins',
  onboarding_incomplete: 'Onboarding left unfinished',
  trial_ending: 'A trial is about to end',
  workout_missed: 'A scheduled workout was missed',
  inactive_7_days: 'Not seen for 7 days',
  inactive_14_days: 'Not seen for 14 days',
  payment_due: 'A payment is due',
  payment_failed: 'A payment failed',
  membership_expiring: 'A membership is about to expire',
  birthday: 'A member’s birthday',
  workout_milestone: 'A training milestone reached',
  checkin_missing: 'A weekly check-in was not submitted',
  class_waitlist_promoted: 'A waitlist place came free',
  escalation_raised: 'A health escalation was raised',
  manual: 'Sent by staff by hand',
};

/**
 * Triggers that exist to sell rather than to serve.
 *
 * Marked here rather than left to a per-automation flag so a manager cannot
 * reclassify a marketing message as operational to escape consent.
 */
const MARKETING_TRIGGERS = new Set<TriggerKind>(['birthday', 'trial_ending', 'workout_milestone']);

/** Never delayed. A health escalation at 3am is exactly when it matters. */
const URGENT_TRIGGERS = new Set<TriggerKind>(['escalation_raised', 'class_waitlist_promoted', 'payment_failed']);

/** The most any one member may be contacted in a week by a single automation. */
export const MAX_PER_MEMBER_PER_WEEK_CAP = 5;

export interface AutomationRow {
  automationId: string;
  key: string;
  name: string;
  description: string | null;
  triggerKind: TriggerKind;
  audience: string;
  channels: NotificationChannel[];
  templateKey: string;
  requiresOptIn: boolean;
  respectQuietHours: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxPerMemberPerWeek: number;
  cooldownHours: number;
  createsStaffTask: boolean;
  taskAssigneeRole: RoleCode | null;
  isActive: boolean;
  isMarketing: boolean;
  isUrgent: boolean;
  /** Selected channels with no working provider configured. */
  unavailableChannels: NotificationChannel[];
  stats: { sent: number; skipped: number; failed: number; lastRanAt: string | null };
}

export async function listAutomations(actor: Actor): Promise<AutomationRow[]> {
  const session = tenantSessionFor(actor);
  // Only the channels that can actually deliver. Built from every channel this
  // would silently never flag anything, and the "logged only" warning that the
  // whole point of this field is to raise would never appear.
  const deliverable = new Set(
    availableNotificationChannels()
      .filter((channel) => channel.ready)
      .map((channel) => channel.channel),
  );

  return withTenant(session, async (db) => {
    const { rows } = await db.query<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      trigger_kind: TriggerKind;
      audience: string;
      channels: NotificationChannel[];
      template_key: string;
      requires_opt_in: boolean;
      respect_quiet_hours: boolean;
      quiet_hours_start: string;
      quiet_hours_end: string;
      max_per_member_per_week: number;
      cooldown_hours: number;
      creates_staff_task: boolean;
      task_assignee_role: RoleCode | null;
      is_active: boolean;
      sent: string;
      skipped: string;
      failed: string;
      last_ran_at: string | null;
    }>(
      // channels is a notification_channel[]. node-postgres has no parser for
      // arrays of a custom enum, so it would arrive as the literal string
      // "{in_app,push}"; casting to text[] gets a real array back.
      `select a.id, a.key, a.name, a.description, a.trigger_kind, a.audience,
              a.channels::text[] as channels,
              a.template_key, a.requires_opt_in, a.respect_quiet_hours,
              a.quiet_hours_start::text as quiet_hours_start, a.quiet_hours_end::text as quiet_hours_end,
              a.max_per_member_per_week, a.cooldown_hours, a.creates_staff_task,
              a.task_assignee_role, a.is_active,
              coalesce(r.sent, 0) as sent, coalesce(r.skipped, 0) as skipped,
              coalesce(r.failed, 0) as failed, r.last_ran_at::text as last_ran_at
         from automations a
         left join lateral (
           select count(*) filter (where state = 'sent')    as sent,
                  count(*) filter (where state = 'skipped') as skipped,
                  count(*) filter (where state = 'failed')  as failed,
                  max(ran_at)                               as last_ran_at
             from automation_runs ar where ar.automation_id = a.id
         ) r on true
        order by a.is_active desc, a.name`,
    );

    return rows.map((row) => ({
      automationId: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      triggerKind: row.trigger_kind,
      audience: row.audience,
      channels: row.channels ?? [],
      templateKey: row.template_key,
      requiresOptIn: row.requires_opt_in,
      respectQuietHours: row.respect_quiet_hours,
      quietHoursStart: row.quiet_hours_start.slice(0, 5),
      quietHoursEnd: row.quiet_hours_end.slice(0, 5),
      maxPerMemberPerWeek: row.max_per_member_per_week,
      cooldownHours: row.cooldown_hours,
      createsStaffTask: row.creates_staff_task,
      taskAssigneeRole: row.task_assignee_role,
      isActive: row.is_active,
      isMarketing: MARKETING_TRIGGERS.has(row.trigger_kind),
      isUrgent: URGENT_TRIGGERS.has(row.trigger_kind),
      unavailableChannels: (row.channels ?? []).filter((channel) => !deliverable.has(channel)),
      stats: {
        sent: Number(row.sent),
        skipped: Number(row.skipped),
        failed: Number(row.failed),
        lastRanAt: row.last_ran_at,
      },
    }));
  });
}

export interface AutomationEdits {
  name: string;
  description: string;
  channels: NotificationChannel[];
  respectQuietHours: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxPerMemberPerWeek: number;
  cooldownHours: number;
  createsStaffTask: boolean;
  taskAssigneeRole: RoleCode | null;
  isActive: boolean;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function updateAutomation(
  actor: Actor,
  automationId: string,
  edits: AutomationEdits,
): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'automations.write')) {
    return { ok: false, message: 'You do not have permission to change automations.' };
  }
  if (edits.name.trim().length < 3) {
    return { ok: false, message: 'Give the automation a name staff will recognise.' };
  }
  if (edits.channels.length === 0) {
    return { ok: false, message: 'Choose at least one channel, or switch the automation off instead.' };
  }
  if (!TIME_PATTERN.test(edits.quietHoursStart) || !TIME_PATTERN.test(edits.quietHoursEnd)) {
    return { ok: false, message: 'Quiet hours need a time like 21:30.' };
  }
  if (edits.maxPerMemberPerWeek < 1 || edits.maxPerMemberPerWeek > MAX_PER_MEMBER_PER_WEEK_CAP) {
    return {
      ok: false,
      message: `A member may be contacted at most ${MAX_PER_MEMBER_PER_WEEK_CAP} times a week by one automation. Lower is always fine.`,
    };
  }
  if (edits.cooldownHours < 1 || edits.cooldownHours > 24 * 30) {
    return { ok: false, message: 'The cooldown must be between an hour and a month.' };
  }
  if (edits.createsStaffTask && !edits.taskAssigneeRole) {
    return { ok: false, message: 'Say which role picks the task up, or it lands on nobody.' };
  }

  const session = tenantSessionFor(actor);
  try {
    const context = await withTenant(session, async (db) => {
      const { rows } = await db.query<{ name: string; trigger_kind: TriggerKind; is_active: boolean }>(
        'select name, trigger_kind, is_active from automations where id = $1',
        [automationId],
      );
      const automation = rows[0];
      if (!automation) throw new Error('That automation is not visible to you.');

      const marketing = MARKETING_TRIGGERS.has(automation.trigger_kind);
      const urgent = URGENT_TRIGGERS.has(automation.trigger_kind);

      // Two things a manager does not get to decide. Consent for marketing is
      // the member's, and an escalation is not something to sit on until 7am.
      const requiresOptIn = marketing ? true : undefined;
      const respectQuietHours = urgent ? false : edits.respectQuietHours;

      await db.query(
        `update automations
            set name = $2, description = $3, channels = $4::notification_channel[],
                respect_quiet_hours = $5, quiet_hours_start = $6::time, quiet_hours_end = $7::time,
                max_per_member_per_week = $8, cooldown_hours = $9, creates_staff_task = $10,
                task_assignee_role = $11::role_code, is_active = $12,
                requires_opt_in = coalesce($13, requires_opt_in), updated_at = now()
          where id = $1`,
        [
          automationId,
          edits.name.trim(),
          edits.description.trim() || null,
          edits.channels,
          respectQuietHours,
          edits.quietHoursStart,
          edits.quietHoursEnd,
          edits.maxPerMemberPerWeek,
          edits.cooldownHours,
          edits.createsStaffTask,
          edits.taskAssigneeRole,
          edits.isActive,
          requiresOptIn ?? null,
        ],
      );

      return { ...automation, marketing, urgent };
    });

    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'automation',
      entityId: automationId,
      summary: `${actor.fullName} edited the automation "${context.name}"`,
      before: { isActive: context.is_active },
      after: { isActive: edits.isActive, channels: edits.channels },
    });

    const notes: string[] = [];
    if (context.marketing) notes.push('Marketing consent stays required — that is the member’s to give.');
    if (context.urgent) notes.push('Quiet hours do not apply to this trigger; it is urgent by nature.');

    return { ok: true, message: ['Saved.', ...notes].join(' ') };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not save that automation.' };
  }
}

export async function setAutomationActive(
  actor: Actor,
  automationId: string,
  active: boolean,
): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'automations.write')) {
    return { ok: false, message: 'You do not have permission to change automations.' };
  }

  const session = tenantSessionFor(actor);
  try {
    const name = await withTenant(session, async (db) => {
      const { rows } = await db.query<{ name: string }>(
        'update automations set is_active = $2, updated_at = now() where id = $1 returning name',
        [automationId, active],
      );
      if (!rows[0]) throw new Error('That automation is not visible to you.');
      return rows[0].name;
    });

    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'automation',
      entityId: automationId,
      summary: `${actor.fullName} ${active ? 'switched on' : 'switched off'} "${name}"`,
    });

    return { ok: true, message: active ? `"${name}" is on.` : `"${name}" is off. Nothing further will be sent.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not change that automation.' };
  }
}

export interface AutomationActivity {
  totals: { sent: number; skipped: number; failed: number };
  skipReasons: Array<{ reason: string; count: number }>;
  recent: Array<{
    automationName: string;
    memberName: string | null;
    state: string;
    skipReason: string | null;
    ranAt: string;
  }>;
}

/**
 * What the automations actually did.
 *
 * Skip reasons are the useful part: an automation quietly skipping nine out of
 * ten members because they never opted in is a thing a manager should see, not
 * something to discover from a complaint.
 */
export async function loadAutomationActivity(actor: Actor): Promise<AutomationActivity> {
  const session = tenantSessionFor(actor);

  return withTenant(session, async (db) => {
    const [totals, reasons, recent] = await Promise.all([
      db.query<{ sent: string; skipped: string; failed: string }>(
        `select count(*) filter (where state = 'sent')    as sent,
                count(*) filter (where state = 'skipped') as skipped,
                count(*) filter (where state = 'failed')  as failed
           from automation_runs where ran_at >= now() - interval '30 days'`,
      ),
      db.query<{ reason: string; count: string }>(
        `select coalesce(skip_reason, 'unspecified') as reason, count(*) as count
           from automation_runs
          where state = 'skipped' and ran_at >= now() - interval '30 days'
          group by 1 order by count(*) desc limit 8`,
      ),
      db.query<{
        automation_name: string;
        member_name: string | null;
        state: string;
        skip_reason: string | null;
        ran_at: string;
      }>(
        `select a.name as automation_name, u.full_name as member_name,
                ar.state, ar.skip_reason, ar.ran_at::text as ran_at
           from automation_runs ar
           join automations a on a.id = ar.automation_id
           left join users u on u.id = ar.target_user_id
          order by ar.ran_at desc limit 25`,
      ),
    ]);

    return {
      totals: {
        sent: Number(totals.rows[0]?.sent ?? 0),
        skipped: Number(totals.rows[0]?.skipped ?? 0),
        failed: Number(totals.rows[0]?.failed ?? 0),
      },
      skipReasons: reasons.rows.map((row) => ({ reason: row.reason, count: Number(row.count) })),
      recent: recent.rows.map((row) => ({
        automationName: row.automation_name,
        memberName: row.member_name,
        state: row.state,
        skipReason: row.skip_reason,
        ranAt: row.ran_at,
      })),
    };
  });
}
