-- ===========================================================================
-- 0011_reporting_views.sql
-- Reporting views. Every view is created WITH (security_invoker = true) so the
-- caller's RLS policies apply — a view must never become an RLS bypass.
-- ===========================================================================

create view member_overview with (security_invoker = true) as
select
  mp.id                       as member_profile_id,
  mp.organization_id,
  mp.branch_id,
  b.name                      as branch_name,
  mp.user_id,
  u.full_name,
  u.email,
  u.phone,
  u.status                    as user_status,
  u.locale,
  mp.member_number,
  mp.lifecycle_stage,
  mp.primary_goal,
  mp.experience_level,
  mp.joined_on,
  mp.assigned_coach_id,
  coach.full_name             as coach_name,
  mp.inactivity_risk_score,
  mp.last_visit_at,
  mp.last_workout_at,
  mp.onboarding_completed_at,
  mp.progression_hold_reason,
  mm.id                       as membership_id,
  mm.state                    as membership_state,
  mm.current_period_end       as membership_period_end,
  plan.name                   as plan_name,
  plan.price_minor            as plan_price_minor,
  mm.currency,
  (select count(*) from invoices i
     where i.user_id = mp.user_id and i.state in ('open','partially_paid')) as open_invoice_count,
  (select coalesce(sum(i.total_minor - i.amount_paid_minor), 0) from invoices i
     where i.user_id = mp.user_id and i.state in ('open','partially_paid')) as balance_due_minor,
  (select count(*) from risk_flags rf
     where rf.user_id = mp.user_id and rf.resolved_at is null and rf.severity in ('high','critical')) as open_high_risk_count
from member_profiles mp
join users u on u.id = mp.user_id
join branches b on b.id = mp.branch_id
left join users coach on coach.id = mp.assigned_coach_id
left join member_memberships mm
  on mm.user_id = mp.user_id and mm.state in ('active','trial','frozen','past_due')
left join membership_plans plan on plan.id = mm.membership_plan_id
where mp.deleted_at is null;

comment on view member_overview is 'One row per member for staff lists. Respects caller RLS.';

create view invoice_balances with (security_invoker = true) as
select
  i.id as invoice_id,
  i.organization_id,
  i.branch_id,
  i.user_id,
  i.number,
  i.state,
  i.currency,
  i.total_minor,
  i.amount_paid_minor,
  i.amount_refunded_minor,
  (i.total_minor - i.amount_paid_minor) as balance_minor,
  i.issued_at,
  i.due_at,
  greatest(0, extract(day from (now() - i.due_at))::int) as days_overdue,
  i.dunning_stage
from invoices i
where i.state not in ('void', 'draft');

create view revenue_by_month with (security_invoker = true) as
select
  le.organization_id,
  le.branch_id,
  date_trunc('month', le.occurred_on)::date as month,
  le.account,
  le.currency,
  sum(case when le.direction = 'credit' then le.amount_minor else -le.amount_minor end) as net_minor
from ledger_entries le
where le.account in ('membership_revenue','joining_fee_revenue','class_revenue','pt_revenue','product_revenue','discounts','refunds')
group by 1,2,3,4,5;

create view collections_by_method with (security_invoker = true) as
select
  p.organization_id,
  p.branch_id,
  date_trunc('month', p.received_at)::date as month,
  p.method,
  p.currency,
  count(*)                       as payment_count,
  sum(p.amount_minor)            as gross_minor,
  sum(p.fee_minor)               as fees_minor,
  sum(p.amount_minor - p.fee_minor) as net_minor,
  count(*) filter (where p.reconciled_at is null) as unreconciled_count
from payments p
where p.state = 'succeeded'
group by 1,2,3,4,5;

create view attendance_daily with (security_invoker = true) as
select
  a.organization_id,
  a.branch_id,
  a.checked_in_at::date as day,
  count(*)                                as check_ins,
  count(distinct a.user_id)                as unique_members,
  count(*) filter (where a.class_session_id is not null) as class_check_ins,
  count(*) filter (where a.method = 'qr')  as qr_check_ins
from attendance a
group by 1,2,3;

create view workout_adherence_weekly with (security_invoker = true) as
select
  ws.organization_id,
  ws.user_id,
  date_trunc('week', ws.scheduled_for)::date as week_starting,
  count(*)                                          as scheduled_count,
  count(*) filter (where ws.state = 'completed')     as completed_count,
  count(*) filter (where ws.state = 'skipped')       as skipped_count,
  round(
    100.0 * count(*) filter (where ws.state = 'completed') / greatest(count(*), 1)
  )::int                                             as adherence_percent,
  sum(ws.total_volume_kg)                            as volume_kg,
  avg(ws.session_rpe)                                as avg_session_rpe
