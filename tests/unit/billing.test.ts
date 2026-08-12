import { describe, expect, it } from 'vitest';
import {
  DUNNING_SCHEDULE,
  addMonths,
  allocateByWeights,
  applyFreeze,
  applyPromotion,
  assertBalanced,
  computeInvoice,
  computePeriod,
  deriveInvoiceState,
  journalIsBalanced,
  money,
  nextDunningStep,
  nextInvoiceNumber,
  planPaymentRetry,
  postInvoiceIssued,
  postPaymentReceived,
  postRefund,
  prorateChange,
  summariseBalances,
  taxBreakdown,
} from '@gymguide/domain';

describe('money', () => {
  it('refuses fractional minor units', () => {
    expect(() => money(10.5)).toThrow(/integer/);
  });

  it('refuses to mix currencies', () => {
    expect(() => allocateByWeights(money(100, 'PKR'), [1, 1])).not.toThrow();
  });

  it('allocates without losing a single paisa', () => {
    const parts = allocateByWeights(money(1000), [1, 1, 1]);
    expect(parts.map((p) => p.amountMinor)).toEqual([334, 333, 333]);
    expect(parts.reduce((s, p) => s + p.amountMinor, 0)).toBe(1000);
  });
});

describe('invoice computation', () => {
  it('computes per-line tax and totals', () => {
    const invoice = computeInvoice(
      [
        { description: 'Monthly membership', lineKind: 'membership', quantity: 1, unitPriceMinor: 800_000, taxRateBps: 0 },
        { description: 'Joining fee', lineKind: 'joining_fee', quantity: 1, unitPriceMinor: 200_000, taxRateBps: 0 },
        { description: 'Shaker bottle', lineKind: 'product', quantity: 2, unitPriceMinor: 60_000, taxRateBps: 1700 },
      ],
      'PKR',
    );
    expect(invoice.subtotalMinor).toBe(1_120_000);
    expect(invoice.taxMinor).toBe(20_400);
    expect(invoice.totalMinor).toBe(1_140_400);
    expect(invoice.taxExempt).toBe(false);
  });

  it('rejects a discount larger than the line', () => {
    expect(() =>
      computeInvoice([
        { description: 'Membership', lineKind: 'membership', quantity: 1, unitPriceMinor: 100, discountMinor: 200 },
      ]),
    ).toThrow(/exceeds the line value/);
  });

  it('treats a proration credit as a negative line', () => {
    const invoice = computeInvoice([
      { description: 'Unused days', lineKind: 'proration_credit', quantity: 1, unitPriceMinor: 300_000 },
      { description: 'New plan remainder', lineKind: 'proration_charge', quantity: 1, unitPriceMinor: 500_000 },
    ]);
    expect(invoice.subtotalMinor).toBe(200_000);
  });

  it('groups tax for a tax-ready footer', () => {
    const invoice = computeInvoice([
      { description: 'A', lineKind: 'product', quantity: 1, unitPriceMinor: 10_000, taxRateBps: 1700 },
      { description: 'B', lineKind: 'product', quantity: 1, unitPriceMinor: 10_000, taxRateBps: 1700 },
      { description: 'C', lineKind: 'membership', quantity: 1, unitPriceMinor: 50_000, taxRateBps: 0 },
    ]);
    const breakdown = taxBreakdown(invoice);
    expect(breakdown).toHaveLength(2);
    expect(breakdown.find((b) => b.rateBps === 1700)?.taxMinor).toBe(3_400);
  });
});

describe('invoice state is derived from money, not set by hand', () => {
  it('derives open, partially paid, paid and refunded', () => {
    const base = { totalMinor: 1000, amountRefundedMinor: 0, voided: false };
    expect(deriveInvoiceState({ ...base, amountPaidMinor: 0 })).toBe('open');
    expect(deriveInvoiceState({ ...base, amountPaidMinor: 400 })).toBe('partially_paid');
    expect(deriveInvoiceState({ ...base, amountPaidMinor: 1000 })).toBe('paid');
    expect(deriveInvoiceState({ ...base, amountPaidMinor: 1200 })).toBe('paid');
    expect(deriveInvoiceState({ totalMinor: 1000, amountPaidMinor: 1000, amountRefundedMinor: 1000, voided: false })).toBe('refunded');
    expect(deriveInvoiceState({ ...base, amountPaidMinor: 500, voided: true })).toBe('void');
    expect(deriveInvoiceState({ ...base, amountPaidMinor: 0, writtenOff: true })).toBe('uncollectible');
  });
});

