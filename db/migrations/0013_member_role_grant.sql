-- ===========================================================================
-- 0013_member_role_grant.sql
--
-- Fix: enrolment was impossible for the role that does it.
--
-- `user_roles` required `staff.roles.write` for every insert, which only a gym
-- owner holds. Front desk holds `members.write` and is the role that actually
-- enrols people, so every enrolment failed at the point of giving the new
-- member the `member` role:
--
--     new row violates row-level security policy for table "user_roles"
--
-- Granting someone the `member` or `guardian` role is not privilege escalation
-- — it is what enrolment *is*. Granting a staff role is, and still requires
-- `staff.roles.write`.
--
-- Caught by tests/integration/enrolment-payment.test.ts.
-- ===========================================================================

create or replace function app.is_member_facing_role(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1 from roles r
     where r.id = target and r.code in ('member', 'guardian')
  );
$$;

comment on function app.is_member_facing_role(uuid) is
  'True for the non-staff roles. Assigning one is enrolment, not privilege escalation.';

drop policy if exists user_roles_rw on user_roles;

create policy user_roles_read on user_roles for select
  using (
    app.is_platform_admin()
    or app.is_self(user_id)
    or (app.is_staff() and organization_id = app.current_organization_id())
  );

create policy user_roles_insert on user_roles for insert
  with check (
    app.is_platform_admin()
    or (
      app.is_staff()
      and organization_id = app.current_organization_id()
      and (
        -- Enrolling a member or linking a family payer.
        (app.is_member_facing_role(role_id) and app.has_permission('members.write'))
        -- Anything that grants staff capability needs the stronger permission.
        or app.has_permission('staff.roles.write')
      )
    )
  );

create policy user_roles_update on user_roles for update
  using (
    app.is_platform_admin()
    or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write'))
  )
  with check (
    app.is_platform_admin()
    or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write'))
  );

create policy user_roles_delete on user_roles for delete
  using (
    app.is_platform_admin()
    or (app.is_staff() and organization_id = app.current_organization_id() and app.has_permission('staff.roles.write'))
  );
