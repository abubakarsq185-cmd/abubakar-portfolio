-- ===========================================================================
-- 0003_members.sql
-- Member records, family links, consent + waiver evidence, health screening,
-- risk flags, and the CRM surface (leads, trials, tags, notes, tasks).
-- ===========================================================================

create table member_profiles (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations(id) on delete cascade,
  branch_id               uuid not null references branches(id) on delete restrict,
  user_id                 uuid not null references users(id) on delete cascade,
  member_number           citext not null,
  date_of_birth           date,
  gender                  text check (gender in ('male', 'female', 'other', 'undisclosed')),
  lifecycle_stage         lifecycle_stage not null default 'lead',
  joined_on               date,
  primary_goal            training_goal,
  secondary_goal          training_goal,
  experience_level        experience_level,
  target_weight_kg        numeric(5,2) check (target_weight_kg is null or target_weight_kg between 25 and 400),
  height_cm               numeric(5,1) check (height_cm is null or height_cm between 80 and 260),
  starting_weight_kg      numeric(5,2),
  training_days_per_week  integer check (training_days_per_week between 1 and 7),
  preferred_days          text[] not null default '{}',
  preferred_session_minutes integer check (preferred_session_minutes between 15 and 180),
  preferred_training_time text check (preferred_training_time in ('early_morning','morning','afternoon','evening','late_night','flexible')),
  ramadan_mode            boolean not null default false,
  onboarding_step         text not null default 'not_started',
  onboarding_completed_at timestamptz,
  assigned_coach_id       uuid references users(id) on delete set null,
  assigned_nutritionist_id uuid references users(id) on delete set null,
  guardian_user_id        uuid references users(id) on delete set null,
  referral_source         text,
  notes_summary           text,
  inactivity_risk_score   integer not null default 0 check (inactivity_risk_score between 0 and 100),
  last_visit_at           timestamptz,
  last_workout_at         timestamptz,
  automation_paused_until timestamptz,
  progression_hold_reason text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  unique (organization_id, member_number),
  unique (user_id)
);
create index member_profiles_branch_idx on member_profiles (branch_id, lifecycle_stage) where deleted_at is null;
create index member_profiles_coach_idx on member_profiles (assigned_coach_id) where deleted_at is null;
create index member_profiles_risk_idx on member_profiles (organization_id, inactivity_risk_score desc);
comment on column member_profiles.progression_hold_reason is
  'Set by the safety engine. While non-null the coaching engine must not auto-progress load.';

-- Family / guardian payer links.
create table family_links (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  payer_user_id     uuid not null references users(id) on delete cascade,
  dependent_user_id uuid not null references users(id) on delete cascade,
  relationship      text not null default 'guardian',
  can_manage_billing boolean not null default true,
  can_view_health   boolean not null default false,
  health_consent_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (payer_user_id, dependent_user_id),
  constraint family_links_distinct check (payer_user_id <> dependent_user_id)
);
comment on column family_links.can_view_health is
  'Only true when the dependent (or legal guardian of a minor) granted explicit consent.';

create table emergency_contacts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  full_name         text not null,
  relationship      text not null,
  phone             text not null,
  alternate_phone   text,
  is_primary        boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index emergency_contacts_user_idx on emergency_contacts (user_id);

