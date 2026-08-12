-- ===========================================================================
-- 0001_foundation.sql
-- Extensions, the `app` helper schema, enums, and the shared trigger plumbing
-- every later migration depends on.
--
-- Tenancy contract (see docs/SECURITY.md):
--   The application connects as a NON-superuser role without BYPASSRLS and
--   opens every request inside a transaction that sets:
--     app.user_id, app.organization_id, app.role, app.branch_ids,
--     app.permissions, app.is_platform_admin
--   Row-level security reads those GUCs. If they are unset every tenant
--   policy evaluates to false, so an unauthenticated connection sees nothing.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create schema if not exists app;

comment on schema app is
  'Helper functions for row-level security and tenancy. No business tables.';

-- ---------------------------------------------------------------------------
-- Request context accessors
-- ---------------------------------------------------------------------------

create or replace function app.setting_text(key text)
returns text language sql stable as $$
  select nullif(current_setting(key, true), '');
$$;

create or replace function app.current_user_id()
returns uuid language sql stable as $$
  select app.setting_text('app.user_id')::uuid;
$$;

create or replace function app.current_organization_id()
returns uuid language sql stable as $$
  select app.setting_text('app.organization_id')::uuid;
$$;

create or replace function app.current_role()
returns text language sql stable as $$
  select coalesce(app.setting_text('app.role'), 'anonymous');
$$;

create or replace function app.is_platform_admin()
returns boolean language sql stable as $$
  select coalesce(app.setting_text('app.is_platform_admin')::boolean, false);
$$;

-- Branch ids the actor may touch. Empty array == every branch in the org
-- (owners and org-wide staff), which keeps the policy expression uniform.
create or replace function app.current_branch_ids()
returns uuid[] language sql stable as $$
  select coalesce(
    string_to_array(coalesce(app.setting_text('app.branch_ids'), ''), ',')::uuid[],
    '{}'::uuid[]
  );
$$;

create or replace function app.branch_scope_is_global()
returns boolean language sql stable as $$
  select cardinality(app.current_branch_ids()) = 0;
$$;

create or replace function app.can_touch_branch(target uuid)
returns boolean language sql stable as $$
  select target is null
      or app.branch_scope_is_global()
      or target = any (app.current_branch_ids());
$$;

create or replace function app.current_permissions()
returns text[] language sql stable as $$
  select coalesce(
    string_to_array(coalesce(app.setting_text('app.permissions'), ''), ','),
    '{}'::text[]
  );
$$;

create or replace function app.has_permission(needle text)
returns boolean language sql stable as $$
  select app.is_platform_admin()
      or needle = any (app.current_permissions())
      or '*' = any (app.current_permissions());
$$;

-- The workhorse: is this row inside the actor's organization + branch scope?
create or replace function app.in_tenant_scope(org uuid, branch uuid)
returns boolean language sql stable as $$
  select app.is_platform_admin()
      or (org is not null
          and org = app.current_organization_id()
          and app.can_touch_branch(branch));
$$;

create or replace function app.is_self(target uuid)
returns boolean language sql stable as $$
  select target is not null and target = app.current_user_id();
$$;

-- ---------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Append-only guard for audit style tables.
create or replace function app.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'table %.% is append-only (attempted %)',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

create or replace function app.attach_touch(target regclass)
returns void language plpgsql as $$
declare
  tname text := split_part(target::text, '.', greatest(1, array_length(string_to_array(target::text, '.'), 1)));
begin
  execute format(
    'create trigger trg_%s_touch before update on %s for each row execute function app.touch_updated_at()',
    replace(tname, '"', ''), target);
end;
$$;

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------

create type role_code as enum (
  'platform_super_admin',
  'gym_owner',
  'branch_manager',
  'coach',
  'front_desk',
  'nutrition_professional',
  'member',
  'guardian'
);

create type user_status as enum ('invited', 'active', 'suspended', 'archived');

create type locale_code as enum ('en', 'ur', 'ur_rm');

create type unit_system as enum ('metric', 'imperial');