describe('promotions', () => {
  it('caps a percentage discount at the plan price', () => {
    const { discount } = applyPromotion(money(500_000), 'plan-1', {
      discountKind: 'percent',
      percentOffBps: 15_000,
    });
    expect(discount.amountMinor).toBe(500_000);
  });

  it('ignores a promotion that does not apply to the plan', () => {
    const { discount } = applyPromotion(money(500_000), 'plan-2', {
      discountKind: 'fixed',
      amountOffMinor: 100_000,
      appliesToPlanIds: ['plan-1'],
    });
    expect(discount.amountMinor).toBe(0);
  });

  it('returns free days rather than a discount for free_days promotions', () => {
    const result = applyPromotion(money(500_000), 'plan-1', { discountKind: 'free_days', freeDays: 14 });
    expect(result.discount.amountMinor).toBe(0);
    expect(result.freeDays).toBe(14);
  });
});

describe('double-entry ledger', () => {
  it('balances an invoice with a discount and tax', () => {
    const group = postInvoiceIssued({
      currency: 'PKR',
      invoiceNumber: 'APX-2026-0001',
      lines: [
        { lineKind: 'membership', netMinor: 700_000, discountMinor: 100_000, taxMinor: 0, description: 'Membership' },
        { lineKind: 'product', netMinor: 100_000, discountMinor: 0, taxMinor: 17_000, description: 'Bottle' },
      ],
    });
    expect(() => assertBalanced(group)).not.toThrow();
    const accounts = group.postings.map((p) => p.account);
    expect(accounts).toContain('accounts_receivable');
    expect(accounts).toContain('discounts');
    expect(accounts).toContain('membership_revenue');
    expect(accounts).toContain('tax_payable');
  });

  it('routes a cash payment to the cash account and clears the receivable', () => {
    const group = postPaymentReceived({
      currency: 'PKR',
      reference: 'PAY-1',
      method: 'cash',
      amountMinor: 800_000,
      appliedToInvoice: true,
    });
    expect(group.postings.find((p) => p.direction === 'debit')?.account).toBe('cash');
    expect(group.postings.find((p) => p.direction === 'credit')?.account).toBe('accounts_receivable');
  });

  it('books a processor fee separately and still balances', () => {
    const group = postPaymentReceived({
      currency: 'PKR',
      reference: 'PAY-2',
      method: 'card',
      amountMinor: 100_000,
      feeMinor: 2_900,
      appliedToInvoice: true,
    });
    expect(() => assertBalanced(group)).not.toThrow();
    expect(group.postings.find((p) => p.account === 'processor_fees')?.amountMinor).toBe(2_900);
    expect(group.postings.find((p) => p.account === 'card_clearing')?.amountMinor).toBe(97_100);
  });

  it('holds an unapplied payment in deferred revenue, not revenue', () => {
    const group = postPaymentReceived({
      currency: 'PKR',
      reference: 'PAY-3',
      method: 'bank_transfer',
      amountMinor: 50_000,
      appliedToInvoice: false,
    });
    expect(group.postings.find((p) => p.direction === 'credit')?.account).toBe('deferred_revenue');
  });

  it('rejects an unbalanced group before it can be written', () => {
    expect(() =>
      assertBalanced({
        reason: 'bad',
        currency: 'PKR',
        postings: [
          { account: 'cash', direction: 'debit', amountMinor: 100, memo: 'x' },
          { account: 'accounts_receivable', direction: 'credit', amountMinor: 90, memo: 'y' },
        ],
      }),
    ).toThrow(/Unbalanced/);
  });

  it('rejects a zero-value posting', () => {
    expect(() =>
      assertBalanced({
        reason: 'bad',
        currency: 'PKR',
        postings: [
          { account: 'cash', direction: 'debit', amountMinor: 0, memo: 'x' },
          { account: 'accounts_receivable', direction: 'credit', amountMinor: 0, memo: 'y' },
        ],
      }),
    ).toThrow(/non-positive/);
  });

  it('keeps the whole journal balanced across events', () => {
    const rows = [
      ...postInvoiceIssued({
        currency: 'PKR',
        invoiceNumber: 'APX-2026-0002',
        lines: [{ lineKind: 'membership', netMinor: 800_000, discountMinor: 0, taxMinor: 0, description: 'M' }],
      }).postings,
      ...postPaymentReceived({ currency: 'PKR', reference: 'P', method: 'cash', amountMinor: 800_000, appliedToInvoice: true }).postings,
      ...postRefund({ currency: 'PKR', reference: 'R', method: 'cash', amountMinor: 200_000 }).postings,
    ];
    expect(journalIsBalanced(rows)).toBe(true);
    const balances = summariseBalances(rows.map((r) => ({ account: r.account, direction: r.direction, amountMinor: r.amountMinor })));
    expect(balances.find((b) => b.account === 'accounts_receivable')?.netMinor).toBe(0);
    expect(balances.find((b) => b.account === 'cash')?.netMinor).toBe(-600_000);
  });
});

