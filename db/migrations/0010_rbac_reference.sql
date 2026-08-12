-- ===========================================================================
-- 0010_rbac_reference.sql
-- The permission catalogue and the role → permission matrix.
-- This is reference data, not demo data: the application and RLS both depend
-- on these keys existing. Mirrored in packages/types/src/rbac.ts and
-- documented in docs/PERMISSIONS.md — the integration test
-- `rbac-matrix.test.ts` fails if the two drift apart.
-- ===========================================================================

insert into roles (code, name, description, scope_level, is_staff, sort_order) values
  ('platform_super_admin', 'Platform Super Admin', 'GymGuide staff. Manages tenants, plans, feature flags and support access.', 'platform', true, 0),
  ('gym_owner', 'Gym Owner', 'Full control of one gym brand: every branch, staff member, program and financial record.', 'organization', true, 1),
  ('branch_manager', 'Branch Manager', 'Operational control of assigned branches only.', 'branch', true, 2),
  ('coach', 'Coach / Trainer', 'Coaches an assigned caseload of members. No financial access by default.', 'branch', true, 3),
  ('front_desk', 'Front Desk', 'Enrolment, check-in, sales and payments. No private health or coaching notes.', 'branch', true, 4),
  ('nutrition_professional', 'Nutrition Professional', 'Nutrition plans and nutrition check-ins for assigned members only.', 'branch', true, 5),
  ('member', 'Member', 'Their own plan, workouts, progress, bookings, invoices and support.', 'self', false, 6),
  ('guardian', 'Guardian / Family Payer', 'Manages billing for linked dependents. No health data without explicit consent.', 'self', false, 7);

