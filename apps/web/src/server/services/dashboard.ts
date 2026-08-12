import 'server-only';
/**
 * Staff dashboard queries.
 *
 * Every query runs through withTenant, so what a coach sees is already narrowed
 * by RLS to their caseload and branch — the SQL does not have to remember.
 */
import type { Actor, DashboardMetric, StaffQueueItem } from '@gymguide/types';
import { can } from '@gymguide/types';
import { formatMoney } from '@gymguide/config';
import { tenantSessionFor } from '../auth/session';
import { withTenant } from '../db/pool';

export interface DashboardData {
  metrics: DashboardMetric[];
  queues: {
    escalations: StaffQueueItem[];
    paymentFailures: StaffQueueItem[];
    pendingWaivers: StaffQueueItem[];
    inactiveMembers: StaffQueueItem[];
    coachingReview: StaffQueueItem[];
    newLeads: StaffQueueItem[];
    tasks: StaffQueueItem[];
  };
  todayClasses: Array<{
    id: string;
    name: string;
    startsAt: string;
    coachName: string | null;
    roomName: string | null;
    booked: number;
    capacity: number;
    waitlist: number;
  }>;
  branchPerformance: Array<{
    branchId: string;
    branchName: string;
    activeMembers: number;
    inactiveMembers: number;
    checkInsToday: number;
    collectedThisMonthMinor: number;
    overdueMinor: number;
    openLeads: number;
    classesToday: number;
  }>;
}

