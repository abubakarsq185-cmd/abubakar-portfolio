-- ===========================================================================
-- 0009_rls.sql
-- Row-level security. This is the last line of defence behind the API's own
-- authorization checks (defence in depth, see docs/SECURITY.md).
--
-- Reading model:
--   * staff_scope(org, branch)  — a staff actor inside their org + branch scope
--   * member_row_visible(...)   — the member themself, or staff allowed to see
--                                 that specific member
--   * health_row_visible(...)   — the member themself, staff with health.read,
--                                 or a guardian with explicit health consent
--   * catalogue tables          — rows with organization_id IS NULL are the
--                                 platform library: readable by everyone,
--                                 writable only by platform admins
-- ===========================================================================

create or replace function app.is_staff()
returns boolean language sql stable as $$
  select app.is_platform_admin()
      or app.current_role() in ('gym_owner','branch_manager','coach','front_desk','nutrition_professional');
$$;

create or replace function app.staff_scope(org uuid, branch uuid)
returns boolean language sql stable as $$
  select app.is_staff() and app.in_tenant_scope(org, branch);
$$;

-- Can the current actor see this specific member? Coaches and nutrition
-- professionals are limited to their assigned caseload.
-- SECURITY DEFINER so the lookup itself is not subject to RLS (which would
-- recurse while evaluating a policy).
create or replace function app.can_access_member(target uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
declare
  rec record;
begin
  if target is null then
    return false;
  end if;
  if app.is_platform_admin() then
    return true;
  end if;
  if target = app.current_user_id() then
    return true;
  end if;

  if not app.is_staff() then
    -- Guardian / family payer: linked dependents only.
    return exists (
      select 1 from family_links fl
      where fl.dependent_user_id = target
        and fl.payer_user_id = app.current_user_id()
    );
  end if;

  select mp.organization_id, mp.branch_id, mp.assigned_coach_id, mp.assigned_nutritionist_id
    into rec
  from member_profiles mp
  where mp.user_id = target
    and mp.deleted_at is null;

  if not found then
    -- Not a member (staff-to-staff row). Same-organization staff is enough.
    return exists (
      select 1 from users u
      where u.id = target and u.organization_id = app.current_organization_id()
    );
  end if;

  if rec.organization_id is distinct from app.current_organization_id() then
    return false;
  end if;
  if not app.can_touch_branch(rec.branch_id) then
    return false;
  end if;
  if app.has_permission('members.read.all') then
    return true;
  end if;
  if app.has_permission('members.read.assigned') then
    return rec.assigned_coach_id = app.current_user_id()
        or rec.assigned_nutritionist_id = app.current_user_id();
  end if;
  return false;
end;
$$;

create or replace function app.member_row_visible(org uuid, branch uuid, member uuid)
returns boolean language sql stable as $$
  select app.is_self(member)
      or (app.in_tenant_scope(org, branch) and app.can_access_member(member));
$$;

-- Health, screening and restricted clinical context.
create or replace function app.health_row_visible(org uuid, member uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app
as $$
begin
  if app.is_self(member) then
    return true;
  end if;
  if app.is_platform_admin() then
    -- Platform support never gets silent health access: an active, scoped
    -- support session with a reason is required.
    return exists (
      select 1 from support_access_sessions s
      where s.organization_id = org
        and s.platform_user_id = app.current_user_id()
        and s.ended_at is null
        and s.expires_at > now()
    );
  end if;
  if app.is_staff() then
    return org = app.current_organization_id()
       and app.has_permission('health.read')
       and app.can_access_member(member);
  end if;
  -- Guardian with explicit health consent.
  return exists (
    select 1 from family_links fl
    where fl.dependent_user_id = member
      and fl.payer_user_id = app.current_user_id()
      and fl.can_view_health
  );
end;
$$;

create or replace function app.catalogue_readable(org uuid)
returns boolean language sql stable as $$
  select org is null or org = app.current_organization_id() or app.is_platform_admin();
$$;

create or replace function app.catalogue_writable(org uuid)
returns boolean language sql stable as $$
  select (org is null and app.is_platform_admin())
      or (org is not null and app.staff_scope(org, null) and app.has_permission('content.write'));
$$;

-- ---------------------------------------------------------------------------
-- Policy generators
-- ---------------------------------------------------------------------------

create or replace function app.rls_enable(tbl regclass)
returns void language plpgsql as $$
begin
  execute format('alter table %s enable row level security', tbl);
end;
$$;

-- Staff-scoped table: organization (+ optional branch) isolation.
create or replace function app.rls_staff_table(tbl regclass, branch_col text default 'null::uuid')
returns void language plpgsql as $$
begin
  perform app.rls_enable(tbl);
  execute format(
    'create policy tenant_rw on %s using (app.staff_scope(organization_id, %s)) with check (app.staff_scope(organization_id, %s))',
    tbl, branch_col, branch_col);
end;
$$;

-- Member-owned table: the member plus staff allowed to see that member.
create or replace function app.rls_member_table(tbl regclass, member_col text default 'user_id', branch_col text default 'null::uuid')
returns void language plpgsql as $$
begin
  perform app.rls_enable(tbl);
  execute format(
    'create policy member_rw on %s using (app.member_row_visible(organization_id, %s, %s)) with check (app.member_row_visible(organization_id, %s, %s))',
    tbl, branch_col, member_col, branch_col, member_col);
end;
$$;

-- Shared catalogue (platform rows + per-org rows).
create or replace function app.rls_catalogue_table(tbl regclass)
returns void language plpgsql as $$
begin
  perform app.rls_enable(tbl);
  execute format('create policy catalogue_read on %s for select using (app.catalogue_readable(organization_id))', tbl);
  execute format('create policy catalogue_write on %s for insert with check (app.catalogue_writable(organization_id))', tbl);
  execute format('create policy catalogue_update on %s for update using (app.catalogue_writable(organization_id)) with check (app.catalogue_writable(organization_id))', tbl);
  execute format('create policy catalogue_delete on %s for delete using (app.catalogue_writable(organization_id))', tbl);
end;
$$;

-- ---------------------------------------------------------------------------
-- Apply: staff-scoped tables
-- ---------------------------------------------------------------------------

select app.rls_staff_table(t, b) from (values
  ('branches'::regclass,               'id'),
  ('brand_themes',                     'null::uuid'),
  ('organization_feature_flags',        'null::uuid'),
  ('organization_subscriptions',        'null::uuid'),
  ('usage_records',                     'null::uuid'),
  ('staff_assignments',                 'branch_id'),
  ('leads',                             'branch_id'),
  ('trials',                            'branch_id'),
  ('tags',                              'null::uuid'),
  ('taggings',                          'null::uuid'),
  ('tasks',                             'branch_id'),
  ('membership_plans',                  'null::uuid'),
  ('promotions',                        'null::uuid'),
  ('membership_changes',                'null::uuid'),
  ('rooms',                             'branch_id'),
  ('classes',                           'branch_id'),
  ('class_sessions',                    'branch_id'),
  ('automations',                        'branch_id'),
  ('automation_runs',                   'null::uuid'),
  ('notification_preferences',           'null::uuid'),
  ('integration_connections',            'branch_id'),
  ('data_requests',                      'null::uuid'),
  ('grocery_lists',                      'null::uuid')
) as v(t, b);

-- ---------------------------------------------------------------------------
-- Apply: member-owned tables
-- ---------------------------------------------------------------------------

select app.rls_member_table(t, 'user_id', b) from (values
  ('member_profiles'::regclass,  'branch_id'),
  ('emergency_contacts',         'null::uuid'),
  ('waivers',                    'branch_id'),
  ('member_memberships',         'branch_id'),
  ('invoices',                   'branch_id'),
  ('payments',                   'branch_id'),
  ('payment_attempts',           'null::uuid'),
  ('program_assignments',        'branch_id'),
  ('workout_sessions',           'null::uuid'),
  ('set_logs',                   'null::uuid'),
  ('personal_records',           'null::uuid'),
  ('coaching_recommendations',   'null::uuid'),
  ('goals',                      'null::uuid'),
  ('metric_logs',                'null::uuid'),
  ('check_ins',                  'null::uuid'),
  ('habits',                     'null::uuid'),
  ('habit_logs',                 'null::uuid'),
  ('meal_logs',                  'null::uuid'),
  ('bookings',                   'branch_id'),
  ('waitlist_entries',           'null::uuid'),
  ('attendance',                 'branch_id'),
  ('access_credentials',         'null::uuid'),
  ('notifications',              'null::uuid')
) as v(t, b);

-- ---------------------------------------------------------------------------
-- Apply: catalogue tables (platform + tenant rows)
-- ---------------------------------------------------------------------------

select app.rls_catalogue_table(t) from (values
  ('equipment'::regclass), ('exercises'), ('exercise_media'), ('exercise_substitutions'),
  ('workouts'), ('workout_blocks'), ('workout_items'), ('programs'), ('program_versions'),
  ('program_phases'), ('program_days'), ('food_items'), ('food_substitutions'),
  ('recipes'), ('recipe_items'), ('metric_definitions'), ('notification_templates'),
  ('file_assets')
) as v(t);

-- branch_equipment is tenant-only.
select app.rls_staff_table('branch_equipment'::regclass, 'branch_id');

-- ---------------------------------------------------------------------------
-- Hand-written policies for tables with special rules
-- ---------------------------------------------------------------------------

-- Organizations: your own tenant, or the whole platform for platform admins.
select app.rls_enable('organizations'::regclass);
create policy org_self_read on organizations for select
  using (app.is_platform_admin() or id = app.current_organization_id());
create policy org_self_update on organizations for update
  using (app.is_platform_admin() or (id = app.current_organization_id() and app.has_permission('organization.settings.write')))
  with check (app.is_platform_admin() or id = app.current_organization_id());
create policy org_platform_insert on organizations for insert
  with check (app.is_platform_admin());

-- Users: yourself, your organization's staff view, guardians, platform admins.
select app.rls_enable('users'::regclass);
create policy users_read on users for select using (
  app.is_platform_admin()
  or app.is_self(id)
  or (app.is_staff() and organization_id = app.current_organization_id())
  or exists (
    select 1 from family_links fl
    where fl.dependent_user_id = users.id and fl.payer_user_id = app.current_user_id()
  )
);
create policy users_self_update on users for update
  using (app.is_platform_admin() or app.is_self(id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('members.write')))
  with check (app.is_platform_admin() or app.is_self(id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('members.write')));
create policy users_staff_insert on users for insert with check (
  app.is_platform_admin()
  or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('members.write'))
);

-- Roles / permissions catalogue: readable by any authenticated actor,
-- writable only by the platform.
select app.rls_enable('roles'::regclass);
create policy roles_read on roles for select using (app.current_user_id() is not null);
select app.rls_enable('permissions'::regclass);
create policy permissions_read on permissions for select using (app.current_user_id() is not null);
select app.rls_enable('role_permissions'::regclass);
create policy role_permissions_read on role_permissions for select using (app.current_user_id() is not null);

select app.rls_enable('user_roles'::regclass);
create policy user_roles_rw on user_roles
  using (app.is_platform_admin() or app.is_self(user_id)
         or (app.is_staff() and organization_id = app.current_organization_id()))
  with check (app.is_platform_admin()
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write')));

select app.rls_enable('user_permission_grants'::regclass);
create policy user_permission_grants_rw on user_permission_grants
  using (app.is_platform_admin() or app.is_self(user_id)
         or (app.is_staff() and organization_id = app.current_organization_id()))
  with check (app.is_platform_admin()
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write')));

-- Sessions: your own only. Server code uses the owner connection for lookup.
select app.rls_enable('auth_sessions'::regclass);
create policy auth_sessions_self on auth_sessions
  using (app.is_platform_admin() or app.is_self(user_id))
  with check (app.is_self(user_id));

-- Platform-only tables.
select app.rls_enable('feature_flags'::regclass);
create policy feature_flags_read on feature_flags for select using (app.current_user_id() is not null);
create policy feature_flags_write on feature_flags for all
  using (app.is_platform_admin()) with check (app.is_platform_admin());

select app.rls_enable('subscription_plans'::regclass);
create policy subscription_plans_read on subscription_plans for select using (true);
create policy subscription_plans_write on subscription_plans for all
  using (app.is_platform_admin()) with check (app.is_platform_admin());

select app.rls_enable('platform_invoices'::regclass);
create policy platform_invoices_read on platform_invoices for select
  using (app.is_platform_admin()
         or (organization_id = app.current_organization_id() and app.has_permission('platform_billing.read')));
create policy platform_invoices_write on platform_invoices for all
  using (app.is_platform_admin()) with check (app.is_platform_admin());

select app.rls_enable('support_access_sessions'::regclass);
create policy support_sessions_read on support_access_sessions for select
  using (app.is_platform_admin()
         or (organization_id = app.current_organization_id() and app.has_permission('organization.settings.write')));
create policy support_sessions_write on support_access_sessions for all
  using (app.is_platform_admin()) with check (app.is_platform_admin());

-- Audit log: readable inside the tenant with the audit permission; inserts are
-- allowed for any in-scope actor (the app always writes its own trail).
select app.rls_enable('audit_logs'::regclass);
create policy audit_read on audit_logs for select using (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id() and app.has_permission('audit.read'))
  or app.is_self(subject_user_id)
);
create policy audit_insert on audit_logs for insert with check (
  app.is_platform_admin() or organization_id = app.current_organization_id()
);

-- Ledger: financial permission required. Append-only enforced by trigger.
select app.rls_enable('ledger_entries'::regclass);
create policy ledger_read on ledger_entries for select using (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id()
      and app.can_touch_branch(branch_id)
      and app.has_permission('finance.read'))
);
create policy ledger_insert on ledger_entries for insert with check (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id() and app.has_permission('finance.write'))
);

