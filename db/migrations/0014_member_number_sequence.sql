-- ===========================================================================
-- 0014_member_number_sequence.sql
--
-- Fix: member numbers were allocated with
--
--     select max(substring(member_number from '[0-9]+$')::int) + 1
--
-- which reads through row-level security. A branch-scoped front-desk user only
-- sees their own branch's members, so at Gulberg (highest visible APX-1012) the
-- next number came out as APX-1013 — already taken by a member at DHA. Every
-- enrolment by branch-scoped staff failed on the unique constraint.
--
-- It was also racy: two people enrolling at once would compute the same number.
--
-- The fix is a per-organization counter incremented atomically by a
-- SECURITY DEFINER function, so allocation neither depends on what the caller
-- can see nor on who gets there first.
--
-- Caught by tests/integration/enrolment-payment.test.ts.
-- ===========================================================================

create table member_number_sequences (
  organization_id uuid primary key references organizations(id) on delete cascade,
  prefix          text not null default 'APX',
  next_value      integer not null default 1001,
  updated_at      timestamptz not null default now()
);

comment on table member_number_sequences is
  'Per-tenant member number allocation. Written only through app.next_member_number().';

alter table member_number_sequences enable row level security;

-- No direct access: allocation goes through the function, which is the only
-- thing that can keep the counter consistent.
create policy member_number_sequences_read on member_number_sequences for select
  using (app.is_platform_admin());

-- Start each existing organization after its highest current member number.
insert into member_number_sequences (organization_id, prefix, next_value)
select o.id,
       'APX',
       coalesce(max(substring(mp.member_number from '[0-9]+$')::int), 1000) + 1
  from organizations o
  left join member_profiles mp on mp.organization_id = o.id
 group by o.id
on conflict (organization_id) do nothing;

/**
 * Allocate the next member number for an organization.
 *
 * SECURITY DEFINER so the counter is read in full regardless of the caller's
 * branch scope, and `for update` (implicit in UPDATE ... RETURNING) so two
 * concurrent enrolments cannot receive the same number.
 */
create or replace function app.next_member_number(org uuid)
returns text
language plpgsql
security definer
set search_path = public, app
as $$
declare
  allocated integer;
  member_prefix text;
begin
  if org is null then
    raise exception 'An organization is required to allocate a member number';
  end if;

  insert into member_number_sequences (organization_id)
  values (org)
  on conflict (organization_id) do nothing;

  update member_number_sequences
     set next_value = next_value + 1,
         updated_at = now()
   where organization_id = org
   returning next_value - 1, prefix into allocated, member_prefix;

  return member_prefix || '-' || allocated::text;
end;
$$;

revoke all on function app.next_member_number(uuid) from public;
grant execute on function app.next_member_number(uuid) to gymguide_app;

-- Keep the counter ahead of any number created before this migration.
create or replace function app.sync_member_number_sequence()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  numeric_part integer;
begin
  numeric_part := nullif(substring(new.member_number from '[0-9]+$'), '')::int;
  if numeric_part is null then
    return new;
  end if;
  update member_number_sequences
     set next_value = greatest(next_value, numeric_part + 1)
   where organization_id = new.organization_id;
  return new;
end;
$$;

create trigger trg_member_profiles_sync_number
  after insert on member_profiles
  for each row execute function app.sync_member_number_sequence();
