import { z } from 'zod';
import { currencyCode, isoDate, moneyMinor, uuid } from './common';
import { BILLING_INTERVALS, PAYMENT_METHOD_KINDS } from '../enums';

export const membershipPlanInput = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  kind: z.enum(['membership', 'class_pack', 'pt_package', 'day_pass', 'product', 'joining_fee']).default('membership'),
  branchId: uuid.nullish(),
  currency: currencyCode,
  priceMinor: moneyMinor,
  billingInterval: z.enum(BILLING_INTERVALS).default('monthly'),
  contractMonths: z.number().int().min(0).max(36).default(0),
  joiningFeeMinor: moneyMinor.default(0),
  classCredits: z.number().int().min(0).max(500).nullish(),
  ptSessions: z.number().int().min(0).max(200).nullish(),
  guestPasses: z.number().int().min(0).max(50).default(0),
  freezeDaysPerYear: z.number().int().min(0).max(365).default(0),
  maxFamilyMembers: z.number().int().min(1).max(12).default(1),
  branchAccess: z.enum(['home', 'all']).default('home'),
  taxRateBps: z.number().int().min(0).max(10000).default(0),
  isPublic: z.boolean().default(true),
});
export type MembershipPlanInput = z.infer<typeof membershipPlanInput>;

export const promotionInput = z
  .object({
    code: z.string().trim().min(3).max(40).toUpperCase(),
    label: z.string().trim().min(3).max(120),
    discountKind: z.enum(['percent', 'fixed', 'free_days']),
    percentOffBps: z.number().int().min(1).max(10000).optional(),
    amountOffMinor: moneyMinor.optional(),
    freeDays: z.number().int().min(1).max(365).optional(),
    appliesToPlanIds: z.array(uuid).default([]),
    maxRedemptions: z.number().int().min(1).max(100000).optional(),
    startsOn: isoDate,
    endsOn: isoDate.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.discountKind === 'percent' && value.percentOffBps === undefined) {
      ctx.addIssue({ code: 'custom', path: ['percentOffBps'], message: 'Set a percentage' });
    }
    if (value.discountKind === 'fixed' && value.amountOffMinor === undefined) {
      ctx.addIssue({ code: 'custom', path: ['amountOffMinor'], message: 'Set an amount' });
    }
    if (value.discountKind === 'free_days' && value.freeDays === undefined) {
      ctx.addIssue({ code: 'custom', path: ['freeDays'], message: 'Set a number of free days' });
    }
  });

export const sellMembershipInput = z.object({
  userId: uuid,
  membershipPlanId: uuid,
  branchId: uuid,
  startsOn: isoDate,
  promotionCode: z.string().trim().max(40).optional(),
  chargeJoiningFee: z.boolean().default(false),
  payerUserId: uuid.nullish(),
  autoRenew: z.boolean().default(true),
  note: z.string().trim().max(500).optional(),
});
export type SellMembershipInput = z.infer<typeof sellMembershipInput>;

/**
 * Recording a payment. `idempotencyKey` is required so a double-submitted form
 * or a retried request can never post money twice.
 */
export const recordPaymentInput = z.object({
  invoiceId: uuid.nullish(),
  userId: uuid,
  branchId: uuid,
  amountMinor: moneyMinor.refine((v) => v > 0, 'Enter an amount greater than zero'),
  currency: currencyCode,
  method: z.enum(PAYMENT_METHOD_KINDS),
  receivedAt: z.string().datetime().optional(),
  bankReference: z.string().trim().max(80).optional(),
  depositorName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
}).superRefine((value, ctx) => {
  if (value.method === 'bank_transfer' && !value.bankReference) {
    ctx.addIssue({
      code: 'custom',
      path: ['bankReference'],
      message: 'Bank transfers need a reference for reconciliation',
    });
  }
});
export type RecordPaymentInput = z.infer<typeof recordPaymentInput>;

export const refundInput = z.object({
  paymentId: uuid,
  amountMinor: moneyMinor.refine((v) => v > 0, 'Enter an amount greater than zero'),
  reason: z.string().trim().min(6, 'Give a reason for the audit trail').max(500),
  method: z.enum(PAYMENT_METHOD_KINDS),
});
export type RefundInput = z.infer<typeof refundInput>;

export const invoiceInput = z.object({
  userId: uuid,
  branchId: uuid,
  dueAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(2).max(200),
        lineKind: z
          .enum([
            'membership',
            'joining_fee',
            'class_pack',
            'pt_package',
            'product',
            'freeze_fee',
            'proration_charge',
            'proration_credit',
            'late_fee',
            'adjustment',
          ])
          .default('product'),
        membershipPlanId: uuid.nullish(),
        quantity: z.number().min(0.01).max(1000).default(1),
        unitPriceMinor: moneyMinor,
        discountMinor: moneyMinor.default(0),
        taxRateBps: z.number().int().min(0).max(10000).default(0),
      }),
    )
    .min(1, 'Add at least one line'),
});
export type InvoiceInput = z.infer<typeof invoiceInput>;

export const freezeInput = z.object({
  memberMembershipId: uuid,
  startsOn: isoDate,
  endsOn: isoDate,
  reason: z.string().trim().min(4, 'Give a reason').max(300),
  feeMinor: moneyMinor.default(0),
}).refine((v) => v.endsOn >= v.startsOn, {
  message: 'The freeze must end on or after it starts',
  path: ['endsOn'],
});

export const membershipChangeInput = z.object({
  memberMembershipId: uuid,
  toPlanId: uuid,
  effectiveOn: isoDate,
  changeKind: z.enum(['upgrade', 'downgrade', 'transfer_branch']),
  prorate: z.boolean().default(true),
  note: z.string().trim().max(500).optional(),
});

export const cancelMembershipInput = z.object({
  memberMembershipId: uuid,
  atPeriodEnd: z.boolean().default(true),
  reason: z.string().trim().min(4, 'Give a reason').max(300),
});

export const reconcilePaymentInput = z.object({
  paymentIds: z.array(uuid).min(1, 'Select at least one payment'),
  statementReference: z.string().trim().max(120).optional(),
});
