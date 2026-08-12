import 'server-only';
/**
 * Owner and manager reporting.
 *
 * Everything here reads the reporting views from migration 0011, which are
 * declared `security_invoker`, so a branch manager running the same query sees
 * their branch and an owner sees the organization. The service never adds an
 * organization filter of its own — that would imply the isolation lives here
 * rather than in the database, which is exactly the assumption the RLS tests
 * exist to prevent.
 */
import type { Actor } from '@gymguide/types';
import { can } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant } from '../db/pool';

export interface BranchRow {
  branchId: string;
  branchName: string;
  activeMembers: number;
  inactiveMembers: number;
  openLeads: number;
  checkInsToday: number;
  collectedThisMonthMinor: number;
  overdueMinor: number;
  classesToday: number;
}

export interface MonthPoint {
  label: string;
  value: number;
}

export interface CoachRow {
  coachId: string;
  coachName: string;
  branchName: string | null;
  assignedMembers: number;
  checkinsAwaitingReview: number;
  openCases: number;
  openTasks: number;
  classesNext7Days: number;
}

export interface RetentionRow {
  bucket: string;
  members: number;
}

export interface ReportsData {
  showsMoney: boolean;
  currency: string;
  branches: BranchRow[];
  revenueByMonth: MonthPoint[];
  collectionsByMethod: Array<{
    method: string;
    paymentCount: number;
    grossMinor: number;
    feesMinor: number;
    unreconciledCount: number;
  }>;
  attendance: MonthPoint[];
  adherence: {
    medianPercent: number;
    membersTracked: number;
    weeks: MonthPoint[];
  };
  coaches: CoachRow[];
  retention: RetentionRow[];
  joinersByMonth: MonthPoint[];
  totals: {
    activeMembers: number;
    atRiskMembers: number;
    collectedThisMonthMinor: number;
    overdueMinor: number;
  };
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

function monthLabel(iso: string): string {
  return MONTH_LABEL.format(new Date(iso));
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export async function loadReports(actor: Actor): Promise<ReportsData> {
  const session = tenantSessionFor(actor);
  const showsMoney = can(actor, 'finance.read');

  return withTenant(session, async (db) => {
    const [branches, revenue, collections, attendance, adherence, coaches, retention, joiners] = await Promise.all([
      db.query<{
        branch_id: string;
        branch_name: string;
        active_members: string;
        inactive_members: string;
        open_leads: string;
        check_ins_today: string;
        collected_this_month_minor: string;
        overdue_minor: string;
        classes_today: string;
      }>('select * from branch_performance order by branch_name'),

      showsMoney
        ? db.query<{ month: string; net_minor: string }>(
            `select month, sum(net_minor) as net_minor
               from revenue_by_month
              where month >= date_trunc('month', now()) - interval '11 months'
              group by month order by month`,
          )
        : Promise.resolve({ rows: [] }),

      showsMoney
        ? db.query<{
            method: string;
            payment_count: string;
            gross_minor: string;
            fees_minor: string;
            unreconciled_count: string;
          }>(
            `select method,
                    sum(payment_count)      as payment_count,
                    sum(gross_minor)        as gross_minor,
                    sum(fees_minor)         as fees_minor,
                    sum(unreconciled_count) as unreconciled_count
               from collections_by_method
              where month >= date_trunc('month', now()) - interval '2 months'
              group by method order by sum(gross_minor) desc`,
          )
        : Promise.resolve({ rows: [] }),

      db.query<{ day: string; check_ins: string }>(
        `select day, sum(check_ins) as check_ins
           from attendance_daily
          where day >= current_date - 29
          group by day order by day`,
      ),

      db.query<{ week_starting: string; adherence_percent: string; members: string }>(
        `select week_starting,
                round(avg(adherence_percent))::int as adherence_percent,
                count(distinct user_id)            as members
           from workout_adherence_weekly
          where week_starting >= current_date - 84
          group by week_starting order by week_starting`,
      ),

      db.query<{
        coach_id: string;
        coach_name: string;
        branch_name: string | null;
        assigned_members: string;
        checkins_awaiting_review: string;
        open_cases: string;
        open_tasks: string;
        classes_next_7_days: string;
      }>(
        `select cw.coach_id, cw.coach_name, b.name as branch_name, cw.assigned_members,
                cw.checkins_awaiting_review, cw.open_cases, cw.open_tasks, cw.classes_next_7_days
           from coach_workload cw
           left join branches b on b.id = cw.branch_id
          order by cw.assigned_members desc`,
      ),

      // Tenure buckets, which answer "are we keeping people?" better than a
      // single churn number: a gym can look healthy on headcount while losing
      // everyone before month three.
      db.query<{ bucket: string; members: string }>(
        `select case
                  when joined_on > current_date - 30  then '0–1 month'
                  when joined_on > current_date - 90  then '1–3 months'
                  when joined_on > current_date - 180 then '3–6 months'
                  when joined_on > current_date - 365 then '6–12 months'
                  else '12 months+'
                end as bucket,
                count(*) as members
           from member_profiles
          where lifecycle_stage = 'active' and deleted_at is null
          group by 1`,
      ),

      db.query<{ month: string; members: string }>(
        `select date_trunc('month', joined_on)::date as month, count(*) as members
           from member_profiles
          where deleted_at is null and joined_on >= date_trunc('month', now()) - interval '11 months'
          group by 1 order by 1`,
      ),
    ]);

    const branchRows: BranchRow[] = branches.rows.map((row) => ({
      branchId: row.branch_id,
      branchName: row.branch_name,
      activeMembers: Number(row.active_members),
      inactiveMembers: Number(row.inactive_members),
      openLeads: Number(row.open_leads),
      checkInsToday: Number(row.check_ins_today),
      collectedThisMonthMinor: Number(row.collected_this_month_minor),
      overdueMinor: Number(row.overdue_minor),
      classesToday: Number(row.classes_today),
    }));

    const adherenceWeeks = adherence.rows.map((row) => ({
      label: DAY_LABEL.format(new Date(row.week_starting)),
      value: Number(row.adherence_percent),
    }));

    const bucketOrder = ['0–1 month', '1–3 months', '3–6 months', '6–12 months', '12 months+'];
    const retentionRows = bucketOrder
      .map((bucket) => ({
        bucket,
        members: Number(retention.rows.find((row) => row.bucket === bucket)?.members ?? 0),
      }))
      .filter((row) => row.members > 0);

    return {
      showsMoney,
      currency: 'PKR',
      branches: branchRows,
      revenueByMonth: revenue.rows.map((row) => ({
        label: monthLabel(row.month),
        value: Math.round(Number(row.net_minor) / 100),
      })),
      collectionsByMethod: collections.rows.map((row) => ({
        method: row.method,
        paymentCount: Number(row.payment_count),
        grossMinor: Number(row.gross_minor),
        feesMinor: Number(row.fees_minor),
        unreconciledCount: Number(row.unreconciled_count),
      })),
      attendance: attendance.rows.map((row) => ({
        label: DAY_LABEL.format(new Date(row.day)),
        value: Number(row.check_ins),
      })),
      adherence: {
        medianPercent: median(adherenceWeeks.map((week) => week.value)),
        membersTracked: Number(adherence.rows.at(-1)?.members ?? 0),
        weeks: adherenceWeeks,
      },
      coaches: coaches.rows.map((row) => ({
        coachId: row.coach_id,
        coachName: row.coach_name,
        branchName: row.branch_name,
        assignedMembers: Number(row.assigned_members),
        checkinsAwaitingReview: Number(row.checkins_awaiting_review),
        openCases: Number(row.open_cases),
        openTasks: Number(row.open_tasks),
        classesNext7Days: Number(row.classes_next_7_days),
      })),
      retention: retentionRows,
      joinersByMonth: joiners.rows.map((row) => ({
        label: monthLabel(row.month),
        value: Number(row.members),
      })),
      totals: {
        activeMembers: branchRows.reduce((sum, row) => sum + row.activeMembers, 0),
        atRiskMembers: branchRows.reduce((sum, row) => sum + row.inactiveMembers, 0),
        collectedThisMonthMinor: branchRows.reduce((sum, row) => sum + row.collectedThisMonthMinor, 0),
        overdueMinor: branchRows.reduce((sum, row) => sum + row.overdueMinor, 0),
      },
    };
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2) : sorted[middle]!;
}
