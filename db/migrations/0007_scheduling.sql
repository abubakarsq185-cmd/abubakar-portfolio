-- ===========================================================================
-- 0007_scheduling.sql
-- Rooms, classes, occurrences, booking rules, waitlists, attendance and the
-- access-credential surface that a future smart-door integration plugs into.
-- ===========================================================================

create table rooms (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete cascade,
  name              text not null,
  capacity          integer not null check (capacity > 0),
  floor_label       text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (branch_id, name)
);

create table classes (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid not null references branches(id) on delete cascade,
  room_id               uuid references rooms(id) on delete set null,
  name                  text not null,
  description           text,
  category              text not null default 'group'
                          check (category in ('group','hiit','strength','yoga','pilates','spin','boxing','zumba','functional','womens_only','induction','pt')),
  intensity             text not null default 'moderate' check (intensity in ('gentle','moderate','high')),
  default_coach_id      uuid references users(id) on delete set null,
  capacity              integer not null default 20 check (capacity > 0),
  duration_minutes      integer not null default 45,
  credits_required      integer not null default 1,
  members_only          boolean not null default true,
  women_only            boolean not null default false,
  -- Booking rules
  booking_opens_hours_before  integer not null default 48,
  booking_closes_minutes_before integer not null default 30,
  cancellation_window_hours   integer not null default 4,
  late_cancel_penalty_credits integer not null default 1,
  no_show_penalty_credits     integer not null default 1,
  waitlist_enabled      boolean not null default true,
  waitlist_capacity     integer not null default 10,
  -- Recurrence (simple weekly pattern; occurrences are materialised rows)
  recurrence_days       integer[] not null default '{}',
  start_time            time,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index classes_branch_idx on classes (branch_id) where is_active and deleted_at is null;

create table class_sessions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete cascade,
  class_id          uuid not null references classes(id) on delete cascade,
  room_id           uuid references rooms(id) on delete set null,
  coach_id          uuid references users(id) on delete set null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  capacity          integer not null,
  booked_count      integer not null default 0,
  waitlist_count    integer not null default 0,
  attended_count    integer not null default 0,
  state             text not null default 'scheduled' check (state in ('scheduled','cancelled','completed')),
  cancellation_reason text,
  substitute_note   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint class_session_window check (ends_at > starts_at),
  unique (class_id, starts_at)
);
create index class_sessions_branch_time_idx on class_sessions (branch_id, starts_at);
create index class_sessions_coach_idx on class_sessions (coach_id, starts_at);

create table bookings (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete cascade,
  class_session_id  uuid not null references class_sessions(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  member_membership_id uuid references member_memberships(id) on delete set null,
  state             booking_state not null default 'booked',
  booked_at         timestamptz not null default now(),
  booked_by_user_id uuid references users(id) on delete set null,
  cancelled_at      timestamptz,
  cancelled_by_user_id uuid references users(id) on delete set null,
  cancellation_reason text,
  credits_charged   integer not null default 1,
  penalty_applied   integer not null default 0,
  checked_in_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (class_session_id, user_id)
);
create index bookings_user_idx on bookings (user_id, booked_at desc);
create index bookings_session_idx on bookings (class_session_id, state);

create table waitlist_entries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  class_session_id  uuid not null references class_sessions(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  position          integer not null,
  joined_at         timestamptz not null default now(),
  promoted_at       timestamptz,
  promoted_booking_id uuid references bookings(id) on delete set null,
  expired_at        timestamptz,
  notified_at       timestamptz,
  unique (class_session_id, user_id)
);
create index waitlist_entries_session_idx on waitlist_entries (class_session_id, position) where promoted_at is null and expired_at is null;

create table attendance (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  class_session_id  uuid references class_sessions(id) on delete set null,
  booking_id        uuid references bookings(id) on delete set null,
  workout_session_id uuid references workout_sessions(id) on delete set null,
  method            attendance_method not null default 'manual',
  checked_in_at     timestamptz not null default now(),
  checked_out_at    timestamptz,
  recorded_by_user_id uuid references users(id) on delete set null,
  device_label      text,
  membership_valid  boolean not null default true,
  override_reason   text,
  created_at        timestamptz not null default now()
);
create index attendance_branch_day_idx on attendance (branch_id, checked_in_at desc);
create index attendance_user_idx on attendance (user_id, checked_in_at desc);

create table access_credentials (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  kind              text not null default 'qr' check (kind in ('qr','barcode','rfid','pin','nfc')),
  token_hash        text not null,
  display_hint      text,
  rotates_every_seconds integer not null default 60,
  is_active         boolean not null default true,
  issued_at         timestamptz not null default now(),
  expires_at        timestamptz,
  revoked_at        timestamptz,
  last_used_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (token_hash)
);
create index access_credentials_user_idx on access_credentials (user_id) where is_active;
comment on table access_credentials is
  'Rotating member check-in tokens. Also the seam for smart-door hardware: a door
   controller verifies a token here via the integration API rather than reading
   member records directly.';

select app.attach_touch(t) from (values
  ('rooms'::regclass), ('classes'), ('class_sessions'), ('bookings'), ('access_credentials')
) as v(t);
