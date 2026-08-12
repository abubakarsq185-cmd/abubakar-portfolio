-- ===========================================================================
-- 0002_tenancy_identity.sql
-- Platform → Organization → Branch → Staff/Member hierarchy, RBAC, platform
-- SaaS billing, sessions, support impersonation and the audit trail.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Organizations & branches
-- ---------------------------------------------------------------------------

create table organizations (
  id                uuid primary key default gen_random_uuid(),
  slug              citext not null unique,
  legal_name        text not null,
  display_name      text not null,
  country_code      char(2) not null default 'PK',
  default_currency  char(3) not null default 'PKR',
  default_locale    locale_code not null default 'en',
  default_timezone  text not null default 'Asia/Karachi',
  default_units     unit_system not null default 'metric',
  tax_registration  text,
  tax_rate_bps      integer not null default 0 check (tax_rate_bps between 0 and 10000),
  support_email     citext,
  support_phone     text,
  white_label       boolean not null default false,
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
comment on table organizations is 'A gym brand. The tenant boundary for every other table.';

create table brand_themes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  logo_url          text,
  wordmark_url      text,
  accent_hex        char(7) not null default '#C8A45C',
  surface_hex       char(7) not null default '#0B0C0E',
  success_hex       char(7) not null default '#2FBF87',
  danger_hex        char(7) not null default '#E2685C',
  font_family       text not null default 'Manrope',
  member_app_name   text,
  custom_domain     citext,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id)
);

create table branches (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  code              citext not null,
  name              text not null,
  address_line1     text,
  address_line2     text,
  city              text,
  province          text,
  postal_code       text,
  country_code      char(2) not null default 'PK',
  timezone          text not null default 'Asia/Karachi',
  phone             text,
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  opens_at          time not null default '05:00',
  closes_at         time not null default '23:00',
  member_capacity   integer,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (organization_id, code)
);
create index branches_org_idx on branches (organization_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Feature flags (platform default → organization override)
-- ---------------------------------------------------------------------------

create table feature_flags (
  id                uuid primary key default gen_random_uuid(),
  key               citext not null unique,
  label             text not null,
  description       text,
  default_enabled   boolean not null default false,
  is_plan_gated     boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table organization_feature_flags (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  feature_flag_id   uuid not null references feature_flags(id) on delete cascade,
  enabled           boolean not null,
  note              text,
  set_by_user_id    uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, feature_flag_id)
);

-- ---------------------------------------------------------------------------
-- Platform → gym SaaS billing
-- ---------------------------------------------------------------------------

create table subscription_plans (
  id                    uuid primary key default gen_random_uuid(),
  code                  citext not null unique,
  name                  text not null,
  tagline               text,
  currency              char(3) not null default 'PKR',
  monthly_price_minor   bigint not null check (monthly_price_minor >= 0),
  annual_price_minor    bigint not null check (annual_price_minor >= 0),
  included_branches     integer not null default 1,
  extra_branch_minor    bigint not null default 0,
  included_members      integer not null default 200,
  extra_member_minor    bigint not null default 0,
  included_staff_seats  integer not null default 5,
  extra_staff_seat_minor bigint not null default 0,
  messaging_included    integer not null default 0,
  messaging_overage_minor bigint not null default 0,
  white_label           boolean not null default false,
  advanced_analytics    boolean not null default false,
  api_access            boolean not null default false,
  priority_support      boolean not null default false,
  is_public             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table subscription_plans is 'What GymGuide charges a gym. Distinct from membership_plans (gym → member).';

create table organization_subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  subscription_plan_id  uuid not null references subscription_plans(id),
  billing_interval      billing_interval not null default 'monthly',
  state                 membership_state not null default 'active',
  seats_purchased       integer not null default 5,
  branch_limit          integer not null default 1,
  active_member_limit   integer not null default 200,
  trial_ends_at         timestamptz,
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end  boolean not null default false,
  cancelled_at          timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index org_subscriptions_org_idx on organization_subscriptions (organization_id);

create table usage_records (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  metric            text not null,
  quantity          numeric(14,2) not null default 0,
  included_quantity numeric(14,2) not null default 0,
  unit_price_minor  bigint not null default 0,
  recorded_at       timestamptz not null default now(),
  unique (organization_id, period_start, metric)
);

create table platform_invoices (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  number            citext not null unique,
  state             invoice_state not null default 'open',
  currency          char(3) not null default 'PKR',
  subtotal_minor    bigint not null default 0,
  tax_minor         bigint not null default 0,
  total_minor       bigint not null default 0,
  amount_paid_minor bigint not null default 0,
  period_start      date not null,
  period_end        date not null,
  issued_at         timestamptz not null default now(),
  due_at            timestamptz not null default (now() + interval '14 days'),
  paid_at           timestamptz,
  line_items        jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Identity & RBAC
-- ---------------------------------------------------------------------------

create table users (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references organizations(id) on delete cascade,
  email                 citext,
  phone                 text,
  full_name             text not null,
  preferred_name        text,
  password_hash         text,
  password_updated_at   timestamptz,
  status                user_status not null default 'invited',
  locale                locale_code not null default 'en',
  timezone              text not null default 'Asia/Karachi',
  units                 unit_system not null default 'metric',
  avatar_url            text,
  mfa_enabled           boolean not null default false,
  mfa_secret            text,
  mfa_enrolled_at       timestamptz,
  failed_login_count    integer not null default 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  invite_token_hash     text,
  invite_expires_at     timestamptz,
  invite_accepted_at    timestamptz,
  is_platform_admin     boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  -- Platform admins are the only rows allowed to sit outside an organization.
  constraint users_tenant_or_platform check (organization_id is not null or is_platform_admin),
  constraint users_contactable check (email is not null or phone is not null)
);
create unique index users_org_email_key on users (organization_id, email) where email is not null and deleted_at is null;
create unique index users_org_phone_key on users (organization_id, phone) where phone is not null and deleted_at is null;
create unique index users_platform_email_key on users (email) where organization_id is null and deleted_at is null;
create index users_org_status_idx on users (organization_id, status) where deleted_at is null;

create table roles (
  id            uuid primary key default gen_random_uuid(),
  code          role_code not null unique,
  name          text not null,
  description   text not null,
  scope_level   text not null check (scope_level in ('platform', 'organization', 'branch', 'self')),
  is_staff      boolean not null default true,
  sort_order    integer not null default 0
);

create table permissions (
  id            uuid primary key default gen_random_uuid(),
  key           citext not null unique,
  module        text not null,
  label         text not null,
  description   text not null,
  is_sensitive  boolean not null default false
);
comment on column permissions.is_sensitive is
  'Sensitive permissions gate health, financial and private-note data and are never granted by default.';

create table role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  role_id         uuid not null references roles(id),
  organization_id uuid references organizations(id) on delete cascade,
  granted_by      uuid references users(id),
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  unique (user_id, role_id, organization_id)
);
create index user_roles_user_idx on user_roles (user_id) where revoked_at is null;

-- Extra, explicitly granted permissions on top of the role (e.g. a head coach
-- who is allowed to read financial reports).
create table user_permission_grants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  permission_id   uuid not null references permissions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  granted_by      uuid references users(id),
  reason          text not null,
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  unique (user_id, permission_id)
);

create table staff_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  branch_id       uuid references branches(id) on delete cascade,
  job_title       text,
  is_primary      boolean not null default false,
  weekly_hours    integer,
  max_active_members integer,
  starts_on       date not null default current_date,
  ends_on         date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, branch_id)
);
create index staff_assignments_branch_idx on staff_assignments (branch_id);
comment on column staff_assignments.branch_id is
  'NULL means organization-wide scope (owners, org admins).';