create type lifecycle_stage as enum (
  'lead', 'trial', 'active', 'frozen', 'expired', 'cancelled', 'churned'
);

create type lead_status as enum (
  'new', 'contacted', 'trial_booked', 'trial_attended', 'converted', 'lost'
);

create type training_goal as enum (
  'fat_loss', 'weight_gain', 'muscle_gain', 'bulking', 'recomposition',
  'strength', 'general_fitness', 'endurance', 'beginner_confidence', 'maintenance'
);

create type experience_level as enum ('first_time', 'beginner', 'intermediate', 'advanced');

create type program_intent as enum (
  'beginner_induction', 'fat_loss', 'hypertrophy', 'weight_gain', 'strength',
  'general_fitness', 'home', 'hybrid', 'low_impact', 'ramadan', 'class_support'
);

create type program_scope as enum ('platform', 'organization', 'branch', 'member');

create type publish_state as enum ('draft', 'in_review', 'published', 'archived');

create type session_state as enum ('scheduled', 'in_progress', 'completed', 'skipped', 'expired');

create type effort_scale as enum ('rpe', 'rir', 'simple');

create type billing_interval as enum ('one_time', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual');

create type membership_state as enum (
  'pending', 'active', 'frozen', 'past_due', 'cancelled', 'expired', 'trial'
);

create type invoice_state as enum ('draft', 'open', 'paid', 'partially_paid', 'void', 'uncollectible', 'refunded');

create type payment_state as enum ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'cancelled');

create type payment_method_kind as enum ('cash', 'bank_transfer', 'card', 'wallet', 'qr', 'cheque', 'credit_note', 'other');

create type ledger_direction as enum ('debit', 'credit');

create type ledger_account as enum (
  'accounts_receivable', 'cash', 'bank', 'card_clearing', 'wallet_clearing',
  'membership_revenue', 'joining_fee_revenue', 'class_revenue', 'pt_revenue',
  'product_revenue', 'discounts', 'refunds', 'tax_payable', 'deferred_revenue',
  'processor_fees', 'write_off'
);

create type risk_severity as enum ('info', 'low', 'moderate', 'high', 'critical');

create type risk_kind as enum (
  'chest_pain', 'fainting', 'severe_dizziness', 'breathing_difficulty',
  'sharp_or_worsening_pain', 'new_injury', 'surgery_recovery',
  'pregnancy_postpartum', 'medical_condition_clearance', 'eating_disorder_concern',
  'blood_pressure', 'diabetes', 'joint_limitation', 'other'
);

create type case_state as enum ('open', 'acknowledged', 'in_progress', 'waiting_member', 'resolved', 'closed');

create type case_priority as enum ('low', 'normal', 'high', 'urgent');

create type notification_channel as enum ('in_app', 'push', 'email', 'sms', 'whatsapp');

create type notification_state as enum ('queued', 'suppressed', 'sent', 'delivered', 'failed', 'read');

create type consent_kind as enum (
  'terms', 'privacy', 'health_data', 'progress_photos', 'marketing_email',
  'marketing_sms', 'marketing_whatsapp', 'ai_coaching', 'guardian_billing_access'
);

create type booking_state as enum ('booked', 'waitlisted', 'attended', 'late_cancelled', 'cancelled', 'no_show');

create type attendance_method as enum ('qr', 'barcode', 'manual', 'kiosk', 'door_access', 'app');

create type audit_action as enum (
  'create', 'update', 'delete', 'read_sensitive', 'login', 'login_failed',
  'logout', 'role_change', 'permission_grant', 'impersonate_start',
  'impersonate_end', 'payment_record', 'refund', 'consent_capture',
  'consent_withdraw', 'program_assign', 'program_override', 'escalation',
  'export', 'erasure_request', 'ai_output'
);

create type ai_safety_result as enum ('allowed', 'redirected_to_staff', 'blocked_unsafe', 'blocked_out_of_scope');

create type job_state as enum ('pending', 'running', 'succeeded', 'failed', 'dead');
