-- ===========================================================================
-- 0018_sequence_backfill_triggers.sql
--
-- Fix: the counters introduced in 0014 and 0015 backfill themselves from
-- existing rows *at migration time*. On a database built from scratch —
-- `pnpm db:bootstrap`, and every CI run — the migrations run against an empty
-- schema and the seed inserts its rows afterwards, carrying hard-coded numbers
-- (APX-1001…APX-1016, APX-2026-0001…). The counters never learned about them,
-- so the first real enrolment allocated APX-1001 again:
--
--     duplicate key value violates unique constraint
--     "member_profiles_organization_id_member_number_key"
--
-- 0014 shipped a sync trigger for member numbers, but it only UPDATEd a
-- counter row that did not exist yet, so it silently matched nothing. There was
-- no equivalent for invoice, payment, receipt or support-case numbers at all.
--
-- This is not only a seeding concern. A gym migrating from another system
-- imports historical invoices with numbers already assigned; the counters have
-- to move ahead of anything inserted with an explicit number, whenever it
-- arrives. So the rule belongs in the database as a trigger, not in a one-shot
-- backfill.
--
-- Caught by tests/integration/enrolment-payment.test.ts after a clean bootstrap.
-- ===========================================================================

-- --- Member numbers --------------------------------------------------------
-- Upsert rather than update: the counter row may not exist yet for a brand new
-- organization whose first members arrive by import.
create or replace function app.sync_member_number_sequence()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  numeric_part integer;
  prefix_part text;
begin
  numeric_part := nullif(substring(new.member_number from '[0-9]+$'), '')::int;
  if numeric_part is null then
    return new;
  end if;

  prefix_part := nullif(regexp_replace(new.member_number, '-?[0-9]+$', ''), '');

  insert into member_number_sequences (organization_id, prefix, next_value)
  values (new.organization_id, coalesce(prefix_part, 'APX'), numeric_part + 1)
  on conflict (organization_id) do update
    set next_value = greatest(member_number_sequences.next_value, excluded.next_value),
        updated_at = now();

  return new;
end;
$$;

-- --- Document numbers ------------------------------------------------------
/**
 * Move a document counter past a number that was assigned outside the
 * allocator.
 *
 * The format is parsed rather than passed in pieces so one function serves all
 * four kinds: the trailing `-NNNN` is the counter, and if what remains ends in
 * a four-digit group that is the period (a year), leaving the rest as the
 * prefix. That reads APX-2026-0001, PAY-2026-0001, APX-R-2026-0001 and
 * APX-C-0007 correctly.
 */
create or replace function app.document_sequence_bump(
  org uuid,
  document_kind text,
  document_number text
)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  head        text;
  value_part  integer;
  period_part text := '';
  prefix_part text;
begin
  if org is null or document_number is null then
    return;
  end if;

  value_part := nullif(substring(document_number from '-([0-9]+)$'), '')::int;
  if value_part is null then
    return;
  end if;

  head := regexp_replace(document_number, '-[0-9]+$', '');

  if head ~ '-[0-9]{4}$' then
    period_part := substring(head from '([0-9]{4})$');
    prefix_part := regexp_replace(head, '-[0-9]{4}$', '');
  else
    prefix_part := head;
  end if;

  insert into document_sequences (organization_id, kind, prefix, period, next_value)
  values (org, document_kind, prefix_part, period_part, value_part + 1)
  on conflict (organization_id, kind, period) do update
    set next_value = greatest(document_sequences.next_value, excluded.next_value),
        updated_at = now();
end;
$$;

revoke all on function app.document_sequence_bump(uuid, text, text) from public;

create or replace function app.sync_document_sequence()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  case tg_table_name
    when 'invoices' then
      perform app.document_sequence_bump(new.organization_id, 'invoice', new.number);
    when 'payments' then
      perform app.document_sequence_bump(new.organization_id, 'payment', new.reference);
      perform app.document_sequence_bump(new.organization_id, 'receipt', new.receipt_number);
    when 'support_cases' then
      perform app.document_sequence_bump(new.organization_id, 'support_case', new.reference);
    else
      null;
  end case;
  return new;
end;
$$;

create trigger trg_invoices_sync_number
  after insert on invoices
  for each row execute function app.sync_document_sequence();

create trigger trg_payments_sync_number
  after insert on payments
  for each row execute function app.sync_document_sequence();

create trigger trg_support_cases_sync_number
  after insert on support_cases
  for each row execute function app.sync_document_sequence();

-- Catch up anything already in this database, so an existing installation is
-- corrected by the migration rather than by the next insert.
select app.document_sequence_bump(organization_id, 'invoice', number) from invoices;
select app.document_sequence_bump(organization_id, 'payment', reference) from payments;
select app.document_sequence_bump(organization_id, 'receipt', receipt_number) from payments;
select app.document_sequence_bump(organization_id, 'support_case', reference) from support_cases;

insert into member_number_sequences (organization_id, prefix, next_value)
select mp.organization_id,
       coalesce(nullif(regexp_replace(max(mp.member_number), '-?[0-9]+$', ''), ''), 'APX'),
       max(substring(mp.member_number from '[0-9]+$')::int) + 1
  from member_profiles mp
 where mp.member_number ~ '[0-9]+$'
 group by mp.organization_id
on conflict (organization_id) do update
  set next_value = greatest(member_number_sequences.next_value, excluded.next_value),
      updated_at = now();
