/**
 * Membership lifecycle maths: periods, proration on upgrade/downgrade, freezes
 * and failed-payment recovery (dunning).
 */
import type { BillingInterval } from '@gymguide/types';
import { money, type Money } from './money';
import type { DraftLine } from './invoice';

const MS_PER_DAY = 86_400_000;

export function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function addMonths(value: string, months: number): string {
  const date = toDate(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toIso(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / MS_PER_DAY);
}

export interface BillingPeriod {
  start: string;
  end: string;
  nextInvoiceOn: string | null;
}

/**
 * The period a membership covers. `end` is the last covered day (inclusive),
 * which is what members expect to see on a receipt.
 */
export function computePeriod(
  startsOn: string,
  interval: BillingInterval,
  freeDays = 0,
): BillingPeriod {
  const start = startsOn;
  if (interval === 'one_time') {
    return { start, end: start, nextInvoiceOn: null };
  }
  const months: Record<Exclude<BillingInterval, 'one_time' | 'weekly'>, number> = {
    monthly: 1,
    quarterly: 3,
    biannual: 6,
    annual: 12,
  };
  const rawEnd =
    interval === 'weekly' ? addDays(start, 7) : addMonths(start, months[interval]);
  const end = addDays(rawEnd, freeDays - 1);
  return { start, end, nextInvoiceOn: addDays(end, 1) };
}

export function periodDays(period: Pick<BillingPeriod, 'start' | 'end'>): number {
  return Math.max(1, daysBetween(period.start, period.end) + 1);
}

export interface ProrationResult {
  unusedDays: number;
  totalDays: number;
  creditMinor: number;
  chargeMinor: number;
  netMinor: number;
  lines: DraftLine[];
  explanation: string;
}

/**
 * Mid-period plan change. The member is credited for the days they paid for but
 * will not use on the old plan, and charged for the same days on the new plan.
 * Day-precise, so nobody argues about it at the front desk.
 */
export function prorateChange(input: {
  currency: string;
  effectiveOn: string;
  currentPeriod: { start: string; end: string };
  currentPricePaidMinor: number;
  newPlanPriceMinor: number;
  newPlanName: string;
  currentPlanName: string;
  taxRateBps?: number;
}): ProrationResult {
  const total = periodDays(input.currentPeriod);
  const rawUnused = daysBetween(input.effectiveOn, input.currentPeriod.end) + 1;
  const unusedDays = Math.max(0, Math.min(total, rawUnused));

  const credit = Math.round((input.currentPricePaidMinor * unusedDays) / total);
  const charge = Math.round((input.newPlanPriceMinor * unusedDays) / total);
  const taxRateBps = input.taxRateBps ?? 0;

  const lines: DraftLine[] = [];
  if (credit > 0) {
    lines.push({
      description: `Unused ${unusedDays} day${unusedDays === 1 ? '' : 's'} on ${input.currentPlanName}`,
      lineKind: 'proration_credit',
      quantity: 1,
      unitPriceMinor: credit,
      taxRateBps,
    });
  }
  if (charge > 0) {
    lines.push({
      description: `${input.newPlanName} for the remaining ${unusedDays} day${unusedDays === 1 ? '' : 's'}`,
      lineKind: 'proration_charge',
      quantity: 1,
      unitPriceMinor: charge,
      taxRateBps,
    });
  }

  return {
    unusedDays,
    totalDays: total,
    creditMinor: credit,
    chargeMinor: charge,
    netMinor: charge - credit,
    lines,
    explanation:
      unusedDays === 0
        ? 'The change takes effect at the end of the current period, so there is nothing to prorate.'
        : `${unusedDays} of ${total} days remain in this period. Credited ${credit} and charged ${charge} minor units.`,
  };
}

export interface FreezeOutcome {
  frozenDays: number;
  newPeriodEnd: string;
  feeMinor: number;
  allowanceRemaining: number;
  rejection: string | null;
}

/** Freezing extends the period by the frozen days; the member loses nothing. */
export function applyFreeze(input: {
  period: { start: string; end: string };
  freezeStart: string;
  freezeEnd: string;
  allowanceDaysRemaining: number;
  feeMinor: number;
}): FreezeOutcome {
  const requested = daysBetween(input.freezeStart, input.freezeEnd) + 1;
  if (requested <= 0) {
    return {
      frozenDays: 0,
      newPeriodEnd: input.period.end,
      feeMinor: 0,
      allowanceRemaining: input.allowanceDaysRemaining,
      rejection: 'The freeze end date must be on or after the start date.',
    };
  }
  if (requested > input.allowanceDaysRemaining) {
    return {
      frozenDays: 0,
      newPeriodEnd: input.period.end,
      feeMinor: 0,
      allowanceRemaining: input.allowanceDaysRemaining,
      rejection: `This plan allows ${input.allowanceDaysRemaining} more freeze day${
        input.allowanceDaysRemaining === 1 ? '' : 's'
      } this year; ${requested} were requested.`,
    };
  }
  return {
    frozenDays: requested,
    newPeriodEnd: addDays(input.period.end, requested),
    feeMinor: input.feeMinor,
    allowanceRemaining: input.allowanceDaysRemaining - requested,
    rejection: null,
  };
}

export interface DunningStep {
  stage: number;
  dayOffset: number;
  channel: 'in_app' | 'push' | 'email' | 'sms' | 'whatsapp';
  templateKey: string;
  createsStaffTask: boolean;
  tone: 'reminder' | 'firm' | 'final';
}

/**
 * Failed-payment recovery. Escalates politely, involves a human before any
 * access is affected, and never messages inside quiet hours (enforced by the
 * notification service).
 */
export const DUNNING_SCHEDULE: DunningStep[] = [
  { stage: 1, dayOffset: 0, channel: 'in_app', templateKey: 'payment_due_today', createsStaffTask: false, tone: 'reminder' },
  { stage: 2, dayOffset: 1, channel: 'push', templateKey: 'payment_missed_gentle', createsStaffTask: false, tone: 'reminder' },
  { stage: 3, dayOffset: 3, channel: 'sms', templateKey: 'payment_missed_followup', createsStaffTask: false, tone: 'reminder' },
  { stage: 4, dayOffset: 7, channel: 'email', templateKey: 'payment_overdue_week', createsStaffTask: true, tone: 'firm' },
  { stage: 5, dayOffset: 14, channel: 'in_app', templateKey: 'payment_overdue_final', createsStaffTask: true, tone: 'final' },
];

export function nextDunningStep(daysOverdue: number, currentStage: number): DunningStep | null {
  const due = DUNNING_SCHEDULE.filter((step) => step.dayOffset <= daysOverdue && step.stage > currentStage);
  return due.length ? due[due.length - 1]! : null;
}

export interface RetryPlan {
  attempt: number;
  retryAt: string;
  giveUp: boolean;
}

/** Card retry backoff: 1 day, 3 days, 7 days, then hand to a human. */
export function planPaymentRetry(attempt: number, fromIso: string): RetryPlan {
  const offsets = [1, 3, 7];
  const offset = offsets[attempt - 1];
  if (offset === undefined) {
    return { attempt, retryAt: fromIso, giveUp: true };
  }
  const at = new Date(fromIso);
  at.setUTCDate(at.getUTCDate() + offset);
  return { attempt, retryAt: at.toISOString(), giveUp: false };
}

export function membershipStateAfterPeriod(input: {
  periodEnd: string;
  today: string;
  balanceMinor: number;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean;
  frozen: boolean;
}): 'active' | 'frozen' | 'past_due' | 'expired' | 'cancelled' {
  if (input.frozen) return 'frozen';
  const expired = daysBetween(input.today, input.periodEnd) < 0;
  if (!expired) return input.balanceMinor > 0 ? 'past_due' : 'active';
  if (input.cancelAtPeriodEnd || !input.autoRenew) return 'cancelled';
  return input.balanceMinor > 0 ? 'past_due' : 'expired';
}

export function membershipRenewalLines(input: {
  planName: string;
  planId: string;
  priceMinor: number;
  taxRateBps: number;
  period: BillingPeriod;
}): DraftLine[] {
  return [
    {
      description: `${input.planName} (${input.period.start} → ${input.period.end})`,
      lineKind: 'membership',
      membershipPlanId: input.planId,
      quantity: 1,
      unitPriceMinor: input.priceMinor,
      taxRateBps: input.taxRateBps,
      periodStart: input.period.start,
      periodEnd: input.period.end,
    },
  ];
}

export function familySplit(total: Money, memberCount: number): Money[] {
  const base = Math.floor(total.amountMinor / memberCount);
  const remainder = total.amountMinor - base * memberCount;
  return Array.from({ length: memberCount }, (_, i) =>
    money(base + (i < remainder ? 1 : 0), total.currency),
  );
}