-- Invoice lines follow their invoice.
select app.rls_enable('invoice_lines'::regclass);
create policy invoice_lines_rw on invoice_lines using (
  exists (select 1 from invoices i where i.id = invoice_lines.invoice_id)
) with check (
  exists (select 1 from invoices i where i.id = invoice_lines.invoice_id)
);

select app.rls_enable('refunds'::regclass);
create policy refunds_rw on refunds using (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id()
      and (app.has_permission('finance.read') or exists (
            select 1 from payments p where p.id = refunds.payment_id and app.is_self(p.user_id))))
) with check (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id() and app.has_permission('finance.refund'))
);

select app.rls_enable('membership_freezes'::regclass);
create policy membership_freezes_rw on membership_freezes using (
  app.is_platform_admin()
  or exists (select 1 from member_memberships m where m.id = membership_freezes.member_membership_id)
) with check (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id() and app.has_permission('memberships.write'))
);

-- Health & risk: the strictest tier.
select app.rls_enable('health_screenings'::regclass);
create policy health_screenings_rw on health_screenings
  using (app.health_row_visible(organization_id, user_id))
  with check (app.is_self(user_id)
              or (organization_id = app.current_organization_id() and app.has_permission('health.write')));

select app.rls_enable('risk_flags'::regclass);
create policy risk_flags_read on risk_flags for select
  using (app.health_row_visible(organization_id, user_id));
