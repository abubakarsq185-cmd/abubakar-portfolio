import 'server-only';
/**
 * Platform console: GymGuide's own view across the gyms that pay for it.
 *
 * Everything here runs as the owner connection because a platform admin sits
 * outside every tenant, so row-level security has nothing to scope by. That
 * makes this the most privileged code in the application, and it is deliberately
 * narrow: aggregate figures about tenants and their subscriptions, and the
 * support-access ledger. It reads no member health data, no progress photos and
 * no private notes, and there is no code path here that could.
 *
 * Support access to a tenant is time-limited, needs a written reason, and is
 * recorded before it begins. There is no silent impersonation.
 */
import type { Actor } from '@gymguide/types';
import { withOwner } from '../db/pool';
import { recordAudit } from '../audit';

export interface TenantRow {
  organizationId: string;
  displayName: string;
  slug: string;
  countryCode: string;
  currency: string;
  whiteLabel: boolean;
  branches: number;
  activeMembers: number;
  staffAccounts: number;
  planName: string | null;
  billingInterval: string | null;
  subscriptionState: string | null;
  currentPeriodEnd: string | null;
  memberLimit: number | null;
  seatsPurchased: number | null;
  monthlyPriceMinor: number | null;
  outstandingPlatformMinor: number;
  createdAt: string;
}

export interface SupportSessionRow {
  id: string;
  organizationName: string;
  platformUserName: string;
  reason: string;
  ticketReference: string | null;
  scope: string;
  approvedByOrg: boolean;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  actionsTaken: number;
  active: boolean;
}

export interface PlatformOverview {
  tenants: TenantRow[];
  totals: {
    tenants: number;
    branches: number;
    activeMembers: number;
    mrrMinor: number;
    outstandingMinor: number;
    overLimitTenants: number;
  };
  plans: Array<{
    code: string;
    name: string;
    monthlyPriceMinor: number;
    annualPriceMinor: number;
    includedBranches: number;
    includedMembers: number;
    includedStaffSeats: number;
    whiteLabel: boolean;
    tenants: number;
  }>;
  supportSessions: SupportSessionRow[];
  errorSummary: Array<{ day: string; count: number; topMessage: string | null }>;
  jobQueue: Array<{ state: string; count: number }>;
}

