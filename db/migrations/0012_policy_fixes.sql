-- ===========================================================================
-- 0012_policy_fixes.sql
--
-- Fix: a permissive `FOR ALL` write policy also applies to SELECT, and multiple
-- permissive policies are OR'd together. `notes_write` therefore widened read
-- access — any staff member with notes.write could read coach-only and
-- restricted notes, defeating the visibility tiers.
--
-- Caught by tests/integration/rls-isolation.test.ts
-- ("front desk cannot read restricted or coach-only notes").
--
-- The fix: write policies cover INSERT / UPDATE / DELETE only, so the
-- read policy is the single authority on who can see a row.
-- ===========================================================================

drop policy if exists notes_write on notes;

create policy notes_insert on notes for insert
  with check (app.staff_scope(organization_id, branch_id) and app.has_permission('notes.write'));

-- Editing or deleting a note additionally requires being able to *see* it, so a
-- front-desk user cannot blind-write over a coaching note.
create policy notes_update on notes for update
  using (
    app.staff_scope(organization_id, branch_id)
    and app.has_permission('notes.write')
    and (
      visibility = 'staff'
      or (visibility = 'coach_only' and app.has_permission('notes.coach.read'))
      or (visibility = 'restricted' and app.has_permission('notes.restricted.read'))
      or visibility = 'member_visible'
    )
  )
  with check (app.staff_scope(organization_id, branch_id) and app.has_permission('notes.write'));

create policy notes_delete on notes for delete
  using (
    app.staff_scope(organization_id, branch_id)
    and app.has_permission('notes.write')
    and (
      visibility = 'staff'
      or (visibility = 'coach_only' and app.has_permission('notes.coach.read'))
      or (visibility = 'restricted' and app.has_permission('notes.restricted.read'))
      or visibility = 'member_visible'
    )
  );

-- Same shape of problem on conversations: the write policy let any staff member
-- with messaging.write read every thread, bypassing conversations_read.
drop policy if exists conversations_write on conversations;

create policy conversations_insert on conversations for insert
  with check (
    app.is_self(member_user_id)
    or (app.staff_scope(organization_id, branch_id) and app.has_permission('messaging.write'))
  );

create policy conversations_update on conversations for update
  using (
    app.is_self(member_user_id)
    or (app.staff_scope(organization_id, branch_id) and app.has_permission('messaging.write')
        and app.has_permission('messaging.read'))
  )
  with check (
    app.is_self(member_user_id)
    or (app.staff_scope(organization_id, branch_id) and app.has_permission('messaging.write'))
  );

-- Likewise for family links and meal plans: keep reads governed by the read
-- policy alone.
drop policy if exists family_links_write on family_links;

create policy family_links_insert on family_links for insert
  with check (app.staff_scope(organization_id, null) and app.has_permission('members.write'));
create policy family_links_update on family_links for update
  using (app.staff_scope(organization_id, null) and app.has_permission('members.write'))
  with check (app.staff_scope(organization_id, null) and app.has_permission('members.write'));
create policy family_links_delete on family_links for delete
  using (app.staff_scope(organization_id, null) and app.has_permission('members.write'));
