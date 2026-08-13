-- ===========================================================================
-- 0020_support_access_gates_tenant_data.sql
--
-- Platform staff could read a gym's data without a support session.
--
-- app.health_row_visible() already required an active, reasoned, time-limited
-- support access session before a platform administrator could see health data,
-- and docs/SECURITY.md says so. But app.in_tenant_scope() returned true for a
-- platform administrator unconditionally, and every generated tenant policy is
-- built on it. The result, measured against the demo gym with zero support
-- sessions open: 20 member profiles, 31 users, 68 invoices and 10 notes —
-- including coach-only and restricted notes — readable by support@gymguide.app
-- with no reason recorded, no expiry, and nothing written to the gym's audit
-- trail. `/dashboard/members` rendered the gym's member list by name.
--
-- Health data was the exception that proved the rule was missing everywhere
-- else. This migration applies the same gate to all tenant data: a platform
-- administrator sees a gym's rows only while holding an open, unexpired support
-- access session for that gym.
--
-- Deliberately left alone:
--   * organizations, subscriptions, platform_invoices, feature_flags,
--     subscription_plans — the platform's own business records. Which gyms
--     exist and what they pay is not member data.
--   * rows with organization_id IS NULL — the platform's own content library.
--   * the platform console itself, which reads through the owner connection and
--     never depended on this bypass.
-- ===========================================================================

-- Does the current platform actor hold an open support session for this org?
-- SECURITY DEFINER because policies on tenant tables call it, and reading
-- support_access_sessions through its own policy while evaluating another
-- table's policy is how you get infinite recursion.
create or replace function app.has_support_access(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select org is not null
     and app.is_platform_admin()
     and exists (
       select 1 from support_access_sessions s
       where s.organization_id = org
         and s.platform_user_id = app.current_user_id()
         and s.ended_at is null
         and s.expires_at > now()
     );
$$;

comment on function app.has_support_access(uuid) is
  'An open, unexpired support access session held by the current platform user for this organization. Support access is time-limited and carries a written reason; see support_access_sessions.';

-- The workhorse. Platform staff no longer pass on the flag alone.
create or replace function app.in_tenant_scope(org uuid, branch uuid)
returns boolean language sql stable as $$
  select app.has_support_access(org)
      or (org is not null
          and org = app.current_organization_id()
          and app.can_touch_branch(branch));
$$;

-- A gym's own adapted catalogue is that gym's content. The platform library
-- (organization_id is null) stays readable by everyone, as before.
create or replace function app.catalogue_readable(org uuid)
returns boolean language sql stable as $$
  select org is null
      or org = app.current_organization_id()
      or app.has_support_access(org);
$$;

-- Reaching a specific member needs the same warrant.
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
  -- Unchanged from 0009 apart from this branch: the platform flag alone used to
  -- return true here.
  if app.is_platform_admin() then
    return exists (
      select 1 from users u
      where u.id = target and app.has_support_access(u.organization_id)
    );
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

-- ---------------------------------------------------------------------------
-- Hand-written policies that named the flag directly.
-- ---------------------------------------------------------------------------

drop policy if exists users_read on users;
create policy users_read on users for select using (
  app.is_self(id)
  or app.has_support_access(organization_id)
  or (app.is_staff() and organization_id = app.current_organization_id())
  or exists (
    select 1 from family_links fl
    where fl.dependent_user_id = users.id and fl.payer_user_id = app.current_user_id()
  )
);

drop policy if exists users_self_update on users;
create policy users_self_update on users for update
  using (app.is_self(id)
         or app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('members.write')))
  with check (app.is_self(id)
         or app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('members.write')));

drop policy if exists users_staff_insert on users;
create policy users_staff_insert on users for insert with check (
  app.has_support_access(organization_id)
  or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('members.write'))
);

-- user_roles was split into four granular policies by 0013. Patch those in
-- place. Re-creating a FOR ALL policy here would OR with them and hand every
-- staff member in the organization the DELETE and UPDATE rights that 0013
-- deliberately reserved for staff.roles.write — the same widening that 0012
-- was written to undo.
drop policy if exists user_roles_rw on user_roles;

drop policy if exists user_roles_read on user_roles;
create policy user_roles_read on user_roles for select
  using (app.is_self(user_id)
         or app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id()));

drop policy if exists user_roles_insert on user_roles;
create policy user_roles_insert on user_roles for insert
  with check (app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id()
             and ((app.is_member_facing_role(role_id) and app.has_permission('members.write'))
                  or app.has_permission('staff.roles.write'))));