export async function loadPlatformOverview(): Promise<PlatformOverview> {
  return withOwner(async (db) => {
    const [tenants, plans, support, errors, jobs] = await Promise.all([
      db.query<{
        organization_id: string;
        display_name: string;
        slug: string;
        country_code: string;
        default_currency: string;
        white_label: boolean;
        branches: string;
        active_members: string;
        staff_accounts: string;
        plan_name: string | null;
        billing_interval: string | null;
        subscription_state: string | null;
        current_period_end: string | null;
        active_member_limit: number | null;
        seats_purchased: number | null;
        monthly_price_minor: string | null;
        outstanding_minor: string;
        created_at: string;
      }>(
        `select o.id as organization_id, o.display_name, o.slug, o.country_code, o.default_currency,
                o.white_label, o.created_at,
                (select count(*) from branches b where b.organization_id = o.id and b.deleted_at is null) as branches,
                (select count(*) from member_profiles mp
                  where mp.organization_id = o.id and mp.lifecycle_stage = 'active' and mp.deleted_at is null) as active_members,
                (select count(distinct sa.user_id) from staff_assignments sa
                  where sa.organization_id = o.id and (sa.ends_on is null or sa.ends_on >= current_date)) as staff_accounts,
                sp.name as plan_name, sp.monthly_price_minor,
                os.billing_interval::text as billing_interval, os.state::text as subscription_state,
                os.current_period_end, os.active_member_limit, os.seats_purchased,
                coalesce((select sum(pi.total_minor - pi.amount_paid_minor) from platform_invoices pi
                           where pi.organization_id = o.id and pi.state in ('open','partially_paid')), 0) as outstanding_minor
           from organizations o
           left join organization_subscriptions os on os.organization_id = o.id
           left join subscription_plans sp on sp.id = os.subscription_plan_id
          where o.deleted_at is null
          order by o.display_name`,
      ),

      db.query<{
        code: string;
        name: string;
        monthly_price_minor: string;
        annual_price_minor: string;
        included_branches: number;
        included_members: number;
        included_staff_seats: number;
        white_label: boolean;
        tenants: string;
      }>(
        `select sp.code, sp.name, sp.monthly_price_minor, sp.annual_price_minor,
                sp.included_branches, sp.included_members, sp.included_staff_seats, sp.white_label,
                (select count(*) from organization_subscriptions os where os.subscription_plan_id = sp.id) as tenants
           from subscription_plans sp order by sp.sort_order, sp.monthly_price_minor`,
      ),

      db.query<{
        id: string;
        organization_name: string;
        platform_user_name: string;
        reason: string;
        ticket_reference: string | null;
        scope: string;
        approved_by_org: boolean;
        started_at: string;
        expires_at: string;
        ended_at: string | null;
        actions_taken: number;
        active: boolean;
      }>(
        `select sas.id, o.display_name as organization_name, u.full_name as platform_user_name,
                sas.reason, sas.ticket_reference, sas.scope, sas.approved_by_org,
                sas.started_at, sas.expires_at, sas.ended_at, sas.actions_taken,
                (sas.ended_at is null and sas.expires_at > now()) as active
           from support_access_sessions sas
           join organizations o on o.id = sas.organization_id
           join users u on u.id = sas.platform_user_id
          order by sas.started_at desc limit 25`,
      ),

      db.query<{ day: string; count: string; top_message: string | null }>(
        `select occurred_at::date::text as day, count(*) as count,
                (array_agg(message order by occurred_at desc))[1] as top_message
           from error_events
          where occurred_at >= now() - interval '14 days'
          group by 1 order by 1 desc`,
      ),

      db.query<{ state: string; count: string }>(
        `select state, count(*) as count from job_queue group by state order by state`,
      ),
    ]);

    const tenantRows: TenantRow[] = tenants.rows.map((row) => ({
      organizationId: row.organization_id,
      displayName: row.display_name,
      slug: row.slug,
      countryCode: row.country_code,
      currency: row.default_currency,
      whiteLabel: row.white_label,
      branches: Number(row.branches),
      activeMembers: Number(row.active_members),
      staffAccounts: Number(row.staff_accounts),
      planName: row.plan_name,
      billingInterval: row.billing_interval,
      subscriptionState: row.subscription_state,
      currentPeriodEnd: row.current_period_end,
      memberLimit: row.active_member_limit,
      seatsPurchased: row.seats_purchased,
      monthlyPriceMinor: row.monthly_price_minor === null ? null : Number(row.monthly_price_minor),
      outstandingPlatformMinor: Number(row.outstanding_minor),
      createdAt: row.created_at,
    }));

    return {
      tenants: tenantRows,
      totals: {
        tenants: tenantRows.length,
        branches: tenantRows.reduce((sum, row) => sum + row.branches, 0),
        activeMembers: tenantRows.reduce((sum, row) => sum + row.activeMembers, 0),
        // Annual subscriptions are divided out so the figure is comparable
        // month to month rather than spiking when someone pays for a year.
        mrrMinor: tenantRows.reduce((sum, row) => {
          if (row.subscriptionState !== 'active' || row.monthlyPriceMinor === null) return sum;
          return sum + row.monthlyPriceMinor;
        }, 0),
        outstandingMinor: tenantRows.reduce((sum, row) => sum + row.outstandingPlatformMinor, 0),
        overLimitTenants: tenantRows.filter(
          (row) => row.memberLimit !== null && row.activeMembers > row.memberLimit,
        ).length,
      },
      plans: plans.rows.map((row) => ({
        code: row.code,
        name: row.name,
        monthlyPriceMinor: Number(row.monthly_price_minor),
        annualPriceMinor: Number(row.annual_price_minor),
        includedBranches: row.included_branches,
        includedMembers: row.included_members,
        includedStaffSeats: row.included_staff_seats,
        whiteLabel: row.white_label,
        tenants: Number(row.tenants),
      })),
      supportSessions: support.rows.map((row) => ({
        id: row.id,
        organizationName: row.organization_name,
        platformUserName: row.platform_user_name,
        reason: row.reason,
        ticketReference: row.ticket_reference,
        scope: row.scope,
        approvedByOrg: row.approved_by_org,
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        endedAt: row.ended_at,
        actionsTaken: row.actions_taken,
        active: row.active,
      })),
      errorSummary: errors.rows.map((row) => ({
        day: row.day,
        count: Number(row.count),
        topMessage: row.top_message,
      })),
      jobQueue: jobs.rows.map((row) => ({ state: row.state, count: Number(row.count) })),
    };
  });
}

