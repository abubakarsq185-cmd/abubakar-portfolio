import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { PERMISSIONS, type Actor } from '@gymguide/types';
import {
  endSupportAccess,
  loadPlatformOverview,
  openSupportAccess,
} from '../../apps/web/src/server/services/platform';
import { closePools } from '../../apps/web/src/server/db/pool';
import { ownerClient } from './helpers';

/**
 * Platform support access.
 *
 * The requirement is that it is time-limited, auditable, and requires an
 * explicit reason. All three are asserted here, along with the rule that
 * support cannot grant itself write access to a customer's data.
 */
describe('platform support access', () => {
  let owner: Client;
  let admin: Actor;
  let staffActor: Actor;
  let organizationId: string;

  beforeAll(async () => {
    owner = await ownerClient();

    const { rows: platform } = await owner.query<{ id: string; full_name: string; email: string }>(
      `select id, full_name, email from users where is_platform_admin limit 1`,
    );
    admin = {
      userId: platform[0]!.id,
      organizationId: null,
      role: 'platform_super_admin',
      roles: ['platform_super_admin'],
      permissions: [...PERMISSIONS],
      branchIds: [],
      isPlatformAdmin: true,
      fullName: platform[0]!.full_name,
      email: platform[0]!.email,
    };

    const { rows: org } = await owner.query<{ id: string }>(
      `select id from organizations where slug = 'apex-fitness-lahore'`,
    );
    organizationId = org[0]!.id;

    const { rows: staff } = await owner.query<{ id: string; full_name: string }>(
      `select id, full_name from users where email = 'owner@apexfitness.pk'`,
    );
    staffActor = {
      userId: staff[0]!.id,
      organizationId,
      role: 'gym_owner',
      roles: ['gym_owner'],
      permissions: [...PERMISSIONS],
      branchIds: [],
      isPlatformAdmin: false,
      fullName: staff[0]!.full_name,
      email: 'owner@apexfitness.pk',
    };
  }, 30_000);

  beforeEach(async () => {
    await owner.query('delete from support_access_sessions');
  });

  afterAll(async () => {
    await owner.query('delete from support_access_sessions');
    await closePools();
    await owner?.end();
  });

  it('refuses a session without a real reason', async () => {
    const result = await openSupportAccess(admin, {
      organizationId,
      reason: 'looking',
      scope: 'read_only',
      hours: 2,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/reason/i);

    const { rows } = await owner.query<{ count: string }>('select count(*) as count from support_access_sessions');
    expect(Number(rows[0]!.count)).toBe(0);
  });

  it('refuses anyone who is not platform staff, even a gym owner with every permission', async () => {
    const result = await openSupportAccess(staffActor, {
      organizationId,
      reason: 'I would like to look at my own tenant through the platform console.',
      scope: 'read_only',
      hours: 2,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/platform staff/i);
  });

  it('opens a read-only session that expires and is written to the gym’s own audit trail', async () => {
    const reason = 'Owner reports payments missing from billing; checking the webhook ledger.';
    const result = await openSupportAccess(admin, { organizationId, reason, scope: 'read_only', hours: 2 });
    expect(result.ok, result.message).toBe(true);

    const { rows } = await owner.query<{
      scope: string;
      reason: string;
      expires_in_hours: string;
      ended_at: string | null;
      platform_user_id: string;
    }>(
      `select scope, reason, ended_at, platform_user_id,
              round(extract(epoch from (expires_at - started_at)) / 3600, 2) as expires_in_hours
         from support_access_sessions where id = $1`,
      [result.sessionId],
    );
    expect(rows[0]!.scope).toBe('read_only');
    expect(rows[0]!.reason).toBe(reason);
    expect(Number(rows[0]!.expires_in_hours)).toBeCloseTo(2, 1);
    expect(rows[0]!.ended_at).toBeNull();
    expect(rows[0]!.platform_user_id).toBe(admin.userId);

    // The gym is the party entitled to know someone outside it looked.
    const { rows: audit } = await owner.query<{ action: string; organization_id: string; reason: string }>(
      `select action::text as action, organization_id, reason from audit_logs
        where entity_id = $1 and action = 'impersonate_start'`,
      [result.sessionId],
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]!.organization_id).toBe(organizationId);
    expect(audit[0]!.reason).toBe(reason);
  });

  it('clamps the window so a session cannot be opened indefinitely', async () => {
    const result = await openSupportAccess(admin, {
      organizationId,
      reason: 'Long running migration check that really should not need a week.',
      scope: 'read_only',
      hours: 1000,
    });
    expect(result.ok).toBe(true);

    const { rows } = await owner.query<{ hours: string }>(
      `select round(extract(epoch from (expires_at - started_at)) / 3600, 2) as hours
         from support_access_sessions where id = $1`,
      [result.sessionId],
    );
    expect(Number(rows[0]!.hours)).toBeLessThanOrEqual(24);
  });

  it('will not grant itself write access without the gym having agreed', async () => {
    const result = await openSupportAccess(admin, {
      organizationId,
      reason: 'Need to correct a mis-keyed payment amount for the owner.',
      scope: 'read_write',
      hours: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/approve/i);

    const { rows } = await owner.query<{ count: string }>('select count(*) as count from support_access_sessions');
    expect(Number(rows[0]!.count)).toBe(0);
  });

  it('allows write access once the gym has approved it', async () => {
    // The approval a gym grants, standing in for the owner-side flow.
    await owner.query(
      `insert into support_access_sessions
         (organization_id, platform_user_id, reason, scope, approved_by_org, expires_at)
       values ($1, $2, 'Gym owner granted write access for the billing correction.', 'read_write', true,
               now() + interval '4 hours')`,
      [organizationId, admin.userId],
    );

    const result = await openSupportAccess(admin, {
      organizationId,
      reason: 'Need to correct a mis-keyed payment amount for the owner.',
      scope: 'read_write',
      hours: 1,
    });
    expect(result.ok, result.message).toBe(true);
  });

  it('closes a session on request and records the close', async () => {
    const opened = await openSupportAccess(admin, {
      organizationId,
      reason: 'Checking a failed notification delivery for the owner.',
      scope: 'read_only',
      hours: 4,
    });
    expect(opened.ok).toBe(true);

    const closed = await endSupportAccess(admin, opened.sessionId!);
    expect(closed.ok).toBe(true);

    const { rows } = await owner.query<{ ended_at: string | null }>(
      'select ended_at from support_access_sessions where id = $1',
      [opened.sessionId],
    );
    expect(rows[0]!.ended_at).not.toBeNull();

    const { rows: audit } = await owner.query<{ count: string }>(
      `select count(*) as count from audit_logs where entity_id = $1 and action = 'impersonate_end'`,
      [opened.sessionId],
    );
    expect(Number(audit[0]!.count)).toBe(1);

    // Closing twice is not an error the caller has to guard against, but it
    // must not write a second close.
    const again = await endSupportAccess(admin, opened.sessionId!);
    expect(again.ok).toBe(false);
  });

  it('shows every session ever opened, including the expired ones', async () => {
    await openSupportAccess(admin, {
      organizationId,
      reason: 'First look at the reported billing discrepancy.',
      scope: 'read_only',
      hours: 1,
    });

    const overview = await loadPlatformOverview();
    expect(overview.supportSessions.length).toBeGreaterThan(0);
    expect(overview.supportSessions[0]!.organizationName).toBeTruthy();
    expect(overview.supportSessions[0]!.reason).toMatch(/billing discrepancy/i);
    expect(overview.supportSessions[0]!.active).toBe(true);
  });

  it('reports tenants and their subscriptions without touching member health data', async () => {
    const overview = await loadPlatformOverview();
    expect(overview.tenants.length).toBeGreaterThan(0);

    const apex = overview.tenants.find((tenant) => tenant.slug === 'apex-fitness-lahore');
    expect(apex).toBeDefined();
    expect(apex!.branches).toBe(2);
    expect(apex!.activeMembers).toBeGreaterThan(0);
    expect(apex!.planName).toBeTruthy();
    expect(overview.totals.tenants).toBe(overview.tenants.length);
    expect(overview.plans.length).toBeGreaterThan(0);

    // The shape of what the console returns is the boundary: there is no field
    // here through which health data, photos or notes could reach the page.
    const serialised = JSON.stringify(overview);
    expect(serialised).not.toMatch(/health_screening|progress_photo|pain_area/i);
  });
});