drop policy if exists user_roles_update on user_roles;
create policy user_roles_update on user_roles for update
  using (app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write')))
  with check (app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write')));

drop policy if exists user_roles_delete on user_roles;
create policy user_roles_delete on user_roles for delete
  using (app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write')));

drop policy if exists user_permission_grants_rw on user_permission_grants;
create policy user_permission_grants_rw on user_permission_grants
  using (app.is_self(user_id)
         or app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id()))
  with check (app.has_support_access(organization_id)
         or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write')));

-- Someone else's session token hash is nobody's support business. Session
-- lookup at sign-in runs on the owner connection and is unaffected.
drop policy if exists auth_sessions_self on auth_sessions;
create policy auth_sessions_self on auth_sessions
  using (app.is_self(user_id))
  with check (app.is_self(user_id));

-- ---------------------------------------------------------------------------
-- The remaining policies that named the flag directly. Each is reproduced
-- exactly as it stood, with `app.is_platform_admin()` replaced by
-- `app.has_support_access(organization_id)`. Nothing else about them changes.
--
-- Not touched, deliberately: organizations, subscription_plans,
-- platform_invoices, feature_flags, support_access_sessions, error_events and
-- the sequence tables. Those are the platform's own records, not a gym's
-- members.
-- ---------------------------------------------------------------------------

drop policy if exists analytics_read on analytics_events;
create policy analytics_read on analytics_events for select
  using (app.has_support_access(organization_id)
         or (organization_id = app.current_organization_id() and app.has_permission('reports.read')));

drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert
  with check (app.has_support_access(organization_id)
              or organization_id = app.current_organization_id());

drop policy if exists audit_read on audit_logs;
create policy audit_read on audit_logs for select
  using (app.has_support_access(organization_id)
         or (organization_id = app.current_organization_id() and app.has_permission('audit.read'))
         or app.is_self(subject_user_id));

drop policy if exists conversations_read on conversations;
create policy conversations_read on conversations for select
  using (app.has_support_access(organization_id)
         or app.is_self(member_user_id)
         or exists (
           select 1 from conversation_participants cp
            where cp.conversation_id = conversations.id and cp.user_id = app.current_user_id()
         )
         or (is_broadcast and organization_id = app.current_organization_id())
         or (app.staff_scope(organization_id, branch_id) and app.has_permission('messaging.read')));

drop policy if exists family_links_read on family_links;
create policy family_links_read on family_links for select
  using (app.has_support_access(organization_id)
         or app.is_self(payer_user_id)
         or app.is_self(dependent_user_id)
         or app.staff_scope(organization_id, null::uuid));

drop policy if exists job_queue_rw on job_queue;
create policy job_queue_rw on job_queue
  using (app.has_support_access(organization_id) or organization_id = app.current_organization_id())
  with check (app.has_support_access(organization_id) or organization_id = app.current_organization_id());

drop policy if exists ledger_insert on ledger_entries;
create policy ledger_insert on ledger_entries for insert
  with check (app.has_support_access(organization_id)
              or (organization_id = app.current_organization_id() and app.has_permission('finance.write')));

drop policy if exists ledger_read on ledger_entries;
create policy ledger_read on ledger_entries for select
  using (app.has_support_access(organization_id)
         or (organization_id = app.current_organization_id()
             and app.can_touch_branch(branch_id)
             and app.has_permission('finance.read')));

drop policy if exists meal_plans_rw on meal_plans;
create policy meal_plans_rw on meal_plans
  using (app.has_support_access(organization_id)
         or (is_template and organization_id = app.current_organization_id())
         or app.is_self(user_id)
         or (app.staff_scope(organization_id, null::uuid)
             and app.has_permission('nutrition.read')
             and app.can_access_member(user_id)))
  with check (app.is_self(user_id)
              or (app.staff_scope(organization_id, null::uuid) and app.has_permission('nutrition.write')));

drop policy if exists membership_freezes_rw on membership_freezes;
create policy membership_freezes_rw on membership_freezes
  using (app.has_support_access(organization_id)
         or exists (select 1 from member_memberships m where m.id = membership_freezes.member_membership_id))
  with check (app.has_support_access(organization_id)
              or (organization_id = app.current_organization_id() and app.has_permission('memberships.write')));

drop policy if exists notes_read on notes;
create policy notes_read on notes for select
  using (app.has_support_access(organization_id)
         or (visibility = 'member_visible' and entity_type = 'member' and app.is_self(entity_id))
         or (app.staff_scope(organization_id, branch_id) and (
               visibility = 'staff'
               or (visibility = 'coach_only' and app.has_permission('notes.coach.read'))
               or (visibility = 'restricted' and app.has_permission('notes.restricted.read'))
            )));

drop policy if exists refunds_rw on refunds;
create policy refunds_rw on refunds
  using (app.has_support_access(organization_id)
         or (organization_id = app.current_organization_id()
             and (app.has_permission('finance.read')
                  or exists (select 1 from payments p where p.id = refunds.payment_id and app.is_self(p.user_id)))))
  with check (app.has_support_access(organization_id)
              or (organization_id = app.current_organization_id() and app.has_permission('finance.refund')));

drop policy if exists webhook_events_read on webhook_events;
create policy webhook_events_read on webhook_events for select
  using (app.has_support_access(organization_id)
         or (organization_id = app.current_organization_id() and app.has_permission('integrations.read')));

drop policy if exists webhook_events_write on webhook_events;
create policy webhook_events_write on webhook_events
  using (app.has_support_access(organization_id) or organization_id = app.current_organization_id())
  with check (app.has_support_access(organization_id)
              or organization_id is null
              or organization_id = app.current_organization_id());
