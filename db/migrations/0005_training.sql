-- ===========================================================================
-- 0005_training.sql
-- Exercise library, equipment, the approved program hierarchy
-- (platform → organization → branch → member), the workout player's logging
-- tables, progress tracking and the coaching engine's decision record.
-- ===========================================================================

create table equipment (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  code              citext not null,
  name              text not null,
  category          text not null default 'machine'
                      check (category in ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','cardio','bench','rack','accessory','other')),
  description       text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index equipment_platform_code_key on equipment (code) where organization_id is null;
create unique index equipment_org_code_key on equipment (organization_id, code) where organization_id is not null;
comment on column equipment.organization_id is 'NULL = platform catalogue available to every tenant.';

create table branch_equipment (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete cascade,
  equipment_id      uuid not null references equipment(id) on delete cascade,
  quantity          integer not null default 1 check (quantity >= 0),
  condition         text not null default 'good' check (condition in ('new','good','fair','maintenance','out_of_service')),
  serial_number     text,
  purchased_on      date,
  last_serviced_on  date,
  next_service_on   date,
  is_available      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (branch_id, equipment_id)
);
create index branch_equipment_available_idx on branch_equipment (branch_id) where is_available;

create table exercises (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references organizations(id) on delete cascade,
  code                  citext not null,
  name                  text not null,
  name_ur               text,
  name_ur_rm            text,
  movement_pattern      text not null
                          check (movement_pattern in ('squat','hinge','horizontal_push','vertical_push','horizontal_pull','vertical_pull','lunge','carry','rotation','anti_extension','anti_rotation','hip_isolation','knee_isolation','elbow_flexion','elbow_extension','calf','shoulder_isolation','cardio','mobility','stretch')),
  primary_muscles       text[] not null default '{}',
  secondary_muscles     text[] not null default '{}',
  required_equipment_codes text[] not null default '{}',
  difficulty            experience_level not null default 'beginner',
  is_unilateral         boolean not null default false,
  is_compound           boolean not null default false,
  is_low_impact         boolean not null default false,
  setup_instructions    text not null,
  execution_steps       text[] not null default '{}',
  form_cues             text[] not null default '{}',
  common_mistakes       text[] not null default '{}',
  safety_notes          text[] not null default '{}',
  breathing_cue         text,
  tempo_default         text,
  contraindications     text[] not null default '{}',
  default_rest_seconds  integer not null default 90,
  load_step_kg          numeric(5,2) not null default 2.5,
  publish_state         publish_state not null default 'published',
  approved_by           uuid references users(id) on delete set null,
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create unique index exercises_platform_code_key on exercises (code) where organization_id is null;
create unique index exercises_org_code_key on exercises (organization_id, code) where organization_id is not null;
create index exercises_pattern_idx on exercises (movement_pattern) where deleted_at is null;
comment on table exercises is
  'Approved exercise content. The AI coach may only describe technique from these rows.';

create table exercise_media (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  exercise_id       uuid not null references exercises(id) on delete cascade,
  kind              text not null check (kind in ('video','animation','image','audio')),
  storage_key       text not null,
  mime_type         text not null,
  duration_seconds  integer,
  width             integer,
  height            integer,
  byte_size         bigint,
  is_primary        boolean not null default false,
  caption           text,
  locale            locale_code not null default 'en',
  uploaded_by       uuid references users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index exercise_media_exercise_idx on exercise_media (exercise_id);

-- Approved substitution graph. The engine never invents a swap.
create table exercise_substitutions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  exercise_id       uuid not null references exercises(id) on delete cascade,
  alternative_exercise_id uuid not null references exercises(id) on delete cascade,
  reason            text not null default 'equipment'
                      check (reason in ('equipment','difficulty_down','difficulty_up','low_impact','space','injury_friendly','preference')),
  preference_rank   integer not null default 1,
  notes             text,
  approved_by       uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (exercise_id, alternative_exercise_id, reason),
  constraint substitution_distinct check (exercise_id <> alternative_exercise_id)
);

-- ---------------------------------------------------------------------------
-- Workouts and programs
-- ---------------------------------------------------------------------------

create table workouts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete cascade,
  code              citext,
  name              text not null,
  focus             text not null default 'full_body',
  intent            program_intent not null default 'general_fitness',
  estimated_minutes integer not null default 45,
  difficulty        experience_level not null default 'beginner',
  effort_scale      effort_scale not null default 'simple',
  coach_notes       text,
  member_intro      text,
  publish_state     publish_state not null default 'published',
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index workouts_org_idx on workouts (organization_id) where deleted_at is null;

create table workout_blocks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  workout_id        uuid not null references workouts(id) on delete cascade,
  kind              text not null check (kind in ('warmup','main','superset','circuit','finisher','cooldown')),
  label             text not null,
  position          integer not null,
  rounds            integer not null default 1,
  rest_between_rounds_seconds integer not null default 60,
  instructions      text,
  unique (workout_id, position)
);

create table workout_items (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references organizations(id) on delete cascade,
  workout_block_id      uuid not null references workout_blocks(id) on delete cascade,
  exercise_id           uuid not null references exercises(id) on delete restrict,
  position              integer not null,
  target_sets           integer not null default 3 check (target_sets between 1 and 12),
  target_reps_min       integer,
  target_reps_max       integer,
  target_seconds        integer,
  target_distance_m     integer,
  target_rpe            numeric(3,1) check (target_rpe is null or target_rpe between 1 and 10),
  target_rir            integer check (target_rir is null or target_rir between 0 and 6),
  tempo                 text,
  rest_seconds          integer not null default 90,
  load_guidance         text,
  starting_load_kg      numeric(6,2),
  percent_of_1rm_bps    integer,
  allow_substitution    boolean not null default true,
  member_note           text,
  coach_note            text,
  unique (workout_block_id, position),
  constraint workout_item_rep_range check (
    target_reps_min is null or target_reps_max is null or target_reps_max >= target_reps_min
  )
);

create table programs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete cascade,
  scope             program_scope not null default 'platform',
  code              citext not null,
  name              text not null,
  summary           text not null,
  intent            program_intent not null,
  goal              training_goal not null,
  experience_level  experience_level not null default 'beginner',
  days_per_week     integer not null check (days_per_week between 1 and 7),
  session_minutes   integer not null default 45,
  total_weeks       integer not null default 8,
  requires_equipment_codes text[] not null default '{}',
  low_impact        boolean not null default false,
  ramadan_friendly  boolean not null default false,
  contraindications text[] not null default '{}',
  cover_image_url   text,
  publish_state     publish_state not null default 'published',
  approved_by       uuid references users(id) on delete set null,
  approved_at       timestamptz,
  derived_from_program_id uuid references programs(id) on delete set null,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create unique index programs_platform_code_key on programs (code) where organization_id is null;
create unique index programs_org_code_key on programs (organization_id, code) where organization_id is not null;
create index programs_lookup_idx on programs (goal, experience_level, days_per_week) where publish_state = 'published';

create table program_versions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  program_id        uuid not null references programs(id) on delete cascade,
  version           integer not null,
  changelog         text not null default 'Initial version',
  publish_state     publish_state not null default 'published',
  published_at      timestamptz,
  published_by      uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (program_id, version)
);

create table program_phases (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  program_version_id uuid not null references program_versions(id) on delete cascade,
  position          integer not null,
  name              text not null,
  focus             text not null,
  weeks             integer not null default 4 check (weeks between 1 and 26),
  progression_rule  text not null default 'double_progression'
                      check (progression_rule in ('double_progression','linear_load','rep_progression','rpe_autoregulated','none')),
  deload_at_end     boolean not null default false,
  member_summary    text,
  unique (program_version_id, position)
);

create table program_days (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  program_phase_id  uuid not null references program_phases(id) on delete cascade,
  week_number       integer not null check (week_number >= 1),
  day_number        integer not null check (day_number between 1 and 7),
  workout_id        uuid references workouts(id) on delete restrict,
  is_rest_day       boolean not null default false,
  label             text,
  unique (program_phase_id, week_number, day_number),
  constraint program_day_has_content check (is_rest_day or workout_id is not null)
);

create table program_assignments (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid not null references branches(id) on delete restrict,
  user_id               uuid not null references users(id) on delete cascade,
  program_id            uuid not null references programs(id) on delete restrict,
  program_version_id    uuid not null references program_versions(id) on delete restrict,
  assigned_by           uuid references users(id) on delete set null,
  assignment_source     text not null default 'engine'
                          check (assignment_source in ('engine','coach','front_desk','member_choice','migration')),
  state                 text not null default 'active'
                          check (state in ('active','paused','completed','replaced','cancelled')),
  starts_on             date not null default current_date,
  ends_on               date,
  current_week          integer not null default 1,
  current_phase_position integer not null default 1,
  personalisation       jsonb not null default '{}'::jsonb,
  progression_locked    boolean not null default false,
  progression_lock_reason text,
  completed_at          timestamptz,
  replaced_by_assignment_id uuid references program_assignments(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index program_assignments_user_idx on program_assignments (user_id, state);
create unique index program_assignments_one_active on program_assignments (user_id) where state = 'active';

-- ---------------------------------------------------------------------------
-- Logging
-- ---------------------------------------------------------------------------

create table workout_sessions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid references branches(id) on delete set null,
  user_id               uuid not null references users(id) on delete cascade,
  program_assignment_id uuid references program_assignments(id) on delete set null,
  program_day_id        uuid references program_days(id) on delete set null,
  workout_id            uuid references workouts(id) on delete set null,
  title                 text not null,
  state                 session_state not null default 'scheduled',
  scheduled_for         date not null,
  week_number           integer,
  day_number            integer,
  started_at            timestamptz,
  completed_at          timestamptz,
  duration_seconds      integer,
  total_volume_kg       numeric(10,2) not null default 0,
  completed_sets        integer not null default 0,
  prescribed_sets       integer not null default 0,
  session_rpe           numeric(3,1) check (session_rpe is null or session_rpe between 1 and 10),
  mood                  text check (mood in ('great','good','ok','tired','sore','unwell')),
  sleep_hours           numeric(3,1),
  energy_level          integer check (energy_level between 1 and 5),
  discomfort_reported   boolean not null default false,
  member_note           text,
  coach_reviewed_by     uuid references users(id) on delete set null,
  coach_reviewed_at     timestamptz,
  -- offline sync
  client_session_id     text,
  client_recorded_at    timestamptz,
  synced_at             timestamptz,
  sync_source           text not null default 'online' check (sync_source in ('online','offline_queue','staff_entry','import')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index workout_sessions_client_key on workout_sessions (user_id, client_session_id) where client_session_id is not null;
create index workout_sessions_user_date_idx on workout_sessions (user_id, scheduled_for desc);
create index workout_sessions_review_idx on workout_sessions (organization_id, completed_at desc) where discomfort_reported;
comment on index workout_sessions_client_key is
  'Idempotency for offline sync: replaying a queued session is a no-op, not a duplicate.';

create table set_logs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  workout_session_id  uuid not null references workout_sessions(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  workout_item_id     uuid references workout_items(id) on delete set null,
  exercise_id         uuid not null references exercises(id) on delete restrict,
  substituted_for_exercise_id uuid references exercises(id) on delete set null,
  set_number          integer not null check (set_number between 1 and 30),
  target_reps_min     integer,
  target_reps_max     integer,
  reps_completed      integer check (reps_completed is null or reps_completed between 0 and 500),
  weight_kg           numeric(6,2) check (weight_kg is null or weight_kg between 0 and 600),
  seconds_held        integer,
  distance_m          integer,
  rpe                 numeric(3,1) check (rpe is null or rpe between 1 and 10),
  rir                 integer check (rir is null or rir between 0 and 10),
  rest_taken_seconds  integer,
  is_warmup           boolean not null default false,
  skipped             boolean not null default false,
  skip_reason         text,
  discomfort_level    integer check (discomfort_level between 0 and 10),
  discomfort_area     text,
  note                text,
  logged_at           timestamptz not null default now(),
  client_set_id       text,
  created_at          timestamptz not null default now(),
  unique (workout_session_id, workout_item_id, set_number)
);
create index set_logs_exercise_history_idx on set_logs (user_id, exercise_id, logged_at desc);

create table personal_records (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  exercise_id       uuid not null references exercises(id) on delete cascade,
  record_kind       text not null check (record_kind in ('max_weight','max_reps','best_e1rm','max_volume','max_duration')),
  value             numeric(10,2) not null,
  unit              text not null default 'kg',
  reps              integer,
  weight_kg         numeric(6,2),
  set_log_id        uuid references set_logs(id) on delete set null,
  achieved_at       timestamptz not null default now(),
  previous_value    numeric(10,2),
  created_at        timestamptz not null default now(),
  unique (user_id, exercise_id, record_kind, achieved_at)
);
create index personal_records_user_idx on personal_records (user_id, achieved_at desc);

-- ---------------------------------------------------------------------------
-- Coaching engine decisions
-- ---------------------------------------------------------------------------

create table coaching_recommendations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  user_id               uuid not null references users(id) on delete cascade,
  program_assignment_id uuid references program_assignments(id) on delete cascade,
  workout_item_id       uuid references workout_items(id) on delete set null,
  exercise_id           uuid references exercises(id) on delete set null,
  rule_id               text not null,
  rule_version          text not null default '1.0.0',
  kind                  text not null check (kind in ('progress_load','progress_reps','hold','reduce_volume','deload','substitute_exercise','reschedule_week','shorten_week','stop_progression','staff_review')),
  rationale             text not null,
  evidence              jsonb not null default '{}'::jsonb,
  before_value          jsonb,
  after_value           jsonb,
  requires_staff_approval boolean not null default false,
  state                 text not null default 'proposed'
                          check (state in ('proposed','auto_applied','approved','rejected','overridden','expired')),
  decided_by            uuid references users(id) on delete set null,
  decided_at            timestamptz,
  decision_note         text,
  applied_at            timestamptz,
  created_at            timestamptz not null default now()
);
create index coaching_recommendations_user_idx on coaching_recommendations (user_id, created_at desc);
create index coaching_recommendations_pending_idx on coaching_recommendations (organization_id, created_at desc) where state = 'proposed';
comment on table coaching_recommendations is
  'Every automated coaching decision with the rule that produced it and before/after values.';

-- ---------------------------------------------------------------------------
-- Goals, metrics, photos, check-ins, habits
-- ---------------------------------------------------------------------------

create table goals (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  kind              training_goal not null,
  headline          text not null,
  metric_key        text,
  start_value       numeric(10,2),
  target_value      numeric(10,2),
  current_value     numeric(10,2),
  unit              text,
  target_date       date,
  state             text not null default 'active' check (state in ('active','achieved','revised','abandoned')),
  set_by            uuid references users(id) on delete set null,
  achieved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index goals_user_idx on goals (user_id, state);

create table metric_definitions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  key               citext not null,
  label             text not null,
  unit              text not null,
  kind              text not null default 'body' check (kind in ('body','performance','lifestyle','nutrition')),
  min_value         numeric(10,2),
  max_value         numeric(10,2),
  higher_is_better  boolean,
  is_sensitive      boolean not null default false,
  precision_digits  integer not null default 1,
  sort_order        integer not null default 0
);
create unique index metric_definitions_platform_key on metric_definitions (key) where organization_id is null;
create unique index metric_definitions_org_key on metric_definitions (organization_id, key) where organization_id is not null;

create table metric_logs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  metric_definition_id uuid not null references metric_definitions(id) on delete restrict,
  value             numeric(10,2) not null,
  unit              text not null,
  measured_on       date not null default current_date,
  source            text not null default 'member' check (source in ('member','staff','device','import')),
  recorded_by       uuid references users(id) on delete set null,
  note              text,
  created_at        timestamptz not null default now(),
  unique (user_id, metric_definition_id, measured_on)
);
create index metric_logs_user_metric_idx on metric_logs (user_id, metric_definition_id, measured_on desc);

create table progress_photos (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  storage_key       text not null,
  pose              text not null default 'front' check (pose in ('front','side','back','other')),
  taken_on          date not null default current_date,
  consent_id        uuid references consents(id) on delete set null,
  shared_with_coach boolean not null default false,
  byte_size         bigint,
  mime_type         text not null default 'image/jpeg',
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index progress_photos_user_idx on progress_photos (user_id, taken_on desc) where deleted_at is null;
comment on column progress_photos.shared_with_coach is
  'Photos are private by default. Staff access needs this flag AND progress_photos.read.';

create table check_ins (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  coach_id          uuid references users(id) on delete set null,
  week_starting     date not null,
  kind              text not null default 'weekly' check (kind in ('weekly','monthly','nutrition','onboarding')),
  state             text not null default 'pending' check (state in ('pending','submitted','reviewed','skipped')),
  adherence_percent integer check (adherence_percent between 0 and 100),
  workouts_completed integer,
  workouts_planned  integer,
  weight_kg         numeric(5,2),
  sleep_quality     integer check (sleep_quality between 1 and 5),
  stress_level      integer check (stress_level between 1 and 5),
  soreness_level    integer check (soreness_level between 1 and 5),
  energy_level      integer check (energy_level between 1 and 5),
  nutrition_adherence integer check (nutrition_adherence between 1 and 5),
  wins              text,
  blockers          text,
  member_question   text,
  ai_summary        text,
  ai_summary_generated_at timestamptz,
  coach_response    text,
  responded_at      timestamptz,
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, week_starting, kind)
);
create index check_ins_review_queue_idx on check_ins (organization_id, week_starting desc) where state = 'submitted';

create table habits (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  key               citext not null,
  label             text not null,
  target_value      numeric(8,2) not null default 1,
  unit              text not null default 'count',
  cadence           text not null default 'daily' check (cadence in ('daily','weekly')),
  is_active         boolean not null default true,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, key)
);

create table habit_logs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  habit_id          uuid not null references habits(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  logged_on         date not null default current_date,
  value             numeric(8,2) not null default 1,
  completed         boolean not null default true,
  note              text,
  created_at        timestamptz not null default now(),
  unique (habit_id, logged_on)
);
create index habit_logs_user_idx on habit_logs (user_id, logged_on desc);

select app.attach_touch(t) from (values
  ('equipment'::regclass), ('branch_equipment'), ('exercises'), ('workouts'), ('programs'),
  ('program_assignments'), ('workout_sessions'), ('goals'), ('check_ins'), ('habits')
) as v(t);