create policy risk_flags_write on risk_flags for insert
  with check (app.is_self(user_id)
              or (organization_id = app.current_organization_id() and app.has_permission('health.write')));
create policy risk_flags_update on risk_flags for update
  using (organization_id = app.current_organization_id() and app.has_permission('health.write'))
  with check (organization_id = app.current_organization_id() and app.has_permission('health.write'));

-- Consent evidence: your own, or staff who may collect it.
select app.rls_enable('consents'::regclass);
create policy consents_read on consents for select using (
  app.is_self(user_id)
  or (app.staff_scope(organization_id, null) and app.can_access_member(user_id))
);
create policy consents_insert on consents for insert with check (
  app.is_self(user_id)
  or (app.staff_scope(organization_id, null) and app.has_permission('consent.collect'))
);

-- Progress photos: private unless shared, and gated by a sensitive permission.
select app.rls_enable('progress_photos'::regclass);
create policy progress_photos_read on progress_photos for select using (
  app.is_self(user_id)
  or (shared_with_coach
      and app.staff_scope(organization_id, null)
      and app.has_permission('progress_photos.read')
      and app.can_access_member(user_id))
);
create policy progress_photos_write on progress_photos for all
  using (app.is_self(user_id)) with check (app.is_self(user_id));

-- Notes: visibility tiers.
select app.rls_enable('notes'::regclass);
create policy notes_read on notes for select using (
  app.is_platform_admin()
  or (visibility = 'member_visible' and entity_type = 'member' and app.is_self(entity_id))
  or (app.staff_scope(organization_id, branch_id) and (
        visibility = 'staff'
        or (visibility = 'coach_only' and app.has_permission('notes.coach.read'))
        or (visibility = 'restricted' and app.has_permission('notes.restricted.read'))
     ))
);
create policy notes_write on notes for all
  using (app.staff_scope(organization_id, branch_id) and app.has_permission('notes.write'))
  with check (app.staff_scope(organization_id, branch_id) and app.has_permission('notes.write'));