create table consents (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  kind              consent_kind not null,
  granted           boolean not null,
  version           text not null,
  document_url      text,
  collected_by      uuid references users(id) on delete set null,
  collected_channel text not null default 'app' check (collected_channel in ('app','web','front_desk','paper','import')),
  ip_address        inet,
  granted_at        timestamptz,
  withdrawn_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index consents_user_kind_idx on consents (user_id, kind, created_at desc);
comment on table consents is 'Append-only consent evidence. Withdrawal writes a new row, it never edits history.';
create trigger trg_consents_no_delete before delete on consents
  for each row execute function app.forbid_mutation();

create table waivers (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  user_id           uuid not null references users(id) on delete cascade,
  template_code     citext not null,
  template_version  text not null,
  body_snapshot     text not null,
  signature_name    text,
  signature_image_url text,
  signed_at         timestamptz,
  expires_on        date,
  witnessed_by      uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index waivers_pending_idx on waivers (organization_id) where signed_at is null;

create table health_screenings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  user_id               uuid not null references users(id) on delete cascade,
  questionnaire_code    citext not null default 'parq_plus',
  version               text not null default '2026.1',
  answers               jsonb not null default '{}'::jsonb,
  reported_conditions   text[] not null default '{}',
  medications_disclosed boolean not null default false,
  pain_areas            text[] not null default '{}',
  pregnancy_status      text check (pregnancy_status in ('not_applicable','pregnant','postpartum','prefer_not_to_say')),
  surgery_last_12_months boolean not null default false,
  smoker                boolean,
  requires_clearance    boolean not null default false,
  clearance_document_url text,
  clearance_confirmed_by uuid references users(id) on delete set null,
  clearance_confirmed_at timestamptz,
  completed_at          timestamptz not null default now(),
  reviewed_by           uuid references users(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index health_screenings_user_idx on health_screenings (user_id, completed_at desc);
comment on table health_screenings is
  'Sensitive health data. RLS requires the member themself or health.read permission.';

create table risk_flags (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  user_id           uuid not null references users(id) on delete cascade,
  kind              risk_kind not null,
  severity          risk_severity not null,
  source            text not null check (source in ('screening','member_report','workout_log','coach','ai_triage','import')),
  detail            text,
  affected_movements text[] not null default '{}',
  blocks_progression boolean not null default false,
  requires_human_review boolean not null default true,
  support_case_id   uuid,
  raised_by         uuid references users(id) on delete set null,
  raised_at         timestamptz not null default now(),
  resolved_by       uuid references users(id) on delete set null,
  resolved_at       timestamptz,
  resolution_note   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index risk_flags_open_idx on risk_flags (organization_id, severity, raised_at desc) where resolved_at is null;
create index risk_flags_user_idx on risk_flags (user_id) where resolved_at is null;

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------

create table leads (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete cascade,
  full_name         text not null,
  phone             text,
  email             citext,
  status            lead_status not null default 'new',
  source            text not null default 'walk_in',
  interest          training_goal,
  message           text,
  owner_user_id     uuid references users(id) on delete set null,
  converted_user_id uuid references users(id) on delete set null,
  lost_reason       text,
  next_follow_up_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint leads_contactable check (phone is not null or email is not null)
);
create index leads_branch_status_idx on leads (branch_id, status) where deleted_at is null;

create table trials (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete cascade,
  lead_id           uuid references leads(id) on delete set null,
  user_id           uuid references users(id) on delete cascade,
  kind              text not null default 'day_pass' check (kind in ('day_pass','week_pass','class_trial','pt_trial')),
  starts_on         date not null default current_date,
  ends_on           date not null,
  sessions_allowed  integer not null default 1,
  sessions_used     integer not null default 0,
  converted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table tags (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  label             citext not null,
  color_hex         char(7) not null default '#C8A45C',
  kind              text not null default 'member',
  created_at        timestamptz not null default now(),
  unique (organization_id, label)
);

create table taggings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  tag_id          uuid not null references tags(id) on delete cascade,
  entity_type     text not null,
  entity_id       uuid not null,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (tag_id, entity_type, entity_id)
);
create index taggings_entity_idx on taggings (entity_type, entity_id);

create table notes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  entity_type       text not null,
  entity_id         uuid not null,
  author_user_id    uuid references users(id) on delete set null,
  body              text not null,
  visibility        text not null default 'staff' check (visibility in ('staff','coach_only','restricted','member_visible')),
  is_pinned         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index notes_entity_idx on notes (entity_type, entity_id) where deleted_at is null;
comment on column notes.visibility is
  'restricted notes require notes.restricted.read; front desk never sees them.';

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  title             text not null,
  detail            text,
  category          text not null default 'general',
  priority          case_priority not null default 'normal',
  assignee_user_id  uuid references users(id) on delete set null,
  assigned_role     role_code,
  related_entity_type text,
  related_entity_id uuid,
  member_user_id    uuid references users(id) on delete set null,
  due_at            timestamptz,
  completed_at      timestamptz,
  completed_by      uuid references users(id) on delete set null,
  created_by        uuid references users(id) on delete set null,
  created_by_automation uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index tasks_open_idx on tasks (organization_id, priority, due_at) where completed_at is null;
create index tasks_assignee_idx on tasks (assignee_user_id) where completed_at is null;

-- Data subject requests (export / erasure)
create table data_requests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  kind              text not null check (kind in ('export','erasure','rectification')),
  state             text not null default 'received' check (state in ('received','verifying','in_progress','completed','rejected')),
  requested_at      timestamptz not null default now(),
  due_at            timestamptz not null default (now() + interval '30 days'),
  handled_by        uuid references users(id) on delete set null,
  completed_at      timestamptz,
  artifact_url      text,
  rejection_reason  text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

select app.attach_touch(t) from (values
  ('member_profiles'::regclass), ('family_links'), ('emergency_contacts'), ('waivers'),
  ('health_screenings'), ('risk_flags'), ('leads'), ('trials'), ('notes'), ('tasks'),
  ('data_requests')
) as v(t);
