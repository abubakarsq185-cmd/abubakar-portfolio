-- ===========================================================================
-- 0015_document_sequences.sql
--
-- Fix: invoice numbers, payment references and receipt numbers were all
-- allocated with `select max(number) ... + 1`, which has the same two faults as
-- the member-number bug fixed in 0014:
--
--   1. It reads through row-level security. Branch-scoped staff see fewer
--      invoices, compute a lower maximum, and collide with a number already
--      issued at another branch.
--   2. It is racy. Two people taking payment at the same moment compute the
--      same reference.
--
-- Money documents are exactly where a duplicated identifier is least
-- acceptable, so all three now come from one atomic, RLS-independent
-- allocator.
--
-- Caught by tests/integration/enrolment-payment.test.ts.
-- ===========================================================================

create table document_sequences (
  organization_id uuid not null references organizations(id) on delete cascade,
  kind            text not null check (kind in ('invoice', 'payment', 'receipt', 'support_case')),
  prefix          text not null,
  period          text not null default '',
  next_value      integer not null default 1,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, kind, period)
);

comment on table document_sequences is
  'Atomic per-tenant document numbering. Written only through app.next_document_number().';

alter table document_sequences enable row level security;

create policy document_sequences_read on document_sequences for select
  using (app.is_platform_admin());

/**
 * Allocate the next number for a document kind.
 *
 * `period` lets a sequence restart each year (invoices) or run continuously
 * (support cases). SECURITY DEFINER so allocation ignores the caller's branch
 * scope; UPDATE ... RETURNING takes a row lock so concurrent callers queue.
 */
create or replace function app.next_document_number(
  org uuid,
  document_kind text,
  document_prefix text,
  document_period text default ''
)
returns text
language plpgsql
security definer
set search_path = public, app
as $$
declare
  allocated integer;
begin
  if org is null then
    raise exception 'An organization is required to allocate a document number';
  end if;

  insert into document_sequences (organization_id, kind, prefix, period)
  values (org, document_kind, document_prefix, document_period)
  on conflict (organization_id, kind, period) do nothing;

  update document_sequences
     set next_value = next_value + 1,
         updated_at = now()
   where organization_id = org and kind = document_kind and period = document_period
   returning next_value - 1 into allocated;

  return case
    when document_period = '' then document_prefix || '-' || lpad(allocated::text, 4, '0')
    else document_prefix || '-' || document_period || '-' || lpad(allocated::text, 4, '0')
  end;
end;
$$;

revoke all on function app.next_document_number(uuid, text, text, text) from public;
grant execute on function app.next_document_number(uuid, text, text, text) to gymguide_app;

-- Seed each sequence past whatever the demo data already created, so existing
-- numbering continues rather than restarting.
insert into document_sequences (organization_id, kind, prefix, period, next_value)
select i.organization_id,
       'invoice',
       'APX',
       split_part(i.number, '-', 2),
       max(split_part(i.number, '-', 3)::int) + 1
  from invoices i
 where i.number ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'
 group by i.organization_id, split_part(i.number, '-', 2)
on conflict (organization_id, kind, period) do update
  set next_value = greatest(document_sequences.next_value, excluded.next_value);

insert into document_sequences (organization_id, kind, prefix, period, next_value)
select p.organization_id,
       'payment',
       'PAY',
       split_part(p.reference, '-', 2),
       max(split_part(p.reference, '-', 3)::int) + 1
  from payments p
 where p.reference ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'
 group by p.organization_id, split_part(p.reference, '-', 2)
on conflict (organization_id, kind, period) do update
  set next_value = greatest(document_sequences.next_value, excluded.next_value);

insert into document_sequences (organization_id, kind, prefix, period, next_value)
select p.organization_id,
       'receipt',
       'APX-R',
       split_part(p.receipt_number, '-', 3),
       max(split_part(p.receipt_number, '-', 4)::int) + 1
  from payments p
 where p.receipt_number ~ '^[A-Z]+-R-[0-9]{4}-[0-9]+$'
 group by p.organization_id, split_part(p.receipt_number, '-', 3)
on conflict (organization_id, kind, period) do update
  set next_value = greatest(document_sequences.next_value, excluded.next_value);

insert into document_sequences (organization_id, kind, prefix, period, next_value)
select sc.organization_id,
       'support_case',
       'APX-C',
       '',
       max(split_part(sc.reference, '-', 3)::int) + 1
  from support_cases sc
 where sc.reference ~ '^[A-Z]+-C-[0-9]+$'
 group by sc.organization_id
on conflict (organization_id, kind, period) do update
  set next_value = greatest(document_sequences.next_value, excluded.next_value);