-- Family links.
select app.rls_enable('family_links'::regclass);
create policy family_links_read on family_links for select using (
  app.is_platform_admin()
  or app.is_self(payer_user_id) or app.is_self(dependent_user_id)
  or app.staff_scope(organization_id, null)
);
create policy family_links_write on family_links for all
  using (app.staff_scope(organization_id, null) and app.has_permission('members.write'))
  with check (app.staff_scope(organization_id, null) and app.has_permission('members.write'));

-- Nutrition: the member, their nutrition professional, or a coach with the
-- nutrition permission.
select app.rls_enable('nutrition_targets'::regclass);
create policy nutrition_targets_rw on nutrition_targets
  using (app.is_self(user_id)
         or (app.staff_scope(organization_id, null) and app.has_permission('nutrition.read') and app.can_access_member(user_id)))
  with check (app.is_self(user_id)
         or (app.staff_scope(organization_id, null) and app.has_permission('nutrition.write')));

select app.rls_enable('meal_plans'::regclass);
create policy meal_plans_rw on meal_plans
  using (app.is_platform_admin()
         or (is_template and organization_id = app.current_organization_id())
         or app.is_self(user_id)
         or (app.staff_scope(organization_id, null) and app.has_permission('nutrition.read') and app.can_access_member(user_id)))
  with check (app.is_self(user_id)
         or (app.staff_scope(organization_id, null) and app.has_permission('nutrition.write')));