export interface OpenSupportAccessInput {
  organizationId: string;
  reason: string;
  ticketReference?: string;
  scope: 'read_only' | 'read_write';
  hours: number;
}

/**
 * Open a support-access session against a tenant.
 *
 * Three things are non-negotiable, and all three are enforced here rather than
 * left to the interface: a written reason of real length, an expiry, and an
 * audit record written against the tenant's own trail so the gym can see that
 * the platform looked. Write access additionally requires the gym to have
 * agreed — support cannot grant itself the ability to change a customer's data.
 */
export async function openSupportAccess(
  actor: Actor,
  input: OpenSupportAccessInput,
): Promise<{ ok: boolean; message: string; sessionId?: string }> {
  if (!actor.isPlatformAdmin) {
    return { ok: false, message: 'Only platform staff can open a support session.' };
  }
  const reason = input.reason.trim();
  // The same minimum the database enforces; checked here so the person gets a
  // sentence instead of a constraint violation.
  if (reason.length < 12) {
    return { ok: false, message: 'Give a real reason of at least 12 characters. It is shown to the gym.' };
  }
  const hours = Math.min(Math.max(Math.round(input.hours), 1), 24);

  try {
    const sessionId = await withOwner(async (db) => {
      if (input.scope === 'read_write') {
        const { rows } = await db.query<{ approved: boolean }>(
          `select exists (
             select 1 from support_access_sessions
              where organization_id = $1 and approved_by_org and expires_at > now()
           ) as approved`,
          [input.organizationId],
        );
        if (!rows[0]?.approved) {
          throw new Error(
            'Write access needs the gym to approve it first. Ask the owner to grant it, then reopen this session.',
          );
        }
      }

      const { rows } = await db.query<{ id: string }>(
        `insert into support_access_sessions
           (organization_id, platform_user_id, reason, ticket_reference, scope, expires_at)
         values ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))
         returning id`,
        [input.organizationId, actor.userId, reason, input.ticketReference?.trim() || null, input.scope, hours],
      );
      return rows[0]!.id;
    });

    // Written against the tenant's audit trail, not the platform's: the gym is
    // the party entitled to know that someone outside it looked at their data.
    await recordAudit({
      organizationId: input.organizationId,
      actorUserId: actor.userId,
      actorRole: 'platform_super_admin',
      action: 'impersonate_start',
      entityType: 'support_access_session',
      entityId: sessionId,
      summary: `Platform support (${actor.fullName}) opened ${input.scope.replace('_', ' ')} access for ${hours}h`,
      reason,
    });

    return {
      ok: true,
      sessionId,
      message: `Support session open for ${hours} hour${hours === 1 ? '' : 's'}. The gym can see it in their audit trail.`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not open a support session.' };
  }
}

export async function endSupportAccess(actor: Actor, sessionId: string): Promise<{ ok: boolean; message: string }> {
  if (!actor.isPlatformAdmin) {
    return { ok: false, message: 'Only platform staff can end a support session.' };
  }

  const ended = await withOwner(async (db) => {
    const { rows } = await db.query<{ organization_id: string; actions_taken: number }>(
      `update support_access_sessions set ended_at = now()
        where id = $1 and ended_at is null
        returning organization_id, actions_taken`,
      [sessionId],
    );
    return rows[0] ?? null;
  });

  if (!ended) return { ok: false, message: 'That session has already ended.' };

  await recordAudit({
    organizationId: ended.organization_id,
    actorUserId: actor.userId,
    actorRole: 'platform_super_admin',
    action: 'impersonate_end',
    entityType: 'support_access_session',
    entityId: sessionId,
    summary: `Platform support (${actor.fullName}) closed the session after ${ended.actions_taken} action(s)`,
  });

  return { ok: true, message: 'Session closed.' };
}