-- ---------------------------------------------------------------------------
-- Sessions, impersonation and audit
-- ---------------------------------------------------------------------------

create table auth_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  organization_id   uuid references organizations(id) on delete cascade,
  token_hash        text not null unique,
  ip_address        inet,
  user_agent        text,
  device_label      text,
  mfa_satisfied     boolean not null default false,
  impersonated_by   uuid references users(id),
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  revoked_at        timestamptz
);
create index auth_sessions_user_idx on auth_sessions (user_id) where revoked_at is null;

create table support_access_sessions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  platform_user_id  uuid not null references users(id),
  acting_as_user_id uuid references users(id),
  reason            text not null,
  ticket_reference  text,
  approved_by_org   boolean not null default false,
  scope             text not null default 'read_only' check (scope in ('read_only', 'read_write')),
  started_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  ended_at          timestamptz,
  actions_taken     integer not null default 0,
  constraint support_session_window check (expires_at > started_at),
  constraint support_session_reason_length check (length(btrim(reason)) >= 12)
);
comment on table support_access_sessions is
  'Time-limited, reasoned, auditable platform support access. No silent impersonation.';

create table audit_logs (
  id                bigserial primary key,
  organization_id   uuid references organizations(id) on delete set null,
  branch_id         uuid references branches(id) on delete set null,
  actor_user_id     uuid references users(id) on delete set null,
  actor_role        role_code,
  impersonated_by   uuid references users(id) on delete set null,
  action            audit_action not null,
  entity_type       text not null,
  entity_id         text,
  subject_user_id   uuid references users(id) on delete set null,
  summary           text not null,
  before_state      jsonb,
  after_state       jsonb,
  reason            text,
  ip_address        inet,
  user_agent        text,
  request_id        text,
  occurred_at       timestamptz not null default now()
);
create index audit_logs_org_time_idx on audit_logs (organization_id, occurred_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_subject_idx on audit_logs (subject_user_id, occurred_at desc);

create trigger trg_audit_logs_no_update before update on audit_logs
  for each row execute function app.forbid_mutation();
create trigger trg_audit_logs_no_delete before delete on audit_logs
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

select app.attach_touch(t) from (values
  ('organizations'::regclass), ('brand_themes'), ('branches'), ('feature_flags'),
  ('organization_feature_flags'), ('subscription_plans'), ('organization_subscriptions'),
  ('platform_invoices'), ('users'), ('staff_assignments')
) as v(t);