select app.rls_enable('meal_plan_entries'::regclass);
create policy meal_plan_entries_rw on meal_plan_entries
  using (exists (select 1 from meal_plans mp where mp.id = meal_plan_entries.meal_plan_id))
  with check (exists (select 1 from meal_plans mp where mp.id = meal_plan_entries.meal_plan_id));

-- Support cases: the member, or staff (health detail needs health.read).
select app.rls_enable('support_cases'::regclass);
create policy support_cases_read on support_cases for select using (
  app.is_self(member_user_id)
  or (app.staff_scope(organization_id, branch_id)
      and app.has_permission('support.read')
      and (not contains_health_data or app.has_permission('health.read')))
);
create policy support_cases_insert on support_cases for insert with check (
  app.is_self(member_user_id) or app.staff_scope(organization_id, branch_id)
);
create policy support_cases_update on support_cases for update
  using (app.staff_scope(organization_id, branch_id) and app.has_permission('support.write'))
  with check (app.staff_scope(organization_id, branch_id) and app.has_permission('support.write'));

-- Conversations & messages: participants only.
select app.rls_enable('conversations'::regclass);
create policy conversations_read on conversations for select using (
  app.is_platform_admin()
  or app.is_self(member_user_id)
  or exists (select 1 from conversation_participants cp
             where cp.conversation_id = conversations.id and cp.user_id = app.current_user_id())
  or (is_broadcast and organization_id = app.current_organization_id())
  or (app.staff_scope(organization_id, branch_id) and app.has_permission('messaging.read'))
);
create policy conversations_write on conversations for all
  using (app.is_self(member_user_id)
         or (app.staff_scope(organization_id, branch_id) and app.has_permission('messaging.write')))
  with check (app.is_self(member_user_id)
         or (app.staff_scope(organization_id, branch_id) and app.has_permission('messaging.write')));

