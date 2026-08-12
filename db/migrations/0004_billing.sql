-- ===========================================================================
-- 0004_billing.sql
-- Gym → member commerce: plans, memberships, freezes, invoices, payments,
-- refunds, promotions and a double-entry ledger.
--
-- Money rule: every amount is an integer minor unit (paisa for PKR) plus an
-- explicit currency. Never float. Payment status is a *signal*; the ledger is
-- the source of truth for what a member owes and what the gym collected.
-- ===========================================================================

create table membership_plans (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid references branches(id) on delete cascade,
  code                  citext not null,
  name                  text not null,
  description           text,
  kind                  text not null default 'membership'
                          check (kind in ('membership','class_pack','pt_package','day_pass','product','joining_fee')),
  currency              char(3) not null default 'PKR',
  price_minor           bigint not null check (price_minor >= 0),
  billing_interval      billing_interval not null default 'monthly',
  contract_months       integer not null default 0,
  joining_fee_minor     bigint not null default 0,
  sessions_included     integer,
  class_credits         integer,
  pt_sessions           integer,
  guest_passes          integer not null default 0,
  freeze_days_per_year  integer not null default 0,
  max_family_members    integer not null default 1,
  branch_access         text not null default 'home' check (branch_access in ('home','all')),
  tax_rate_bps          integer not null default 0 check (tax_rate_bps between 0 and 10000),
  is_public             boolean not null default true,
  is_active             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (organization_id, code)
);
create index membership_plans_branch_idx on membership_plans (organization_id, branch_id) where is_active;

create table promotions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  code              citext not null,
  label             text not null,
  discount_kind     text not null check (discount_kind in ('percent','fixed','free_days')),
  percent_off_bps   integer check (percent_off_bps between 0 and 10000),
  amount_off_minor  bigint,
  free_days         integer,
  applies_to_plan_ids uuid[] not null default '{}',
  max_redemptions   integer,
  redemption_count  integer not null default 0,
  starts_on         date not null default current_date,
  ends_on           date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, code),
  constraint promotions_value_present check (
    (discount_kind = 'percent' and percent_off_bps is not null) or
    (discount_kind = 'fixed' and amount_off_minor is not null) or
    (discount_kind = 'free_days' and free_days is not null)
  )
);

create table member_memberships (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid not null references branches(id) on delete restrict,
  user_id               uuid not null references users(id) on delete cascade,
  membership_plan_id    uuid not null references membership_plans(id) on delete restrict,
  payer_user_id         uuid references users(id) on delete set null,
  state                 membership_state not null default 'pending',
  starts_on             date not null,
  ends_on               date,
  current_period_start  date not null,
  current_period_end    date not null,
  next_invoice_on       date,
  price_minor           bigint not null,
  currency              char(3) not null default 'PKR',
  promotion_id          uuid references promotions(id) on delete set null,
  discount_minor        bigint not null default 0,
  credits_remaining     integer,
  pt_sessions_remaining integer,
  auto_renew            boolean not null default true,
  cancel_at_period_end  boolean not null default false,
  cancelled_at          timestamptz,
  cancellation_reason   text,
  sold_by_user_id       uuid references users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint membership_period_valid check (current_period_end >= current_period_start)
);
create index member_memberships_user_idx on member_memberships (user_id, state);
create index member_memberships_due_idx on member_memberships (organization_id, next_invoice_on) where state in ('active','past_due');

create table membership_freezes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  member_membership_id uuid not null references member_memberships(id) on delete cascade,
  starts_on         date not null,
  ends_on           date not null,
  reason            text not null,
  fee_minor         bigint not null default 0,
  approved_by       uuid references users(id) on delete set null,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint freeze_window check (ends_on >= starts_on)
);

create table membership_changes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  member_membership_id uuid not null references member_memberships(id) on delete cascade,
  change_kind       text not null check (change_kind in ('upgrade','downgrade','transfer_branch','plan_price_change','reactivate','cancel')),
  from_plan_id      uuid references membership_plans(id),
  to_plan_id        uuid references membership_plans(id),
  effective_on      date not null,
  proration_credit_minor bigint not null default 0,
  proration_charge_minor bigint not null default 0,
  invoice_id        uuid,
  performed_by      uuid references users(id) on delete set null,
  note              text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invoices & payments
-- ---------------------------------------------------------------------------

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null references branches(id) on delete restrict,
  user_id           uuid not null references users(id) on delete cascade,
  payer_user_id     uuid references users(id) on delete set null,
  member_membership_id uuid references member_memberships(id) on delete set null,
  number            citext not null,
  state             invoice_state not null default 'open',
  currency          char(3) not null default 'PKR',
  subtotal_minor    bigint not null default 0,
  discount_minor    bigint not null default 0,
  tax_minor         bigint not null default 0,
  total_minor       bigint not null default 0,
  amount_paid_minor bigint not null default 0,
  amount_refunded_minor bigint not null default 0,
  tax_rate_bps      integer not null default 0,
  tax_label         text,
  issued_at         timestamptz not null default now(),
  due_at            timestamptz not null default (now() + interval '7 days'),
  paid_at           timestamptz,
  voided_at         timestamptz,
  void_reason       text,
  dunning_stage     integer not null default 0,
  last_reminder_at  timestamptz,
  notes             text,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, number),
  constraint invoice_totals_non_negative check (
    subtotal_minor >= 0 and discount_minor >= 0 and tax_minor >= 0 and total_minor >= 0
  )
);
create index invoices_user_idx on invoices (user_id, state);
create index invoices_overdue_idx on invoices (organization_id, due_at) where state in ('open','partially_paid');

