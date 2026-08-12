import 'server-only';
/**
 * Money movement.
 *
 * Three rules this module exists to enforce:
 *   1. A payment is never recorded twice. The idempotency key is a database
 *      constraint, not a hopeful check.
 *   2. Invoice state is derived from amounts, never set by hand.
 *   3. Nothing touches money without a balanced ledger posting and an audit row.
 */
import {
  deriveInvoiceState,
  postPaymentReceived,
  postRefund,
  type LedgerEntryGroup,
} from '@gymguide/domain';
import { can, type Actor, type RecordPaymentInput, type RefundInput } from '@gymguide/types';
import { formatMoney } from '@gymguide/config';
import { tenantSessionFor } from '../auth/session';
import { withTenant, type Queryable } from '../db/pool';
import { recordAudit } from '../audit';
import { paymentAdapterFor } from '../adapters/payments';

export interface RecordPaymentResult {
  ok: boolean;
  paymentId?: string;
  receiptNumber?: string;
  duplicate?: boolean;
  invoiceState?: string;
  message: string;
  qrPayload?: string;
  redirectUrl?: string;
}

export async function recordPayment(actor: Actor, input: RecordPaymentInput): Promise<RecordPaymentResult> {
  if (!can(actor, 'finance.write')) {
    return { ok: false, message: 'You do not have permission to record payments.' };
  }
  const session = tenantSessionFor(actor);
  const adapter = paymentAdapterFor(input.method);

  try {
    const outcome = await withTenant(session, async (db) => {
      // Idempotency first: if this key already produced a payment, return it.
      const existing = await db.query<{ id: string; receipt_number: string | null }>(
        'select id, receipt_number from payments where idempotency_key = $1',
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        return {
          duplicate: true as const,
          paymentId: existing.rows[0].id,
          receiptNumber: existing.rows[0].receipt_number,
        };
      }

      const member = await db.query<{ full_name: string; phone: string | null }>(
        'select full_name, phone from users where id = $1',
        [input.userId],
      );
      if (!member.rows[0]) throw new Error('That member is not in your scope.');

      const reference = await nextReference(db, 'PAY');
      const receiptNumber = await nextReference(db, 'APX-R');

      const intent = await adapter.createIntent({
        organizationId: actor.organizationId!,
        invoiceId: input.invoiceId ?? null,
        userId: input.userId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        method: input.method,
        reference,
        idempotencyKey: input.idempotencyKey,
        memberName: member.rows[0].full_name,
        memberPhone: member.rows[0].phone,
      });

      if (!intent.ok) {
        return { duplicate: false as const, failed: intent.message };
      }

      const settled = intent.status === 'settled' || intent.status === 'pending_confirmation';
      const state = settled ? 'succeeded' : 'pending';

      const { rows: paymentRows } = await db.query<{ id: string }>(
        `insert into payments
           (organization_id, branch_id, user_id, invoice_id, reference, state, method, provider,
            provider_payment_id, currency, amount_minor, fee_minor, net_minor, received_at,
            settled_at, bank_reference, depositor_name, reconciled_at, reconciled_by,
            collected_by_user_id, receipt_number, idempotency_key, metadata)
         values ($1,$2,$3,$4,$5,$6::payment_state,$7::payment_method_kind,$8,$9,$10,$11,$12,$13,
                 coalesce($14, now()), case when $6 = 'succeeded' then now() else null end,
                 $15,$16, case when $7 = 'cash' then now() else null end,
                 case when $7 = 'cash' then $17 else null end, $17, $18, $19, $20)
         returning id`,
        [
          actor.organizationId, input.branchId, input.userId, input.invoiceId ?? null, reference,
          state, input.method, adapter.key, intent.providerPaymentId, input.currency,
          input.amountMinor, intent.feeMinor, input.amountMinor - intent.feeMinor,
          input.receivedAt ?? null, input.bankReference ?? null, input.depositorName ?? null,
          actor.userId, receiptNumber, input.idempotencyKey,
          JSON.stringify({ note: input.note ?? null, adapterStatus: intent.status }),
        ],
      );
      const paymentId = paymentRows[0]!.id;

      let invoiceState: string | null = null;
      if (settled && input.invoiceId) {
        invoiceState = await applyPaymentToInvoice(db, input.invoiceId, input.amountMinor);
      }

      if (settled) {
        await writeLedgerGroup(
          db,
          actor,
          input.branchId,
          postPaymentReceived({
            currency: input.currency,
            reference,
            method: input.method,
            amountMinor: input.amountMinor,
            feeMinor: intent.feeMinor,
            appliedToInvoice: Boolean(input.invoiceId),
          }),
          { userId: input.userId, invoiceId: input.invoiceId ?? null, paymentId },
        );
      }

      return {
        duplicate: false as const,
        paymentId,
        receiptNumber,
        invoiceState,
        qrPayload: intent.qrPayload,
        redirectUrl: intent.redirectUrl,
        message: intent.message,
      };
    });

    if ('failed' in outcome && outcome.failed) {
      return { ok: false, message: outcome.failed };
    }
    if (outcome.duplicate) {
      return {
        ok: true,
        duplicate: true,
        paymentId: outcome.paymentId,
        receiptNumber: outcome.receiptNumber ?? undefined,
        message: 'This payment was already recorded. Nothing was charged twice.',
      };
    }

    await recordAudit({
      organizationId: actor.organizationId,
      branchId: input.branchId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'payment_record',
      entityType: 'payment',
      entityId: outcome.paymentId,
      subjectUserId: input.userId,
      summary: `Recorded ${formatMoney(input.amountMinor, input.currency)} by ${input.method.replace('_', ' ')}`,
      after: {
        amountMinor: input.amountMinor,
        method: input.method,
        invoiceId: input.invoiceId ?? null,
        reference: outcome.receiptNumber,
      },
    });

    return {
      ok: true,
      paymentId: outcome.paymentId,
      receiptNumber: outcome.receiptNumber ?? undefined,
      invoiceState: outcome.invoiceState ?? undefined,
      qrPayload: outcome.qrPayload,
      redirectUrl: outcome.redirectUrl,
      message: outcome.message ?? 'Payment recorded.',
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not record that payment.' };
  }
}

/** Recompute an invoice from its payments. The amounts decide the state. */
export async function applyPaymentToInvoice(
  db: Queryable,
  invoiceId: string,
  amountMinor: number,
): Promise<string> {
  const { rows } = await db.query<{ total_minor: string; amount_paid_minor: string; amount_refunded_minor: string; voided_at: string | null }>(
    'select total_minor, amount_paid_minor, amount_refunded_minor, voided_at from invoices where id = $1',
    [invoiceId],
  );
  const invoice = rows[0];
  if (!invoice) throw new Error('Invoice not found.');

  const paid = Number(invoice.amount_paid_minor) + amountMinor;
  const state = deriveInvoiceState({
    totalMinor: Number(invoice.total_minor),
    amountPaidMinor: paid,
    amountRefundedMinor: Number(invoice.amount_refunded_minor),
    voided: Boolean(invoice.voided_at),
  });

  await db.query(
    `update invoices
        set amount_paid_minor = $1,
            state = $2::invoice_state,
            paid_at = case when $2 = 'paid' then now() else paid_at end,
            dunning_stage = case when $2 = 'paid' then 0 else dunning_stage end
      where id = $3`,
    [paid, state, invoiceId],
  );
  return state;
}

export async function issueRefund(actor: Actor, input: RefundInput): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'finance.refund')) {
    return { ok: false, message: 'Only an owner or manager can approve refunds.' };
  }
  const session = tenantSessionFor(actor);

  try {
    const result = await withTenant(session, async (db) => {
      const { rows } = await db.query<{
        id: string; user_id: string; branch_id: string; invoice_id: string | null;
        amount_minor: string; currency: string; state: string;
      }>(
        'select id, user_id, branch_id, invoice_id, amount_minor, currency, state from payments where id = $1',
        [input.paymentId],
      );
      const payment = rows[0];
      if (!payment) throw new Error('Payment not found.');
      if (payment.state !== 'succeeded' && payment.state !== 'partially_refunded') {
        throw new Error('Only a settled payment can be refunded.');
      }

      const { rows: refunded } = await db.query<{ total: string }>(
        `select coalesce(sum(amount_minor), 0) as total from refunds
          where payment_id = $1 and state in ('succeeded','pending','processing')`,
        [input.paymentId],
      );
      const alreadyRefunded = Number(refunded[0]?.total ?? 0);
      if (alreadyRefunded + input.amountMinor > Number(payment.amount_minor)) {
        throw new Error(
          `That would refund more than was paid. ${formatMoney(Number(payment.amount_minor) - alreadyRefunded, payment.currency)} remains refundable.`,
        );
      }

      const { rows: refundRows } = await db.query<{ id: string }>(
        `insert into refunds
           (organization_id, payment_id, invoice_id, amount_minor, currency, reason, state, method,
            approved_by, processed_at, created_by)
         values ($1,$2,$3,$4,$5,$6,'succeeded',$7::payment_method_kind,$8,now(),$8)
         returning id`,
        [
          actor.organizationId, payment.id, payment.invoice_id, input.amountMinor, payment.currency,
          input.reason, input.method, actor.userId,
        ],
      );
      const refundId = refundRows[0]!.id;

      const totalRefunded = alreadyRefunded + input.amountMinor;
      await db.query(
        `update payments set state = $1::payment_state where id = $2`,
        [totalRefunded >= Number(payment.amount_minor) ? 'refunded' : 'partially_refunded', payment.id],
      );
      if (payment.invoice_id) {
        await db.query(
          'update invoices set amount_refunded_minor = amount_refunded_minor + $1 where id = $2',
          [input.amountMinor, payment.invoice_id],
        );
      }

      await writeLedgerGroup(
        db,
        actor,
        payment.branch_id,
        postRefund({
          currency: payment.currency,
          reference: refundId,
          method: input.method,
          amountMinor: input.amountMinor,
        }),
        { userId: payment.user_id, invoiceId: payment.invoice_id, paymentId: payment.id, refundId },
      );

      return { refundId, userId: payment.user_id, currency: payment.currency };
    });

    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'refund',
      entityType: 'refund',
      entityId: result.refundId,
      subjectUserId: result.userId,
      summary: `Refunded ${formatMoney(input.amountMinor, result.currency)}`,
      reason: input.reason,
      after: { amountMinor: input.amountMinor, method: input.method },
    });

    return { ok: true, message: `Refund of ${formatMoney(input.amountMinor, result.currency)} recorded.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Refund failed.' };
  }
}

async function writeLedgerGroup(
  db: Queryable,
  actor: Actor,
  branchId: string,
  group: LedgerEntryGroup,
  links: { userId: string; invoiceId?: string | null; paymentId?: string | null; refundId?: string | null },
): Promise<void> {
  const entryGroup = crypto.randomUUID();
  for (const posting of group.postings) {
    await db.query(
      `insert into ledger_entries
         (organization_id, branch_id, entry_group, account, direction, amount_minor, currency,
          user_id, invoice_id, payment_id, refund_id, memo, created_by)
       values ($1,$2,$3,$4::ledger_account,$5::ledger_direction,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        actor.organizationId, branchId, entryGroup, posting.account, posting.direction,
        posting.amountMinor, group.currency, links.userId, links.invoiceId ?? null,
        links.paymentId ?? null, links.refundId ?? null, posting.memo, actor.userId,
      ],
    );
  }
}