insert into permissions (key, module, label, description, is_sensitive) values
  -- Organization & staff
  ('organization.settings.write', 'organization', 'Edit organization settings', 'Branding, locales, tax details, policies.', false),
  ('branches.write',              'organization', 'Manage branches', 'Create and edit branches.', false),
  ('staff.read',                  'staff', 'View staff', 'See staff directory and assignments.', false),
  ('staff.write',                 'staff', 'Manage staff', 'Invite, edit and deactivate staff.', false),
  ('staff.roles.write',           'staff', 'Change roles', 'Grant or revoke roles and extra permissions.', true),
  ('audit.read',                  'security', 'Read audit log', 'View the tenant audit trail.', true),
  ('integrations.read',           'integrations', 'View integrations', 'See integration connections and webhook history.', false),
  ('integrations.write',          'integrations', 'Manage integrations', 'Connect and configure providers.', true),
  ('platform_billing.read',       'billing', 'View GymGuide subscription', 'See the gym’s own GymGuide invoices and plan limits.', false),
  -- CRM
  ('leads.read',                  'crm', 'View leads', 'See the lead pipeline.', false),
  ('leads.write',                 'crm', 'Manage leads', 'Create, update and convert leads and trials.', false),
  ('members.read.all',            'members', 'View all members', 'Every member in scope.', false),
  ('members.read.assigned',       'members', 'View assigned members', 'Only members assigned to this staff member.', false),
  ('members.write',               'members', 'Manage members', 'Create and edit member records.', false),
  ('members.export',              'members', 'Export members', 'Bulk export member data.', true),
  ('consent.collect',             'members', 'Collect consent', 'Capture waivers and consent on a member’s behalf.', false),
  ('notes.write',                 'members', 'Write notes', 'Add notes to a member timeline.', false),
  ('notes.coach.read',            'members', 'Read coaching notes', 'Coach-only notes.', true),
  ('notes.restricted.read',       'members', 'Read restricted notes', 'Restricted notes (incidents, disputes).', true),
  ('tasks.write',                 'members', 'Manage tasks', 'Create and complete staff tasks.', false),
  -- Health
  ('health.read',                 'health', 'Read health screening', 'Screening answers, conditions, injuries, risk flags.', true),
  ('health.write',                'health', 'Manage health records', 'Record screenings, raise and resolve risk flags.', true),
  ('progress_photos.read',        'health', 'View progress photos', 'Only photos the member explicitly shared.', true),
  ('escalations.manage',          'health', 'Manage escalations', 'Work the health escalation queue.', true),
  -- Money
  ('finance.read',                'billing', 'View billing', 'Invoices, payments and balances.', true),
  ('finance.write',               'billing', 'Record payments', 'Create invoices and record payments.', true),
  ('finance.refund',              'billing', 'Issue refunds', 'Approve and process refunds.', true),
  ('plans.write',                 'billing', 'Manage plans', 'Create membership plans, promotions and fees.', false),
  ('memberships.write',           'billing', 'Manage memberships', 'Sell, freeze, upgrade, downgrade and cancel.', false),
  ('ledger.read',                 'billing', 'Read ledger', 'The financial journal and reconciliation views.', true),
  -- Coaching
  ('content.write',               'coaching', 'Manage coaching content', 'Exercises, workouts, programs and media.', false),
  ('programs.assign',             'coaching', 'Assign programs', 'Assign or replace a member’s program.', false),
  ('programs.override',           'coaching', 'Override engine', 'Override an automated coaching recommendation.', true),
  ('checkins.review',             'coaching', 'Review check-ins', 'Read and respond to member check-ins.', false),
  ('nutrition.read',              'nutrition', 'View nutrition plans', 'Targets, meal plans and food logs.', true),
  ('nutrition.write',             'nutrition', 'Manage nutrition plans', 'Set targets and approve meal plans.', true),
  -- Operations
  ('classes.write',               'scheduling', 'Manage classes', 'Timetable, rooms, capacity and coaches.', false),
  ('bookings.write',              'scheduling', 'Manage bookings', 'Book, cancel and manage waitlists for members.', false),
  ('attendance.write',            'scheduling', 'Record attendance', 'Check members in and out.', false),
  ('equipment.write',             'operations', 'Manage equipment', 'Branch equipment inventory and servicing.', false),
  ('automations.write',           'operations', 'Manage automations', 'Configure automated messages and tasks.', false),
  ('messaging.read',              'communication', 'Read conversations', 'Staff view of member conversations.', false),
  ('messaging.write',             'communication', 'Send messages', 'Reply to members and send announcements.', false),
  ('support.read',                'support', 'View support cases', 'The support queue.', false),
  ('support.write',               'support', 'Work support cases', 'Assign, respond to and resolve cases.', false),
  ('ai.logs.read',                'support', 'Read AI logs', 'AI interaction provenance and safety verdicts.', true),
  -- Reporting
  ('reports.read',                'reports', 'View reports', 'Attendance, adherence, retention and engagement reports.', false),
  ('reports.financial',           'reports', 'View financial reports', 'Revenue, collections and overdue reports.', true),
  ('reports.export',              'reports', 'Export reports', 'CSV / PDF-ready exports.', false),
  -- Self-service
  ('member.self',                 'member', 'Member self-service', 'Own plan, workouts, progress, bookings and invoices.', false),
  ('family.billing.manage',       'member', 'Manage family billing', 'Pay for and manage linked dependents’ memberships.', false);

-- ---------------------------------------------------------------------------
-- Role → permission matrix
-- ---------------------------------------------------------------------------

with matrix(role_code, permission_keys) as (
  values
  ('gym_owner'::role_code, array[
    'organization.settings.write','branches.write','staff.read','staff.write','staff.roles.write',
    'audit.read','integrations.read','integrations.write','platform_billing.read',
    'leads.read','leads.write','members.read.all','members.write','members.export','consent.collect',
    'notes.write','notes.coach.read','notes.restricted.read','tasks.write',
    'health.read','health.write','progress_photos.read','escalations.manage',
    'finance.read','finance.write','finance.refund','plans.write','memberships.write','ledger.read',
    'content.write','programs.assign','programs.override','checkins.review','nutrition.read','nutrition.write',
    'classes.write','bookings.write','attendance.write','equipment.write','automations.write',
    'messaging.read','messaging.write','support.read','support.write','ai.logs.read',
    'reports.read','reports.financial','reports.export']),

  ('branch_manager', array[
    'staff.read','staff.write','audit.read','integrations.read',
    'leads.read','leads.write','members.read.all','members.write','members.export','consent.collect',
    'notes.write','notes.coach.read','notes.restricted.read','tasks.write',
    'health.read','health.write','escalations.manage',
    'finance.read','finance.write','memberships.write','ledger.read',
    'content.write','programs.assign','checkins.review',
    'classes.write','bookings.write','attendance.write','equipment.write','automations.write',
    'messaging.read','messaging.write','support.read','support.write',
    'reports.read','reports.financial','reports.export']),

  -- No finance permissions. Financial access must be granted explicitly per
  -- user via user_permission_grants.
  ('coach', array[
    'members.read.assigned','notes.write','notes.coach.read','tasks.write',
    'health.read','health.write','progress_photos.read','escalations.manage',
    'content.write','programs.assign','programs.override','checkins.review','nutrition.read',
    'bookings.write','attendance.write',
    'messaging.read','messaging.write','support.read','support.write',
    'reports.read']),

  -- No health, no restricted notes, no nutrition, no progress photos.
  ('front_desk', array[
    'leads.read','leads.write','members.read.all','members.write','consent.collect',
    'notes.write','tasks.write',
    'finance.read','finance.write','memberships.write',
    'bookings.write','attendance.write',
    'messaging.read','messaging.write','support.read',
    'reports.read']),

  ('nutrition_professional', array[
    'members.read.assigned','notes.write','tasks.write',
    'health.read','nutrition.read','nutrition.write','checkins.review',
    'messaging.read','messaging.write','support.read','support.write']),

  ('member', array['member.self']),

  ('guardian', array['member.self','family.billing.manage'])
)
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join roles r on r.code = m.role_code
join permissions p on p.key = any (m.permission_keys);

