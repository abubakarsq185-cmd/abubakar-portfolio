/**
 * Invoice arithmetic and tax. Tax is computed per line so a gym can sell a
 * taxable product alongside a zero-rated membership on the same invoice, which
 * is what tax-ready invoicing actually requires.
 */
import { add, applyBps, clampNonNegative, money, multiply, zero, type Money } from './money';

export type InvoiceLineKind =
  | 'membership'
  | 'joining_fee'
  | 'class_pack'
  | 'pt_package'
  | 'product'
  | 'freeze_fee'
  | 'proration_charge'
  | 'proration_credit'
  | 'late_fee'
  | 'adjustment';

export interface DraftLine {
  description: string;
  lineKind: InvoiceLineKind;
  membershipPlanId?: string | null;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateBps?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface ComputedLine extends DraftLine {
  grossMinor: number;
  discountMinor: number;
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxRateBps: number;
}

export interface ComputedInvoice {
  currency: string;
  lines: ComputedLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  /** True when every line is zero-rated — keeps "Tax: Rs 0" off the receipt. */
  taxExempt: boolean;
}

export function computeInvoice(lines: DraftLine[], currency = 'PKR'): ComputedInvoice {
  const computed: ComputedLine[] = lines.map((line) => {
    if (line.quantity <= 0) throw new Error(`Line "${line.description}" needs a positive quantity`);
    const gross = multiply(money(line.unitPriceMinor, currency), line.quantity);
    const discount = clampNonNegative(money(line.discountMinor ?? 0, currency));
    if (discount.amountMinor > gross.amountMinor) {
      throw new Error(`Discount on "${line.description}" exceeds the line value`);
    }
    const net = money(gross.amountMinor - discount.amountMinor, currency);
    const taxRateBps = line.taxRateBps ?? 0;
    const isCredit = line.lineKind === 'proration_credit';
    const signedNet = isCredit ? money(-Math.abs(net.amountMinor), currency) : net;
    const tax = applyBps(money(Math.abs(signedNet.amountMinor), currency), taxRateBps);
    const signedTax = isCredit ? money(-tax.amountMinor, currency) : tax;

    return {
      ...line,
      taxRateBps,
      grossMinor: isCredit ? -Math.abs(gross.amountMinor) : gross.amountMinor,
      discountMinor: discount.amountMinor,
      netMinor: signedNet.amountMinor,
      taxMinor: signedTax.amountMinor,
      totalMinor: signedNet.amountMinor + signedTax.amountMinor,
    };
  });

  const subtotal = computed.reduce((acc, l) => acc + l.netMinor, 0);
  const discount = computed.reduce((acc, l) => acc + l.discountMinor, 0);
  const tax = computed.reduce((acc, l) => acc + l.taxMinor, 0);

  return {
    currency,
    lines: computed,
    subtotalMinor: subtotal,
    discountMinor: discount,
    taxMinor: tax,
    totalMinor: subtotal + tax,
    taxExempt: computed.every((l) => l.taxRateBps === 0),
  };
}

export interface DiscountRule {
  discountKind: 'percent' | 'fixed' | 'free_days';
  percentOffBps?: number | null;
  amountOffMinor?: number | null;
  freeDays?: number | null;
  appliesToPlanIds?: string[];
}

/** Apply a promotion to a single plan price. Never produces a negative price. */
export function applyPromotion(
  planPrice: Money,
  planId: string,
  promotion: DiscountRule | null,
): { discount: Money; freeDays: number } {
  if (!promotion) return { discount: zero(planPrice.currency), freeDays: 0 };
  if (promotion.appliesToPlanIds?.length && !promotion.appliesToPlanIds.includes(planId)) {
    return { discount: zero(planPrice.currency), freeDays: 0 };
  }
  if (promotion.discountKind === 'percent') {
    const discount = applyBps(planPrice, promotion.percentOffBps ?? 0);
    return { discount: money(Math.min(discount.amountMinor, planPrice.amountMinor), planPrice.currency), freeDays: 0 };
  }
  if (promotion.discountKind === 'fixed') {
    const requested = promotion.amountOffMinor ?? 0;
    return { discount: money(Math.min(requested, planPrice.amountMinor), planPrice.currency), freeDays: 0 };
  }
  return { discount: zero(planPrice.currency), freeDays: promotion.freeDays ?? 0 };
}

export type InvoiceStateName =
  | 'draft'
  | 'open'
  | 'paid'
  | 'partially_paid'
  | 'void'
  | 'uncollectible'
  | 'refunded';

/**
 * The invoice's state is *derived* from money, never set by hand. This is the
 * "payment status is not the source of truth" rule in code: we compare the
 * ledger-backed paid amount with the invoice total.
 */
export function deriveInvoiceState(input: {
  totalMinor: number;
  amountPaidMinor: number;
  amountRefundedMinor: number;
  voided: boolean;
  writtenOff?: boolean;
}): InvoiceStateName {
  if (input.voided) return 'void';
  if (input.writtenOff) return 'uncollectible';
  if (input.amountRefundedMinor > 0 && input.amountRefundedMinor >= input.amountPaidMinor && input.amountPaidMinor > 0) {
    return 'refunded';
  }
  if (input.amountPaidMinor <= 0) return 'open';
  if (input.amountPaidMinor >= input.totalMinor) return 'paid';
  return 'partially_paid';
}

export function invoiceBalanceMinor(input: { totalMinor: number; amountPaidMinor: number }): number {
  return Math.max(0, input.totalMinor - input.amountPaidMinor);
}

export function nextInvoiceNumber(prefix: string, lastNumber: string | null, year: number): string {
  const expectedPrefix = `${prefix}-${year}-`;
  if (!lastNumber || !lastNumber.startsWith(expectedPrefix)) return `${expectedPrefix}0001`;
  const sequence = Number(lastNumber.slice(expectedPrefix.length));
  const next = Number.isFinite(sequence) ? sequence + 1 : 1;
  return `${expectedPrefix}${String(next).padStart(4, '0')}`;
}

export function receiptNumber(prefix: string, sequence: number, year: number): string {
  return `${prefix}-R-${year}-${String(sequence).padStart(5, '0')}`;
}

/** Sum of tax by rate, for a tax-ready invoice footer. */
export function taxBreakdown(invoice: ComputedInvoice): Array<{ rateBps: number; baseMinor: number; taxMinor: number }> {
  const map = new Map<number, { rateBps: number; baseMinor: number; taxMinor: number }>();
  for (const line of invoice.lines) {
    const entry = map.get(line.taxRateBps) ?? { rateBps: line.taxRateBps, baseMinor: 0, taxMinor: 0 };
    entry.baseMinor += line.netMinor;
    entry.taxMinor += line.taxMinor;
    map.set(line.taxRateBps, entry);
  }
  return [...map.values()].sort((a, b) => a.rateBps - b.rateBps);
}

export function totalOf(invoice: ComputedInvoice): Money {
  return add(money(invoice.subtotalMinor, invoice.currency), money(invoice.taxMinor, invoice.currency));
}
