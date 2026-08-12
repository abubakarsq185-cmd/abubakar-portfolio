-- ===========================================================================
-- 0019_members_can_see_their_gym.sql
--
-- Fix: branch_equipment was staff-only, so a member read zero rows from it.
--
-- Two things in the product depend on knowing what a branch actually owns, and
-- both run as the member:
--
--   1. The guided workout player offers exercise substitutions. With no visible
--      equipment it concluded the gym owned nothing, so a member asking for an
--      alternative to a barbell squat was never offered the leg press standing
--      next to them.
--
--   2. Onboarding matches an approved template to the member. With no visible
--      equipment every template looked unequippable, the matcher declined on
--      safety grounds — exactly as designed — and every new member was told to
--      wait for a coach. The engine was right; its input was wrong.
--
-- This was not a data-protection boundary doing its job. Which machines a gym
-- owns is not confidential: the member is standing in the room looking at them.
-- Staff keep the write access; members get read.
--
-- Caught by tests/integration/onboarding.test.ts.
-- ===========================================================================

-- The write side stays staff-only. Splitting the policy is what allows a
-- narrower read without also handing members the ability to edit the inventory.
drop policy if exists tenant_rw on branch_equipment;

create policy branch_equipment_read on branch_equipment for select
  using (
    app.staff_scope(organization_id, branch_id)
    or exists (
      select 1 from member_profiles mp
       where mp.user_id = app.current_user_id()
         and mp.branch_id = branch_equipment.branch_id
         and mp.deleted_at is null
    )
  );

create policy branch_equipment_insert on branch_equipment for insert
  with check (app.staff_scope(organization_id, branch_id));

create policy branch_equipment_update on branch_equipment for update
  using (app.staff_scope(organization_id, branch_id))
  with check (app.staff_scope(organization_id, branch_id));

create policy branch_equipment_delete on branch_equipment for delete
  using (app.staff_scope(organization_id, branch_id));

comment on table branch_equipment is
  'What a branch actually owns. Readable by staff in scope and by members of that
   branch — the workout player and the program matcher both need it, and a member
   can see the machines in front of them anyway. Writable by staff only.';
