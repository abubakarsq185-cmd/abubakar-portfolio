/**
 * Double-entry ledger postings.
 *
 * Every money event produces a balanced entry group. `assertBalanced` runs
 * before anything is written, so an unbalanced journal cannot reach the
 * database. Corrections are new balancing groups — ledger_entries is
 * append-only at the database level too.
 */
import type { LedgerAccount, LedgerDirection, PaymentMethodKind } from '@gymguide/types';

export interface LedgerPosting {
  account: LedgerAccount;
  direction: LedgerDirection;
  amountMinor: number;
  memo: string;
}

export interface LedgerEntryGroup {
  reason: string;
  currency: string;
  postings: LedgerPosting[];
}

export function assertBalanced(group: LedgerEntryGroup): void {
  const debits = group.postings
    .filter((p) => p.direction === 'debit')
    .reduce((sum, p) => sum + p.amountMinor, 0);
  const credits = group.postings
    .filter((p) => p.direction === 'credit')
    .reduce((sum, p) => sum + p.amountMinor, 0);
  if (debits !== credits) {
    throw new Error(
      `Unbalanced ledger group "${group.reason}": debits ${debits} ≠ credits ${credits}`,
    );
  }
  if (group.postings.some((p) => p.amountMinor <= 0)) {
    throw new Error(`Ledger group "${group.reason}" contains a non-positive posting`);
  }
}

const REVENUE_ACCOUNT: Record<string, LedgerAccount> = {
  membership: 'membership_revenue',
  joining_fee: 'joining_fee_revenue',
  class_pack: 'class_revenue',
  pt_package: 'pt_revenue',
  product: 'product_revenue',
  freeze_fee: 'membership_revenue',
  proration_charge: 'membership_revenue',
  proration_credit: 'membership_revenue',
  late_fee: 'product_revenue',
  adjustment: 'product_revenue',
};

export function revenueAccountFor(lineKind: string): LedgerAccount {
  return REVENUE_ACCOUNT[lineKind] ?? 'product_revenue';
}

const SETTLEMENT_ACCOUNT: Record<PaymentMethodKind, LedgerAccount> = {
  cash: 'cash',
  bank_transfer: 'bank',
  card: 'card_clearing',
  wallet: 'wallet_clearing',
  qr: 'wallet_clearing',
  cheque: 'bank',
  credit_note: 'deferred_revenue',
  other: 'cash',
};

export function settlementAccountFor(method: PaymentMethodKind): LedgerAccount {
  return SETTLEMENT_ACCOUNT[method];
}

/**
 * Issuing an invoice recognises receivable + revenue + tax, and books the
 * discount as a contra-revenue debit so gross revenue stays visible.
 *
 *   Dr Accounts receivable   (net + tax)
 *   Dr Discounts             (discount)
 *   Cr Revenue               (gross)
 *   Cr Tax payable           (tax)
 */
export function postInvoiceIssued(input: {
  currency: string;
  invoiceNumber: string;
  lines: Array<{ lineKind: string; netMinor: number; discountMinor: number; taxMinor: number; description: string }>;
}): LedgerEntryGroup {
  const postings: LedgerPosting[] = [];
  let receivable = 0;
  let taxTotal = 0;

  const revenueByAccount = new Map<LedgerAccount, number>();
  let discountTotal = 0;

  for (const line of input.lines) {
    const account = revenueAccountFor(line.lineKind);
    const gross = line.netMinor + line.discountMinor;
    revenueByAccount.set(account, (revenueByAccount.get(account) ?? 0) + gross);
    discountTotal += line.discountMinor;
    receivable += line.netMinor + line.taxMinor;
    taxTotal += line.taxMinor;
  }

  if (receivable > 0) {
    postings.push({
      account: 'accounts_receivable',
      direction: 'debit',
      amountMinor: receivable,
      memo: `Invoice ${input.invoiceNumber} raised`,
    });
  } else if (receivable < 0) {
    // A pure credit note: receivable decreases.
    postings.push({
      account: 'accounts_receivable',
      direction: 'credit',
      amountMinor: Math.abs(receivable),
      memo: `Credit note ${input.invoiceNumber}`,
    });
  }

  if (discountTotal > 0) {
    postings.push({
      account: 'discounts',
      direction: 'debit',
      amountMinor: discountTotal,
      memo: `Discounts on ${input.invoiceNumber}`,
    });
  }

  for (const [account, amount] of revenueByAccount) {
    if (amount === 0) continue;
    postings.push({
      account,
      direction: amount > 0 ? 'credit' : 'debit',
      amountMinor: Math.abs(amount),
      memo: `Revenue recognised on ${input.invoiceNumber}`,
    });
  }

  if (taxTotal !== 0) {
    postings.push({
      account: 'tax_payable',
      direction: taxTotal > 0 ? 'credit' : 'debit',
      amountMinor: Math.abs(taxTotal),
      memo: `Tax on ${input.invoiceNumber}`,
    });
  }

  const group: LedgerEntryGroup = {
    reason: `invoice_issued:${input.invoiceNumber}`,
    currency: input.currency,
    postings,
  };
  assertBalanced(group);
  return group;
}

