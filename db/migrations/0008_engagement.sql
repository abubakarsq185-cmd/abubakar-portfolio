-- ===========================================================================
-- 0008_engagement.sql
-- Automations, notifications + preferences, conversations, support cases,
-- AI interaction log, integrations, webhook idempotency, files, job queue and
-- analytics events.
-- ===========================================================================

create table automations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid references branches(id) on delete cascade,
  key                   citext not null,
  name                  text not null,
  description           text,
  trigger_kind          text not null check (trigger_kind in (
                          'member_enrolled','onboarding_incomplete','trial_ending','workout_missed',
                          'inactive_7_days','inactive_14_days','payment_due','payment_failed',
                          'membership_expiring','birthday','workout_milestone','checkin_missing',
                          'class_waitlist_promoted','escalation_raised','manual')),
  trigger_config        jsonb not null default '{}'::jsonb,
  audience              text not null default 'member' check (audience in ('member','staff','both')),
  channels              notification_channel[] not null default '{in_app}',
  template_key          citext not null,
  requires_opt_in       boolean not null default true,
  respect_quiet_hours   boolean not null default true,
  quiet_hours_start     time not null default '21:30',
  quiet_hours_end       time not null default '07:30',
  max_per_member_per_week integer not null default 3,
  cooldown_hours        integer not null default 24,
  creates_staff_task    boolean not null default false,
  task_assignee_role    role_code,
  is_active             boolean not null default true,
  created_by            uuid references users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, key)
);

create table automation_runs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  automation_id     uuid not null references automations(id) on delete cascade,
  target_user_id    uuid references users(id) on delete cascade,
  state             text not null default 'evaluated' check (state in ('evaluated','skipped','queued','sent','failed')),
  skip_reason       text,
  evidence          jsonb not null default '{}'::jsonb,
  notification_id   uuid,
  task_id           uuid references tasks(id) on delete set null,
  dedupe_key        text,
  ran_at            timestamptz not null default now()
);
create unique index automation_runs_dedupe_key on automation_runs (automation_id, dedupe_key) where dedupe_key is not null;
create index automation_runs_target_idx on automation_runs (target_user_id, ran_at desc);

create table notification_templates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  key               citext not null,
  locale            locale_code not null default 'en',
  channel           notification_channel not null,
  subject           text,
  body              text not null,
  cta_label         text,
  cta_path          text,
  category          text not null default 'operational' check (category in ('operational','coaching','billing','marketing','safety')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index notification_templates_platform_key on notification_templates (key, locale, channel) where organization_id is null;
create unique index notification_templates_org_key on notification_templates (organization_id, key, locale, channel) where organization_id is not null;

create table notification_preferences (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  user_id               uuid not null references users(id) on delete cascade,
  channel               notification_channel not null,
  operational_enabled   boolean not null default true,
  coaching_enabled      boolean not null default true,
  billing_enabled       boolean not null default true,
  marketing_enabled     boolean not null default false,
  max_per_week          integer not null default 7,
  quiet_hours_start     time not null default '21:30',
  quiet_hours_end       time not null default '07:30',
  opted_in_at           timestamptz,
  opted_out_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, channel)
);