async function nextReference(db: Queryable, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const column = prefix === 'PAY' ? 'reference' : 'receipt_number';
  const { rows } = await db.query<{ value: string | null }>(
    `select max(${column}) as value from payments where ${column} like $1`,
    [`${prefix}-${year}-%`],
  );
  const last = rows[0]?.value;
  const sequence = last ? Number(last.split('-').pop()) + 1 : 1;
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Finance reporting
// ---------------------------------------------------------------------------

export interface FinanceOverview {
  collectedThisMonthMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  refundedThisMonthMinor: number;
  unreconciledCount: number;
  byMethod: Array<{ method: string; count: number; grossMinor: number; unreconciled: number }>;
  overdueInvoices: Array<{ id: string; number: string; memberName: string; userId: string; balanceMinor: number; daysOverdue: number; dunningStage: number }>;
  ledgerBalances: Array<{ account: string; netMinor: number }>;
}

export async function loadFinanceOverview(actor: Actor): Promise<FinanceOverview> {
  const session = tenantSessionFor(actor);
  return withTenant(session, async (db) => {
    const [totals, methods, overdue, ledger] = await Promise.all([
      db.query<{ collected: string; outstanding: string; overdue: string; refunded: string; unreconciled: string }>(
        `select
           (select coalesce(sum(amount_minor),0) from payments where state='succeeded' and received_at >= date_trunc('month', now())) as collected,
           (select coalesce(sum(total_minor - amount_paid_minor),0) from invoices where state in ('open','partially_paid')) as outstanding,
           (select coalesce(sum(total_minor - amount_paid_minor),0) from invoices where state in ('open','partially_paid') and due_at < now()) as overdue,
           (select coalesce(sum(amount_minor),0) from refunds where state='succeeded' and created_at >= date_trunc('month', now())) as refunded,
           (select count(*) from payments where reconciled_at is null and state='succeeded') as unreconciled`,
      ),
      db.query<{ method: string; payment_count: string; gross_minor: string; unreconciled_count: string }>(
        `select method::text as method, sum(payment_count) as payment_count, sum(gross_minor) as gross_minor,
                sum(unreconciled_count) as unreconciled_count
           from collections_by_method
          where month >= date_trunc('month', now())
          group by method order by gross_minor desc`,
      ),
      db.query<{ id: string; number: string; full_name: string; user_id: string; balance_minor: string; days_overdue: string; dunning_stage: number }>(
        `select i.id, i.number, u.full_name, i.user_id, (i.total_minor - i.amount_paid_minor) as balance_minor,
                greatest(0, extract(day from (now() - i.due_at))::int) as days_overdue, i.dunning_stage
           from invoices i join users u on u.id = i.user_id
          where i.state in ('open','partially_paid') and i.due_at < now()
          order by i.due_at asc limit 25`,
      ),
      db.query<{ account: string; net_minor: string }>(
        `select account::text as account,
                sum(case when direction='credit' then amount_minor else -amount_minor end) as net_minor
           from ledger_entries group by account order by account`,
      ),
    ]);

    const t = totals.rows[0]!;
    return {
      collectedThisMonthMinor: Number(t.collected),
      outstandingMinor: Number(t.outstanding),
      overdueMinor: Number(t.overdue),
      refundedThisMonthMinor: Number(t.refunded),
      unreconciledCount: Number(t.unreconciled),
      byMethod: methods.rows.map((row) => ({
        method: row.method,
        count: Number(row.payment_count),
        grossMinor: Number(row.gross_minor),
        unreconciled: Number(row.unreconciled_count),
      })),
      overdueInvoices: overdue.rows.map((row) => ({
        id: row.id,
        number: row.number,
        memberName: row.full_name,
        userId: row.user_id,
        balanceMinor: Number(row.balance_minor),
        daysOverdue: Number(row.days_overdue),
        dunningStage: row.dunning_stage,
      })),
      ledgerBalances: ledger.rows.map((row) => ({ account: row.account, netMinor: Number(row.net_minor) })),
    };
  });
}

/** Bank reconciliation: mark transfers as matched against a statement. */
export async function reconcilePayments(
  actor: Actor,
  paymentIds: string[],
  statementReference?: string,
): Promise<{ ok: boolean; count: number; message: string }> {
  if (!can(actor, 'finance.write')) return { ok: false, count: 0, message: 'Not permitted.' };
  const session = tenantSessionFor(actor);
  const count = await withTenant(session, async (db) => {
    const result = await db.query(
      `update payments set reconciled_at = now(), reconciled_by = $1,
              metadata = metadata || jsonb_build_object('statement_reference', $2::text)
        where id = any($3::uuid[]) and reconciled_at is null`,
      [actor.userId, statementReference ?? null, paymentIds],
    );
    return result.rowCount ?? 0;
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'update',
    entityType: 'payment',
    summary: `Reconciled ${count} payment(s)${statementReference ? ` against ${statementReference}` : ''}`,
  });

  return { ok: true, count, message: `${count} payment(s) reconciled.` };
}