from workout_sessions ws
group by 1,2,3;

create view coach_workload with (security_invoker = true) as
select
  sa.organization_id,
  sa.branch_id,
  sa.user_id as coach_id,
  u.full_name as coach_name,
  (select count(*) from member_profiles mp
    where mp.assigned_coach_id = sa.user_id and mp.deleted_at is null) as assigned_members,
  (select count(*) from check_ins c
    where c.coach_id = sa.user_id and c.state = 'submitted') as checkins_awaiting_review,
  (select count(*) from support_cases sc
    where sc.assigned_to_user_id = sa.user_id and sc.state not in ('resolved','closed')) as open_cases,
  (select count(*) from tasks t
    where t.assignee_user_id = sa.user_id and t.completed_at is null) as open_tasks,
  (select count(*) from class_sessions cs
    where cs.coach_id = sa.user_id and cs.starts_at between now() and now() + interval '7 days') as classes_next_7_days
from staff_assignments sa
join users u on u.id = sa.user_id
join user_roles ur on ur.user_id = sa.user_id and ur.revoked_at is null
join roles r on r.id = ur.role_id and r.code = 'coach'
where sa.ends_on is null or sa.ends_on >= current_date;

create view branch_performance with (security_invoker = true) as
select
  b.organization_id,
  b.id as branch_id,
  b.name as branch_name,
  (select count(*) from member_profiles mp
     where mp.branch_id = b.id and mp.lifecycle_stage = 'active' and mp.deleted_at is null) as active_members,
  (select count(*) from member_profiles mp
     where mp.branch_id = b.id and mp.lifecycle_stage = 'active' and mp.deleted_at is null
       and (mp.last_visit_at is null or mp.last_visit_at < now() - interval '14 days')) as inactive_members,
  (select count(*) from leads l
     where l.branch_id = b.id and l.status not in ('converted','lost') and l.deleted_at is null) as open_leads,
  (select count(*) from attendance a
     where a.branch_id = b.id and a.checked_in_at >= current_date) as check_ins_today,
  (select coalesce(sum(p.amount_minor), 0) from payments p
     where p.branch_id = b.id and p.state = 'succeeded'
       and p.received_at >= date_trunc('month', now())) as collected_this_month_minor,
  (select coalesce(sum(i.total_minor - i.amount_paid_minor), 0) from invoices i
     where i.branch_id = b.id and i.state in ('open','partially_paid') and i.due_at < now()) as overdue_minor,
  (select count(*) from class_sessions cs
     where cs.branch_id = b.id and cs.starts_at::date = current_date and cs.state = 'scheduled') as classes_today
from branches b
where b.deleted_at is null;

create view escalation_queue with (security_invoker = true) as
select
  rf.id as risk_flag_id,
  rf.organization_id,
  rf.branch_id,
  rf.user_id,
  u.full_name as member_name,
  rf.kind,
  rf.severity,
  rf.source,
  rf.detail,
  rf.blocks_progression,
  rf.raised_at,
  sc.id as support_case_id,
  sc.reference as case_reference,
  sc.state as case_state,
  sc.assigned_to_user_id,
  extract(epoch from (now() - rf.raised_at)) / 3600 as hours_open
from risk_flags rf
join users u on u.id = rf.user_id
left join support_cases sc on sc.id = rf.support_case_id
where rf.resolved_at is null;

comment on view escalation_queue is
  'Health escalation queue. Only visible to staff holding health.read (RLS on risk_flags).';

create view member_engagement with (security_invoker = true) as
select
  mp.organization_id,
  mp.branch_id,
  mp.user_id,
  mp.lifecycle_stage,
  mp.last_visit_at,
  mp.last_workout_at,
  coalesce(extract(day from (now() - mp.last_workout_at))::int, 999) as days_since_workout,
  (select count(*) from workout_sessions ws
     where ws.user_id = mp.user_id and ws.state = 'completed'
       and ws.scheduled_for >= current_date - 28) as workouts_last_28_days,
  (select count(*) from attendance a
     where a.user_id = mp.user_id and a.checked_in_at >= now() - interval '28 days') as visits_last_28_days,
  (select count(*) from habit_logs hl
     where hl.user_id = mp.user_id and hl.completed and hl.logged_on >= current_date - 7) as habits_last_7_days,
  (select count(*) from check_ins c
     where c.user_id = mp.user_id and c.state = 'submitted' and c.week_starting >= current_date - 56) as checkins_last_8_weeks,
  mp.inactivity_risk_score
from member_profiles mp
where mp.deleted_at is null;
