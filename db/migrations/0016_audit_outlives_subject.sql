-- ===========================================================================
-- 0016_audit_outlives_subject.sql
--
-- Fix: deleting a user was impossible.
--
-- audit_logs referenced users with ON DELETE SET NULL, but the table is
-- append-only — the trigger blocks UPDATE. So the cascade tried to null the
-- reference, the trigger refused, and the delete failed:
--
--     ERROR: table public.audit_logs is append-only (attempted UPDATE)
--
-- That breaks erasure requests, which is the one place a user deletion has to
-- work, and it would have broken any staff account clean-up too.
--
-- An audit record is supposed to outlive the row it describes. Keeping a
-- foreign key onto a mutable table was the mistake: the ids are retained as
-- plain uuids so history survives the subject, which is the entire point of an
-- audit log. The same reasoning applies to ledger entries and consent records.
-- ===========================================================================

alter table audit_logs
  drop constraint if exists audit_logs_actor_user_id_fkey,
  drop constraint if exists audit_logs_impersonated_by_fkey,
  drop constraint if exists audit_logs_subject_user_id_fkey,
  drop constraint if exists audit_logs_organization_id_fkey,
  drop constraint if exists audit_logs_branch_id_fkey;

comment on column audit_logs.subject_user_id is
  'Deliberately not a foreign key: the audit trail must outlive the user it describes.';

-- Consent evidence is also append-only, and the same cascade would fail.
alter table consents
  drop constraint if exists consents_collected_by_fkey;

comment on column consents.collected_by is
  'Not a foreign key: consent evidence outlives the staff member who collected it.';

-- The ledger is append-only too. Losing the ability to remove a member because
-- of a journal entry from two years ago is not an acceptable trade.
alter table ledger_entries
  drop constraint if exists ledger_entries_user_id_fkey,
  drop constraint if exists ledger_entries_created_by_fkey,
  drop constraint if exists ledger_entries_invoice_id_fkey,
  drop constraint if exists ledger_entries_payment_id_fkey,
  drop constraint if exists ledger_entries_refund_id_fkey,
  drop constraint if exists ledger_entries_membership_id_fkey;

comment on table ledger_entries is
  'Append-only double-entry journal. Corrections are new balancing entries, never
   edits. References are stored as ids without foreign keys so financial history
   survives the deletion of a member or an invoice.';

-- The organization reference stays: deleting a tenant should take its ledger
-- with it, and that cascade is a DELETE rather than an UPDATE, so the
-- append-only trigger permits it.