select app.rls_enable('conversation_participants'::regclass);
create policy conversation_participants_rw on conversation_participants
  using (app.is_self(user_id) or app.staff_scope(organization_id, null))
  with check (app.is_self(user_id) or app.staff_scope(organization_id, null));

select app.rls_enable('messages'::regclass);
create policy messages_read on messages for select using (
  exists (select 1 from conversations c where c.id = messages.conversation_id)
);
create policy messages_insert on messages for insert with check (
  exists (select 1 from conversations c where c.id = messages.conversation_id)
  and (app.is_self(sender_user_id) or sender_kind <> 'user')
);

select app.rls_enable('ai_interactions'::regclass);
create policy ai_interactions_read on ai_interactions for select using (
  app.is_self(user_id)
  or app.is_self(subject_user_id)
  or (app.staff_scope(organization_id, null) and app.has_permission('ai.logs.read'))
);
create policy ai_interactions_insert on ai_interactions for insert with check (
  organization_id = app.current_organization_id()
);
create policy ai_interactions_update on ai_interactions for update
  using (app.is_self(user_id)) with check (app.is_self(user_id));

-- Webhooks, jobs, analytics, errors: service-side surfaces.
select app.rls_enable('webhook_events'::regclass);
create policy webhook_events_read on webhook_events for select using (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id() and app.has_permission('integrations.read'))
);
create policy webhook_events_write on webhook_events for all
  using (app.is_platform_admin() or organization_id = app.current_organization_id())
  with check (app.is_platform_admin() or organization_id is null or organization_id = app.current_organization_id());

select app.rls_enable('job_queue'::regclass);
create policy job_queue_rw on job_queue
  using (app.is_platform_admin() or organization_id = app.current_organization_id())
  with check (app.is_platform_admin() or organization_id = app.current_organization_id());

select app.rls_enable('analytics_events'::regclass);
create policy analytics_insert on analytics_events for insert with check (
  organization_id is null or organization_id = app.current_organization_id()
);
create policy analytics_read on analytics_events for select using (
  app.is_platform_admin()
  or (organization_id = app.current_organization_id() and app.has_permission('reports.read'))
);

select app.rls_enable('error_events'::regclass);
create policy error_events_insert on error_events for insert with check (true);
create policy error_events_read on error_events for select using (app.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Application role
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'gymguide_app') then
    create role gymguide_app nologin noinherit;
  end if;
end
$$;

-- The app role must never bypass RLS.
alter role gymguide_app nobypassrls;

grant usage on schema public, app to gymguide_app;
grant execute on all functions in schema app to gymguide_app;
grant select, insert, update, delete on all tables in schema public to gymguide_app;
grant usage, select on all sequences in schema public to gymguide_app;

-- Append-only tables: no update/delete even for the app role.
revoke update, delete on audit_logs, ledger_entries, consents from gymguide_app;

alter default privileges in schema public
  grant select, insert, update, delete on tables to gymguide_app;
alter default privileges in schema public
  grant usage, select on sequences to gymguide_app;
alter default privileges in schema app
  grant execute on functions to gymguide_app;