/**
 * Receiving money clears the receivable and books any processor fee.
 *
 *   Dr Cash / Bank / Clearing  (net)
 *   Dr Processor fees          (fee)
 *   Cr Accounts receivable     (gross)
 *
 * A payment with no invoice (a deposit or an on-account payment) credits
 * deferred revenue instead, so it is never mistaken for earned revenue.
 */
export function postPaymentReceived(input: {
  currency: string;
  reference: string;
  method: PaymentMethodKind;
  amountMinor: number;
  feeMinor?: number;
  appliedToInvoice: boolean;
}): LedgerEntryGroup {
  const fee = input.feeMinor ?? 0;
  if (fee < 0 || fee > input.amountMinor) throw new Error('Processor fee must be between 0 and the payment amount');

  const postings: LedgerPosting[] = [
    {
      account: settlementAccountFor(input.method),
      direction: 'debit',
      amountMinor: input.amountMinor - fee,
      memo: `Payment ${input.reference} received (${input.method})`,
    },
  ];
  if (fee > 0) {
    postings.push({
      account: 'processor_fees',
      direction: 'debit',
      amountMinor: fee,
      memo: `Processor fee on ${input.reference}`,
    });
  }
  postings.push({
    account: input.appliedToInvoice ? 'accounts_receivable' : 'deferred_revenue',
    direction: 'credit',
    amountMinor: input.amountMinor,
    memo: input.appliedToInvoice
      ? `Receivable settled by ${input.reference}`
      : `Unapplied payment ${input.reference} held on account`,
  });

  const group: LedgerEntryGroup = {
    reason: `payment_received:${input.reference}`,
    currency: input.currency,
    postings,
  };
  assertBalanced(group);
  return group;
}

/**
 *   Dr Refunds (contra-revenue)
 *   Cr Cash / Bank / Clearing
 */
export function postRefund(input: {
  currency: string;
  reference: string;
  method: PaymentMethodKind;
  amountMinor: number;
}): LedgerEntryGroup {
  const group: LedgerEntryGroup = {
    reason: `refund:${input.reference}`,
    currency: input.currency,
    postings: [
      {
        account: 'refunds',
        direction: 'debit',
        amountMinor: input.amountMinor,
        memo: `Refund issued (${input.reference})`,
      },
      {
        account: settlementAccountFor(input.method),
        direction: 'credit',
        amountMinor: input.amountMinor,
        memo: `Refund paid out via ${input.method}`,
      },
    ],
  };
  assertBalanced(group);
  return group;
}

/**
 *   Dr Write-off
 *   Cr Accounts receivable
 */
export function postWriteOff(input: {
  currency: string;
  invoiceNumber: string;
  amountMinor: number;
  reason: string;
}): LedgerEntryGroup {
  const group: LedgerEntryGroup = {
    reason: `write_off:${input.invoiceNumber}`,
    currency: input.currency,
    postings: [
      {
        account: 'write_off',
        direction: 'debit',
        amountMinor: input.amountMinor,
        memo: `Written off: ${input.reason}`,
      },
      {
        account: 'accounts_receivable',
        direction: 'credit',
        amountMinor: input.amountMinor,
        memo: `Receivable cleared on ${input.invoiceNumber}`,
      },
    ],
  };
  assertBalanced(group);
  return group;
}

/** Move a settled card/wallet balance into the bank once the processor pays out. */
export function postSettlement(input: {
  currency: string;
  batchReference: string;
  fromAccount: Extract<LedgerAccount, 'card_clearing' | 'wallet_clearing'>;
  amountMinor: number;
}): LedgerEntryGroup {
  const group: LedgerEntryGroup = {
    reason: `settlement:${input.batchReference}`,
    currency: input.currency,
    postings: [
      { account: 'bank', direction: 'debit', amountMinor: input.amountMinor, memo: `Settlement ${input.batchReference}` },
      {
        account: input.fromAccount,
        direction: 'credit',
        amountMinor: input.amountMinor,
        memo: `Cleared ${input.fromAccount}`,
      },
    ],
  };
  assertBalanced(group);
  return group;
}

export interface AccountBalance {
  account: LedgerAccount;
  debitMinor: number;
  creditMinor: number;
  netMinor: number;
}

/** Roll a list of postings into account balances (used by the finance report). */
export function summariseBalances(
  rows: Array<{ account: LedgerAccount; direction: LedgerDirection; amountMinor: number }>,
): AccountBalance[] {
  const map = new Map<LedgerAccount, AccountBalance>();
  for (const row of rows) {
    const entry = map.get(row.account) ?? { account: row.account, debitMinor: 0, creditMinor: 0, netMinor: 0 };
    if (row.direction === 'debit') entry.debitMinor += row.amountMinor;
    else entry.creditMinor += row.amountMinor;
    entry.netMinor = entry.creditMinor - entry.debitMinor;
    map.set(row.account, entry);
  }
  return [...map.values()].sort((a, b) => a.account.localeCompare(b.account));
}

/** The whole journal must balance. Used by the nightly finance integrity job. */
export function journalIsBalanced(
  rows: Array<{ direction: LedgerDirection; amountMinor: number }>,
): boolean {
  const debits = rows.filter((r) => r.direction === 'debit').reduce((s, r) => s + r.amountMinor, 0);
  const credits = rows.filter((r) => r.direction === 'credit').reduce((s, r) => s + r.amountMinor, 0);
  return debits === credits;
}