export async function loadDashboard(actor: Actor): Promise<DashboardData> {
  const session = tenantSessionFor(actor);
  const showsMoney = can(actor, 'finance.read');
  const showsHealth = can(actor, 'health.read');

  return withTenant(session, async (db) => {
    const [counts, escalations, failures, waivers, inactive, coaching, leads, tasks, classes, branches] =
      await Promise.all([
        db.query<{
          active_members: string;
          check_ins_today: string;
          new_enrolments_7d: string;
          new_leads_7d: string;
          unpaid_minor: string;
          collected_month_minor: string;
          open_cases: string;
          checkins_awaiting: string;
        }>(
          `select
             (select count(*) from member_profiles where lifecycle_stage = 'active' and deleted_at is null) as active_members,
             (select count(*) from attendance where checked_in_at >= current_date) as check_ins_today,
             (select count(*) from member_profiles where joined_on >= current_date - 7) as new_enrolments_7d,
             (select count(*) from leads where created_at >= now() - interval '7 days' and deleted_at is null) as new_leads_7d,
             (select coalesce(sum(total_minor - amount_paid_minor), 0) from invoices where state in ('open','partially_paid')) as unpaid_minor,
             (select coalesce(sum(amount_minor), 0) from payments where state = 'succeeded' and received_at >= date_trunc('month', now())) as collected_month_minor,
             (select count(*) from support_cases where state not in ('resolved','closed')) as open_cases,
             (select count(*) from check_ins where state = 'submitted') as checkins_awaiting`,
        ),

        showsHealth
          ? db.query<{ risk_flag_id: string; member_name: string; kind: string; severity: string; raised_at: string; hours_open: string; case_reference: string | null }>(
              `select risk_flag_id, member_name, kind, severity, raised_at, hours_open, case_reference
                 from escalation_queue order by
                   case severity when 'critical' then 0 when 'high' then 1 when 'moderate' then 2 else 3 end,
                   raised_at asc
                 limit 8`,
            )
          : Promise.resolve({ rows: [], rowCount: 0 }),

        showsMoney
          ? db.query<{ id: string; number: string; full_name: string; balance_minor: string; days_overdue: string; user_id: string }>(
              `select i.id, i.number, u.full_name, (i.total_minor - i.amount_paid_minor) as balance_minor,
                      greatest(0, extract(day from (now() - i.due_at))::int) as days_overdue, i.user_id
                 from invoices i join users u on u.id = i.user_id
                where i.state in ('open','partially_paid') and i.due_at < now()
                order by i.due_at asc limit 8`,
            )
          : Promise.resolve({ rows: [], rowCount: 0 }),

        db.query<{ id: string; full_name: string; user_id: string; created_at: string }>(
          `select w.id, u.full_name, w.user_id, w.created_at
             from waivers w join users u on u.id = w.user_id
            where w.signed_at is null order by w.created_at desc limit 8`,
        ),

        db.query<{ user_id: string; full_name: string; days: string; risk: string }>(
          `select mp.user_id, u.full_name,
                  coalesce(extract(day from (now() - mp.last_workout_at))::int, 999) as days,
                  mp.inactivity_risk_score as risk
             from member_profiles mp join users u on u.id = mp.user_id
            where mp.lifecycle_stage = 'active' and mp.deleted_at is null
              and (mp.last_workout_at is null or mp.last_workout_at < now() - interval '10 days')
            order by mp.last_workout_at asc nulls first limit 8`,
        ),

        db.query<{ id: string; user_id: string; full_name: string; kind: string; rule_id: string; created_at: string }>(
          `select cr.id, cr.user_id, u.full_name, cr.kind, cr.rule_id, cr.created_at
             from coaching_recommendations cr join users u on u.id = cr.user_id
            where cr.state = 'proposed'
            order by cr.created_at asc limit 8`,
        ),

        db.query<{ id: string; full_name: string; status: string; source: string; created_at: string }>(
          `select id, full_name, status, source, created_at from leads
            where status in ('new','contacted','trial_booked') and deleted_at is null
            order by created_at desc limit 8`,
        ),

        db.query<{ id: string; title: string; priority: string; due_at: string | null; member_user_id: string | null }>(
          `select id, title, priority, due_at, member_user_id from tasks
            where completed_at is null
            order by case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
                     due_at asc nulls last
            limit 8`,
        ),

        db.query<{ id: string; name: string; starts_at: string; coach_name: string | null; room_name: string | null; booked_count: number; capacity: number; waitlist_count: number }>(
          `select cs.id, c.name, cs.starts_at, u.full_name as coach_name, r.name as room_name,
                  cs.booked_count, cs.capacity, cs.waitlist_count
             from class_sessions cs
             join classes c on c.id = cs.class_id
             left join users u on u.id = cs.coach_id
             left join rooms r on r.id = cs.room_id
            where cs.starts_at::date = current_date and cs.state = 'scheduled'
            order by cs.starts_at asc`,
        ),

        db.query<{
          branch_id: string; branch_name: string; active_members: string; inactive_members: string;
          check_ins_today: string; collected_this_month_minor: string; overdue_minor: string;
          open_leads: string; classes_today: string;
        }>('select * from branch_performance order by branch_name'),
      ]);

    const c = counts.rows[0]!;
    const metrics: DashboardMetric[] = [
      {
        key: 'active_members',
        label: 'Active members',
        value: Number(c.active_members),
        formatted: String(c.active_members),
        delta: Number(c.new_enrolments_7d),
        deltaLabel: `${c.new_enrolments_7d} joined this week`,
        tone: 'positive',
        href: '/dashboard/members',
      },
      {
        key: 'check_ins_today',
        label: 'Check-ins today',
        value: Number(c.check_ins_today),
        formatted: String(c.check_ins_today),
        delta: null,
        deltaLabel: null,
        tone: 'neutral',
        href: '/dashboard/attendance',
      },
      {
        key: 'new_leads',
        label: 'New leads (7 days)',
        value: Number(c.new_leads_7d),
        formatted: String(c.new_leads_7d),
        delta: null,
        deltaLabel: `${leads.rows.length} awaiting follow-up`,
        tone: leads.rows.length > 4 ? 'warning' : 'neutral',
        href: '/dashboard/leads',
      },
      {
        key: 'checkins_awaiting',
        label: 'Check-ins to review',
        value: Number(c.checkins_awaiting),
        formatted: String(c.checkins_awaiting),
        delta: null,
        deltaLabel: null,
        tone: Number(c.checkins_awaiting) > 0 ? 'warning' : 'neutral',
        href: '/dashboard/coaching',
      },
      {
        key: 'open_cases',
        label: 'Open support cases',
        value: Number(c.open_cases),
        formatted: String(c.open_cases),
        delta: null,
        deltaLabel: null,
        tone: Number(c.open_cases) > 3 ? 'warning' : 'neutral',
        href: '/dashboard/support',
      },
    ];

    if (showsMoney) {
      metrics.splice(2, 0, {
        key: 'collected_month',
        label: 'Collected this month',
        value: Number(c.collected_month_minor),
        formatted: formatMoney(Number(c.collected_month_minor), 'PKR', 'en', { compact: true }),
        delta: null,
        deltaLabel: null,
        tone: 'positive',
        href: '/dashboard/billing',
      });
      metrics.splice(3, 0, {
        key: 'unpaid',
        label: 'Outstanding',
        value: Number(c.unpaid_minor),
        formatted: formatMoney(Number(c.unpaid_minor), 'PKR', 'en', { compact: true }),
        delta: null,
        deltaLabel: `${failures.rows.length} overdue`,
        tone: Number(c.unpaid_minor) > 0 ? 'warning' : 'neutral',
        href: '/dashboard/billing?filter=overdue',
      });
    }

    return {
      metrics,
      queues: {
        escalations: escalations.rows.map((row) => ({
          id: row.risk_flag_id,
          title: row.member_name,
          subtitle: `${row.kind.replace(/_/g, ' ')} · open ${Math.round(Number(row.hours_open))}h`,
          badge: row.severity,
          tone: row.severity === 'critical' ? 'danger' : 'warning',
          href: '/dashboard/escalations',
          timestamp: row.raised_at,
        })),
        paymentFailures: failures.rows.map((row) => ({
          id: row.id,
          title: row.full_name,
          subtitle: `${row.number} · ${formatMoney(Number(row.balance_minor))} · ${row.days_overdue} days overdue`,
          badge: 'overdue',
          tone: Number(row.days_overdue) > 7 ? 'danger' : 'warning',
          href: `/dashboard/members/${row.user_id}?tab=billing`,
          timestamp: null,
        })),
        pendingWaivers: waivers.rows.map((row) => ({
          id: row.id,
          title: row.full_name,
          subtitle: 'Waiver not signed — cannot train until it is',
          badge: 'waiver',
          tone: 'warning',
          href: `/dashboard/members/${row.user_id}`,
          timestamp: row.created_at,
        })),
        inactiveMembers: inactive.rows.map((row) => ({
          id: row.user_id,
          title: row.full_name,
          subtitle: Number(row.days) > 900 ? 'Never trained' : `${row.days} days since last session`,
          badge: `risk ${row.risk}`,
          tone: Number(row.days) > 21 ? 'danger' : 'warning',
          href: `/dashboard/members/${row.user_id}`,
          timestamp: null,
        })),
        coachingReview: coaching.rows.map((row) => ({
          id: row.id,
          title: row.full_name,
          subtitle: `${row.rule_id} proposes ${row.kind.replace(/_/g, ' ')}`,
          badge: 'review',
          tone: 'neutral',
          href: `/dashboard/coaching?member=${row.user_id}`,
          timestamp: row.created_at,
        })),
        newLeads: leads.rows.map((row) => ({
          id: row.id,
          title: row.full_name,
          subtitle: `${row.status.replace(/_/g, ' ')} · ${row.source.replace(/_/g, ' ')}`,
          badge: null,
          tone: 'neutral',
          href: '/dashboard/leads',
          timestamp: row.created_at,
        })),
        tasks: tasks.rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.due_at ? `Due ${new Date(row.due_at).toLocaleDateString('en-PK')}` : 'No due date',
          badge: row.priority,
          tone: row.priority === 'urgent' || row.priority === 'high' ? 'warning' : 'neutral',
          href: '/dashboard/tasks',
          timestamp: row.due_at,
        })),
      },
      todayClasses: classes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        startsAt: row.starts_at,
        coachName: row.coach_name,
        roomName: row.room_name,
        booked: row.booked_count,
        capacity: row.capacity,
        waitlist: row.waitlist_count,
      })),
      branchPerformance: branches.rows.map((row) => ({
        branchId: row.branch_id,
        branchName: row.branch_name,
        activeMembers: Number(row.active_members),
        inactiveMembers: Number(row.inactive_members),
        checkInsToday: Number(row.check_ins_today),
        collectedThisMonthMinor: showsMoney ? Number(row.collected_this_month_minor) : 0,
        overdueMinor: showsMoney ? Number(row.overdue_minor) : 0,
        openLeads: Number(row.open_leads),
        classesToday: Number(row.classes_today),
      })),
    };
  });
}