create table notifications (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  user_id           uuid not null references users(id) on delete cascade,
  channel           notification_channel not null,
  category          text not null default 'operational' check (category in ('operational','coaching','billing','marketing','safety')),
  template_key      citext,
  title             text not null,
  body              text not null,
  cta_label         text,
  cta_path          text,
  state             notification_state not null default 'queued',
  suppression_reason text,
  provider          text,
  provider_message_id text,
  scheduled_for     timestamptz not null default now(),
  sent_at           timestamptz,
  delivered_at      timestamptz,
  failed_at         timestamptz,
  failure_message   text,
  read_at           timestamptz,
  automation_id     uuid references automations(id) on delete set null,
  created_by_user_id uuid references users(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where read_at is null and channel = 'in_app';
create index notifications_queue_idx on notifications (organization_id, scheduled_for) where state = 'queued';

alter table automation_runs
  add constraint automation_runs_notification_fk
  foreign key (notification_id) references notifications(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Conversations, messages, support
-- ---------------------------------------------------------------------------

create table support_cases (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  reference         citext not null,
  member_user_id    uuid references users(id) on delete cascade,
  raised_by_user_id uuid references users(id) on delete set null,
  raised_by_ai      boolean not null default false,
  category          text not null default 'general' check (category in ('general','billing','technical','coaching','nutrition','health_escalation','complaint','membership')),
  priority          case_priority not null default 'normal',
  state             case_state not null default 'open',
  subject           text not null,
  detail            text not null,
  contains_health_data boolean not null default false,
  risk_flag_id      uuid references risk_flags(id) on delete set null,
  assigned_to_user_id uuid references users(id) on delete set null,
  assigned_role     role_code,
  acknowledged_at   timestamptz,
  first_response_at timestamptz,
  resolved_at       timestamptz,
  resolution_note   text,
  sla_due_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, reference)
);
create index support_cases_queue_idx on support_cases (organization_id, priority, created_at desc) where state not in ('resolved','closed');
create index support_cases_member_idx on support_cases (member_user_id, created_at desc);
comment on column support_cases.contains_health_data is
  'When true, RLS additionally requires health.read to view detail.';

alter table risk_flags
  add constraint risk_flags_support_case_fk
  foreign key (support_case_id) references support_cases(id) on delete set null;

create table conversations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  kind              text not null default 'member_staff'
                      check (kind in ('member_staff','member_ai','announcement','staff_internal','support_case')),
  subject           text,
  member_user_id    uuid references users(id) on delete cascade,
  support_case_id   uuid references support_cases(id) on delete set null,
  is_broadcast      boolean not null default false,
  audience_filter   jsonb,
  last_message_at   timestamptz,
  closed_at         timestamptz,
  created_by_user_id uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index conversations_member_idx on conversations (member_user_id, last_message_at desc);

create table conversation_participants (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  conversation_id   uuid not null references conversations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  role_in_thread    text not null default 'participant' check (role_in_thread in ('owner','participant','observer')),
  last_read_at      timestamptz,
  muted             boolean not null default false,
  joined_at         timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table messages (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  conversation_id   uuid not null references conversations(id) on delete cascade,
  sender_user_id    uuid references users(id) on delete set null,
  sender_kind       text not null default 'user' check (sender_kind in ('user','ai','system','automation')),
  body              text not null,
  is_ai_assisted    boolean not null default false,
  ai_interaction_id uuid,
  attachments       jsonb not null default '[]'::jsonb,
  read_by           jsonb not null default '{}'::jsonb,
  delivered_channels notification_channel[] not null default '{in_app}',
  redacted_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at desc);
comment on column messages.is_ai_assisted is
  'Drives the mandatory "AI-assisted" label in every client.';

-- ---------------------------------------------------------------------------
-- AI interaction log
-- ---------------------------------------------------------------------------

create table ai_interactions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid references users(id) on delete set null,
  subject_user_id   uuid references users(id) on delete set null,
  conversation_id   uuid references conversations(id) on delete set null,
  surface           text not null default 'member_coach'
                      check (surface in ('member_coach','staff_summary','staff_draft','triage')),
  driver            text not null,
  model             text not null,
  prompt_version    text not null,
  user_input        text,
  tool_calls        jsonb not null default '[]'::jsonb,
  approved_sources  jsonb not null default '[]'::jsonb,
  output_text       text,
  safety_result     ai_safety_result not null default 'allowed',
  safety_reasons    text[] not null default '{}',
  escalated_case_id uuid references support_cases(id) on delete set null,
  latency_ms        integer,
  input_tokens      integer,
  output_tokens     integer,
  feedback_rating   text check (feedback_rating in ('helpful','not_helpful')),
  feedback_note     text,
  created_at        timestamptz not null default now()
);
create index ai_interactions_user_idx on ai_interactions (user_id, created_at desc);
create index ai_interactions_safety_idx on ai_interactions (organization_id, safety_result, created_at desc);
comment on table ai_interactions is
  'Full provenance for every AI response: driver, model, prompt version, tool calls,
   approved sources used, output and safety verdict. Never used for external training.';

alter table messages
  add constraint messages_ai_interaction_fk
  foreign key (ai_interaction_id) references ai_interactions(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Integrations, webhooks, files
-- ---------------------------------------------------------------------------

create table integration_connections (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete cascade,
  kind              text not null check (kind in ('payment','sms','whatsapp','email','push','door_access','wearable','accounting','pos','analytics')),
  provider          text not null,
  display_name      text not null,
  state             text not null default 'disconnected'
                      check (state in ('disconnected','pending_credentials','connected','error','disabled')),
  config            jsonb not null default '{}'::jsonb,
  credential_ref    text,
  webhook_secret_ref text,
  last_verified_at  timestamptz,
  last_error        text,
  connected_by      uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, kind, provider)
);
comment on column integration_connections.credential_ref is
  'Pointer into the secret store (env var name or KMS key id). Never the secret itself.';

create table webhook_events (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  provider          text not null,
  event_type        text not null,
  external_event_id text not null,
  signature_verified boolean not null default false,
  signature_error   text,
  payload           jsonb not null,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  processing_state  text not null default 'received'
                      check (processing_state in ('received','processed','duplicate','rejected','failed')),
  processing_error  text,
  attempts          integer not null default 0,
  resulted_in_payment_id uuid references payments(id) on delete set null,
  unique (provider, external_event_id)
);
create index webhook_events_state_idx on webhook_events (processing_state, received_at desc);
comment on constraint webhook_events_provider_external_event_id_key on webhook_events is
  'The idempotency guarantee: a replayed provider event can never double-post money.';

create table file_assets (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  owner_user_id     uuid references users(id) on delete cascade,
  bucket            text not null default 'gymguide',
  storage_key       text not null unique,
  original_filename text,
  mime_type         text not null,
  byte_size         bigint not null,
  checksum_sha256   text,
  visibility        text not null default 'private' check (visibility in ('private','organization','public')),
  is_sensitive      boolean not null default false,
  entity_type       text,
  entity_id         uuid,
  scan_state        text not null default 'pending' check (scan_state in ('pending','clean','rejected')),
  scan_note         text,
  uploaded_by       uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index file_assets_entity_idx on file_assets (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Job queue & analytics
-- ---------------------------------------------------------------------------

create table job_queue (
  id                bigserial primary key,
  organization_id   uuid references organizations(id) on delete cascade,
  kind              text not null,
  payload           jsonb not null default '{}'::jsonb,
  state             job_state not null default 'pending',
  priority          integer not null default 100,
  run_after         timestamptz not null default now(),
  attempts          integer not null default 0,
  max_attempts      integer not null default 5,
  locked_at         timestamptz,
  locked_by         text,
  last_error        text,
  dedupe_key        text,
  finished_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index job_queue_ready_idx on job_queue (state, run_after, priority) where state = 'pending';
create unique index job_queue_dedupe_key on job_queue (kind, dedupe_key) where dedupe_key is not null and state in ('pending','running');

create table analytics_events (
  id                bigserial primary key,
  organization_id   uuid references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  user_id           uuid references users(id) on delete set null,
  name              text not null,
  surface           text not null default 'web' check (surface in ('web','mobile','staff','api','job')),
  properties        jsonb not null default '{}'::jsonb,
  session_ref       text,
  occurred_at       timestamptz not null default now()
);
create index analytics_events_org_name_idx on analytics_events (organization_id, name, occurred_at desc);

create table error_events (
  id                bigserial primary key,
  organization_id   uuid references organizations(id) on delete set null,
  user_id           uuid references users(id) on delete set null,
  level             text not null default 'error' check (level in ('warn','error','fatal')),
  message           text not null,
  fingerprint       text,
  context           jsonb not null default '{}'::jsonb,
  request_id        text,
  occurred_at       timestamptz not null default now()
);
create index error_events_fingerprint_idx on error_events (fingerprint, occurred_at desc);

select app.attach_touch(t) from (values
  ('automations'::regclass), ('notification_templates'), ('notification_preferences'),
  ('notifications'), ('support_cases'), ('conversations'), ('integration_connections')
) as v(t);
