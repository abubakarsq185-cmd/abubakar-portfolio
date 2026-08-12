-- ===========================================================================
-- 0017_append_only_semantics.sql
--
-- Fix: "append-only" was implemented in a way that made erasure impossible.
--
-- audit_logs, ledger_entries and consents each had triggers blocking both
-- UPDATE and DELETE. Deleting a user cascades into consents, the trigger
-- refused the cascade, and the delete failed:
--
--     ERROR: table public.consents is append-only (attempted DELETE)
--
-- So a data-erasure request — the one operation that must be able to remove a
-- person — could never complete, and a tenant could never be removed.
--
-- The two properties were conflated. They are different:
--
--   • Immutability — nobody, including the database owner, may rewrite
--     history. Enforced by the UPDATE trigger. Kept.
--   • Deletion rights — the application must never delete these rows, but a
--     privileged erasure or tenant-removal job must be able to. Enforced by
--     revoked privileges on the application role (migration 0009), which is
--     the right tool because it distinguishes *who* is asking.
--
-- Caught by tests/integration/enrolment-payment.test.ts.
-- ===========================================================================

drop trigger if exists trg_audit_logs_no_delete on audit_logs;
drop trigger if exists trg_ledger_no_delete on ledger_entries;
drop trigger if exists trg_consents_no_delete on consents;

-- The UPDATE guards stay: content is immutable for everyone.
-- (trg_audit_logs_no_update, trg_ledger_no_update remain in place.)

create trigger trg_consents_no_update before update on consents
  for each row execute function app.forbid_mutation();

comment on function app.forbid_mutation() is
  'Blocks UPDATE on append-only tables. DELETE is governed by privileges instead,
   so a privileged erasure job can still remove a person while the application
   never can.';

-- Restore the tenant cascade on the audit trail: removing an organization
-- should take its audit history with it, and that is a DELETE, which the
-- application role still cannot perform.
alter table audit_logs
  add constraint audit_logs_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete cascade;

-- Belt and braces: make sure the application role has no way to delete these,
-- whatever future default privileges do.
revoke update, delete on audit_logs, ledger_entries, consents from gymguide_app;