-- Platform super admin holds every permission implicitly (app.is_platform_admin)
-- but we materialise the grant so the UI can render a complete matrix.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r cross join permissions p
where r.code = 'platform_super_admin';

-- ---------------------------------------------------------------------------
-- Platform feature flags
-- ---------------------------------------------------------------------------

insert into feature_flags (key, label, description, default_enabled, is_plan_gated) values
  ('ai_coach',            'AI Coach',              'GymGuide Coach assistant inside the member app.', true,  false),
  ('nutrition_module',    'Nutrition module',      'Targets, meal plans, food logging and grocery lists.', true, false),
  ('class_booking',       'Class booking',         'Timetable, bookings and waitlists.', true, false),
  ('white_label',         'White label',           'Custom domain, logo and app name.', false, true),
  ('advanced_analytics',  'Advanced analytics',    'Cohort retention, churn and branch comparison.', false, true),
  ('whatsapp_messaging',  'WhatsApp messaging',    'Opt-in WhatsApp notifications (requires approved templates).', false, true),
  ('door_access',         'Smart door access',     'Access-control integration surface.', false, true),
  ('family_accounts',     'Family accounts',       'Guardian payers and linked dependents.', true, false),
  ('offline_workouts',    'Offline workouts',      'Downloadable workouts with deferred sync.', true, false),
  ('ramadan_mode',        'Ramadan mode',          'Ramadan-adjusted plans, timings and meal schedules.', true, false),
  ('member_web_portal',   'Member web portal',     'Browser access to the member experience.', true, false),
  ('pt_packages',         'Personal training',     'PT package sales and session tracking.', true, false);

-- ---------------------------------------------------------------------------
-- Platform metric definitions
-- ---------------------------------------------------------------------------

insert into metric_definitions (organization_id, key, label, unit, kind, min_value, max_value, higher_is_better, is_sensitive, precision_digits, sort_order) values
  (null, 'body_weight',      'Body weight',       'kg',    'body',      25, 400, null,  false, 1, 1),
  (null, 'waist',            'Waist',             'cm',    'body',      40, 250, false, false, 1, 2),
  (null, 'hips',             'Hips',              'cm',    'body',      50, 250, null,  false, 1, 3),
  (null, 'chest',            'Chest',             'cm',    'body',      50, 250, null,  false, 1, 4),
  (null, 'arm',              'Arm',               'cm',    'body',      15, 80,  true,  false, 1, 5),
  (null, 'thigh',            'Thigh',             'cm',    'body',      25, 120, null,  false, 1, 6),
  (null, 'body_fat_percent', 'Body fat',          '%',     'body',       3,  70, false, true,  1, 7),
  (null, 'resting_hr',       'Resting heart rate','bpm',   'performance',30, 140, false, true,  0, 8),
  (null, 'steps',            'Daily steps',       'steps', 'lifestyle',  0, 60000, true, false, 0, 9),
  (null, 'sleep_hours',      'Sleep',             'hours', 'lifestyle',  0, 16,  true,  false, 1, 10),
  (null, 'water_ml',         'Water',             'ml',    'lifestyle',  0, 8000, true, false, 0, 11);