describe('billing periods and proration', () => {
  it('handles month-end rollover without inventing a 31st of February', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('computes an inclusive monthly period', () => {
    const period = computePeriod('2026-08-01', 'monthly');
    expect(period.end).toBe('2026-08-31');
    expect(period.nextInvoiceOn).toBe('2026-09-01');
  });

  it('extends the period by promotional free days', () => {
    expect(computePeriod('2026-08-01', 'monthly', 14).end).toBe('2026-09-14');
  });

  it('prorates an upgrade day by day', () => {
    const result = prorateChange({
      currency: 'PKR',
      effectiveOn: '2026-08-16',
      currentPeriod: { start: '2026-08-01', end: '2026-08-31' },
      currentPricePaidMinor: 620_000,
      newPlanPriceMinor: 1_240_000,
      currentPlanName: 'Essential',
      newPlanName: 'Performance',
    });
    expect(result.totalDays).toBe(31);
    expect(result.unusedDays).toBe(16);
    expect(result.creditMinor).toBe(320_000);
    expect(result.chargeMinor).toBe(640_000);
    expect(result.netMinor).toBe(320_000);
    expect(result.lines).toHaveLength(2);
  });

  it('prorates nothing when the change lands after the period', () => {
    const result = prorateChange({
      currency: 'PKR',
      effectiveOn: '2026-09-05',
      currentPeriod: { start: '2026-08-01', end: '2026-08-31' },
      currentPricePaidMinor: 620_000,
      newPlanPriceMinor: 900_000,
      currentPlanName: 'A',
      newPlanName: 'B',
    });
    expect(result.unusedDays).toBe(0);
    expect(result.lines).toHaveLength(0);
    expect(result.explanation).toMatch(/nothing to prorate/);
  });
});

describe('freezes', () => {
  it('extends the period by the frozen days', () => {
    const result = applyFreeze({
      period: { start: '2026-08-01', end: '2026-08-31' },
      freezeStart: '2026-08-10',
      freezeEnd: '2026-08-19',
      allowanceDaysRemaining: 30,
      feeMinor: 0,
    });
    expect(result.frozenDays).toBe(10);
    expect(result.newPeriodEnd).toBe('2026-09-10');
    expect(result.allowanceRemaining).toBe(20);
    expect(result.rejection).toBeNull();
  });

  it('refuses a freeze longer than the plan allowance', () => {
    const result = applyFreeze({
      period: { start: '2026-08-01', end: '2026-08-31' },
      freezeStart: '2026-08-01',
      freezeEnd: '2026-08-31',
      allowanceDaysRemaining: 14,
      feeMinor: 0,
    });
    expect(result.rejection).toMatch(/allows 14 more freeze days/);
    expect(result.newPeriodEnd).toBe('2026-08-31');
  });
});

describe('failed payment recovery', () => {
  it('escalates through the dunning schedule', () => {
    expect(nextDunningStep(0, 0)?.stage).toBe(1);
    expect(nextDunningStep(2, 1)?.stage).toBe(2);
    expect(nextDunningStep(9, 2)?.stage).toBe(4);
    expect(nextDunningStep(30, 5)).toBeNull();
  });

  it('creates a staff task before anything becomes final', () => {
    const firm = DUNNING_SCHEDULE.filter((s) => s.tone !== 'reminder');
    expect(firm.every((s) => s.createsStaffTask)).toBe(true);
  });

  it('backs off card retries then hands over to a human', () => {
    expect(planPaymentRetry(1, '2026-08-01T00:00:00.000Z').retryAt).toBe('2026-08-02T00:00:00.000Z');
    expect(planPaymentRetry(3, '2026-08-01T00:00:00.000Z').retryAt).toBe('2026-08-08T00:00:00.000Z');
    expect(planPaymentRetry(4, '2026-08-01T00:00:00.000Z').giveUp).toBe(true);
  });
});

describe('invoice numbering', () => {
  it('starts a new sequence each year and increments safely', () => {
    expect(nextInvoiceNumber('APX', null, 2026)).toBe('APX-2026-0001');
    expect(nextInvoiceNumber('APX', 'APX-2026-0009', 2026)).toBe('APX-2026-0010');
    expect(nextInvoiceNumber('APX', 'APX-2025-0450', 2026)).toBe('APX-2026-0001');
  });
});