create table invoice_lines (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  invoice_id        uuid not null references invoices(id) on delete cascade,
  membership_plan_id uuid references membership_plans(id) on delete set null,
  description       text not null,
  line_kind         text not null default 'membership'
                      check (line_kind in ('membership','joining_fee','class_pack','pt_package','product','freeze_fee','proration_charge','proration_credit','late_fee','adjustment')),
  quantity          numeric(10,2) not null default 1,
  unit_price_minor  bigint not null,
  discount_minor    bigint not null default 0,
  tax_rate_bps      integer not null default 0,
  tax_minor         bigint not null default 0,
  total_minor       bigint not null,
  period_start      date,
  period_end        date,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);
create index invoice_lines_invoice_idx on invoice_lines (invoice_id);

create table payments (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid not null references branches(id) on delete restrict,
  user_id               uuid not null references users(id) on delete cascade,
  invoice_id            uuid references invoices(id) on delete set null,
  reference             citext not null,
  state                 payment_state not null default 'pending',
  method                payment_method_kind not null,
  provider              text not null default 'manual',
  provider_payment_id   text,
  currency              char(3) not null default 'PKR',
  amount_minor          bigint not null check (amount_minor > 0),
  fee_minor             bigint not null default 0,
  net_minor             bigint not null default 0,
  received_at           timestamptz not null default now(),
  settled_at            timestamptz,
  failed_at             timestamptz,
  failure_code          text,
  failure_message       text,
  -- Manual reconciliation fields (cash / bank transfer)
  bank_reference        text,
  depositor_name        text,
  reconciled_at         timestamptz,
  reconciled_by         uuid references users(id) on delete set null,
  collected_by_user_id  uuid references users(id) on delete set null,
  receipt_number        citext,
  receipt_url           text,
  idempotency_key       text,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, reference)
);
create unique index payments_idempotency_key on payments (organization_id, idempotency_key) where idempotency_key is not null;
create unique index payments_provider_payment_key on payments (provider, provider_payment_id) where provider_payment_id is not null;
create index payments_invoice_idx on payments (invoice_id);
create index payments_unreconciled_idx on payments (organization_id, method) where reconciled_at is null;

create table payment_attempts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  payment_id        uuid references payments(id) on delete cascade,
  invoice_id        uuid references invoices(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  attempt_number    integer not null default 1,
  provider          text not null,
  state             payment_state not null default 'pending',
  amount_minor      bigint not null,
  currency          char(3) not null default 'PKR',
  request_payload   jsonb not null default '{}'::jsonb,
  response_payload  jsonb not null default '{}'::jsonb,
  failure_code      text,
  failure_message   text,
  next_retry_at     timestamptz,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);
create index payment_attempts_invoice_idx on payment_attempts (invoice_id, attempt_number);
create index payment_attempts_retry_idx on payment_attempts (organization_id, next_retry_at) where state = 'failed';

create table refunds (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  payment_id        uuid not null references payments(id) on delete restrict,
  invoice_id        uuid references invoices(id) on delete set null,
  amount_minor      bigint not null check (amount_minor > 0),
  currency          char(3) not null default 'PKR',
  reason            text not null,
  state             payment_state not null default 'pending',
  method            payment_method_kind not null,
  provider_refund_id text,
  approved_by       uuid references users(id) on delete set null,
  processed_at      timestamptz,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index refunds_payment_idx on refunds (payment_id);

-- ---------------------------------------------------------------------------
-- Double-entry ledger — append only
-- ---------------------------------------------------------------------------

create table ledger_entries (
  id                bigserial primary key,
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid references branches(id) on delete set null,
  entry_group       uuid not null,
  account           ledger_account not null,
  direction         ledger_direction not null,
  amount_minor      bigint not null check (amount_minor > 0),
  currency          char(3) not null default 'PKR',
  user_id           uuid references users(id) on delete set null,
  invoice_id        uuid references invoices(id) on delete set null,
  payment_id        uuid references payments(id) on delete set null,
  refund_id         uuid references refunds(id) on delete set null,
  membership_id     uuid references member_memberships(id) on delete set null,
  memo              text not null,
  occurred_on       date not null default current_date,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index ledger_entries_group_idx on ledger_entries (entry_group);
create index ledger_entries_org_date_idx on ledger_entries (organization_id, occurred_on);
create index ledger_entries_account_idx on ledger_entries (organization_id, account, occurred_on);

create trigger trg_ledger_no_update before update on ledger_entries
  for each row execute function app.forbid_mutation();
create trigger trg_ledger_no_delete before delete on ledger_entries
  for each row execute function app.forbid_mutation();

comment on table ledger_entries is
  'Append-only double-entry journal. Corrections are new balancing entries, never edits.';

-- Deferred FK now that invoices exists.
alter table membership_changes
  add constraint membership_changes_invoice_fk
  foreign key (invoice_id) references invoices(id) on delete set null;

select app.attach_touch(t) from (values
  ('membership_plans'::regclass), ('promotions'), ('member_memberships'), ('membership_freezes'),
  ('invoices'), ('payments'), ('refunds')
) as v(t);
