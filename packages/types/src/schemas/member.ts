import { z } from 'zod';
import {
  emailAddress,
  heightCm,
  isoDate,
  localeCode,
  personName,
  phoneNumber,
  uuid,
  weightKg,
} from './common';
import {
  CONSENT_KINDS,
  EXPERIENCE_LEVELS,
  LEAD_STATUSES,
  RISK_KINDS,
  TRAINING_GOALS,
} from '../enums';

export const leadInput = z.object({
  branchId: uuid,
  fullName: personName,
  phone: phoneNumber.optional(),
  email: emailAddress.optional(),
  source: z
    .enum(['walk_in', 'referral', 'instagram', 'facebook', 'google', 'website', 'event', 'other'])
    .default('walk_in'),
  interest: z.enum(TRAINING_GOALS).optional(),
  message: z.string().trim().max(1000).optional(),
  ownerUserId: uuid.optional(),
  nextFollowUpAt: z.string().datetime().optional(),
}).refine((v) => Boolean(v.phone || v.email), {
  message: 'Add a phone number or an email address',
  path: ['phone'],
});
export type LeadInput = z.infer<typeof leadInput>;

export const leadStatusInput = z.object({
  leadId: uuid,
  status: z.enum(LEAD_STATUSES),
  lostReason: z.string().trim().max(200).optional(),
  nextFollowUpAt: z.string().datetime().optional(),
});

/**
 * Front-desk enrolment. One transaction creates the user, member profile,
 * consent evidence, waiver, emergency contact, membership and first invoice.
 */
export const enrolMemberInput = z.object({
  branchId: uuid,
  fullName: personName,
  email: emailAddress.optional(),
  phone: phoneNumber,
  dateOfBirth: isoDate.optional(),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']).default('undisclosed'),
  locale: localeCode.default('en'),
  leadId: uuid.optional(),

  primaryGoal: z.enum(TRAINING_GOALS),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  assignedCoachId: uuid.optional(),

  membershipPlanId: uuid,
  membershipStartsOn: isoDate,
  promotionCode: z.string().trim().max(40).optional(),
  chargeJoiningFee: z.boolean().default(true),

  emergencyContact: z.object({
    fullName: personName,
    relationship: z.string().trim().min(2).max(40),
    phone: phoneNumber,
  }),

  consents: z
    .object({
      terms: z.literal(true, { errorMap: () => ({ message: 'Terms acceptance is required' }) }),
      privacy: z.literal(true, { errorMap: () => ({ message: 'Privacy notice acceptance is required' }) }),
      healthData: z.boolean().default(false),
      progressPhotos: z.boolean().default(false),
      aiCoaching: z.boolean().default(true),
      marketingEmail: z.boolean().default(false),
      marketingSms: z.boolean().default(false),
      marketingWhatsapp: z.boolean().default(false),
    }),

  waiverSigned: z.literal(true, {
    errorMap: () => ({ message: 'The liability waiver must be signed before training' }),
  }),
  waiverSignatureName: personName,

  sendAppInvite: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional(),
});
export type EnrolMemberInput = z.infer<typeof enrolMemberInput>;

export const memberUpdateInput = z.object({
  userId: uuid,
  fullName: personName.optional(),
  email: emailAddress.nullish(),
  phone: phoneNumber.optional(),
  locale: localeCode.optional(),
  branchId: uuid.optional(),
  assignedCoachId: uuid.nullish(),
  assignedNutritionistId: uuid.nullish(),
  primaryGoal: z.enum(TRAINING_GOALS).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  preferredSessionMinutes: z.number().int().min(15).max(180).optional(),
  ramadanMode: z.boolean().optional(),
});

export const consentInput = z.object({
  userId: uuid,
  kind: z.enum(CONSENT_KINDS),
  granted: z.boolean(),
  version: z.string().trim().min(1).max(20).default('2026.1'),
  channel: z.enum(['app', 'web', 'front_desk', 'paper', 'import']).default('front_desk'),
});

// ---------------------------------------------------------------------------
// Member onboarding (the member app's multi-step flow)
// ---------------------------------------------------------------------------

export const onboardingGoalStep = z.object({
  primaryGoal: z.enum(TRAINING_GOALS),
  secondaryGoal: z.enum(TRAINING_GOALS).optional(),
  targetWeightKg: weightKg.optional(),
  motivation: z.string().trim().max(280).optional(),
});

export const onboardingExperienceStep = z.object({
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  trainingDaysPerWeek: z.number().int().min(1).max(7),
  preferredSessionMinutes: z.union([
    z.literal(20),
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(75),
    z.literal(90),
  ]),
  preferredDays: z.array(
    z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  ).min(1, 'Pick at least one day'),
  preferredTrainingTime: z
    .enum(['early_morning', 'morning', 'afternoon', 'evening', 'late_night', 'flexible'])
    .default('flexible'),
  trainsAtHomeToo: z.boolean().default(false),
});

export const onboardingBodyStep = z.object({
  heightCm: heightCm,
  weightKg: weightKg,
  dateOfBirth: isoDate.optional(),
  measurements: z
    .object({
      waist: z.number().min(40).max(250).optional(),
      hips: z.number().min(50).max(250).optional(),
      chest: z.number().min(50).max(250).optional(),
      arm: z.number().min(15).max(80).optional(),
      thigh: z.number().min(25).max(120).optional(),
    })
    .partial()
    .default({}),
  sharePhotos: z.boolean().default(false),
});

export const onboardingLifestyleStep = z.object({
  sleepHours: z.number().min(3).max(14).default(7),
  stepsTarget: z.number().int().min(2000).max(25000).default(8000),
  waterTargetMl: z.number().int().min(1000).max(6000).default(2500),
  jobActivity: z.enum(['desk', 'mixed', 'on_feet', 'physical']).default('mixed'),
  smokes: z.boolean().default(false),
});

export const onboardingNutritionStep = z.object({
  approach: z.enum(['plate', 'macros', 'calories_only']).default('plate'),
  dietaryPreferences: z
    .array(z.enum(['vegetarian', 'no_beef', 'no_seafood', 'dairy_free', 'gluten_free', 'low_sugar']))
    .default([]),
  halalOnly: z.boolean().default(true),
  allergies: z.array(z.string().trim().max(40)).max(20).default([]),
  budgetBand: z.enum(['low', 'medium', 'high']).default('medium'),
  cooksAtHome: z.boolean().default(true),
  ramadanSchedule: z.boolean().default(false),
});

/**
 * Health screening. Any true answer in `redFlags` routes the member to human
 * review — the coaching engine will not auto-progress them.
 */
export const onboardingHealthStep = z.object({
  redFlags: z.object({
    chestPain: z.boolean().default(false),
    fainting: z.boolean().default(false),
    severeDizziness: z.boolean().default(false),
    breathingDifficulty: z.boolean().default(false),
    currentSharpPain: z.boolean().default(false),
    recentSurgery: z.boolean().default(false),
    pregnancyOrPostpartum: z.boolean().default(false),
    doctorAdvisedAgainstExercise: z.boolean().default(false),
    disorderedEatingConcern: z.boolean().default(false),
  }),
  conditions: z
    .array(
      z.enum([
        'high_blood_pressure',
        'diabetes',
        'asthma',
        'heart_condition',
        'thyroid',
        'pcos',
        'joint_problem',
        'back_problem',
        'other',
      ]),
    )
    .default([]),
  painAreas: z
    .array(z.enum(['neck', 'shoulder', 'elbow', 'wrist', 'lower_back', 'hip', 'knee', 'ankle']))
    .default([]),
  medications: z.boolean().default(false),
  detail: z.string().trim().max(1000).optional(),
  emergencyContact: z.object({
    fullName: personName,
    relationship: z.string().trim().min(2).max(40),
    phone: phoneNumber,
  }),
  consentHealthData: z.literal(true, {
    errorMap: () => ({ message: 'We need your consent to store health answers' }),
  }),
});

export const onboardingSubmission = z.object({
  goal: onboardingGoalStep,
  experience: onboardingExperienceStep,
  body: onboardingBodyStep,
  lifestyle: onboardingLifestyleStep,
  nutrition: onboardingNutritionStep,
  health: onboardingHealthStep,
});
export type OnboardingSubmission = z.infer<typeof onboardingSubmission>;

export const memberReportedRiskInput = z.object({
  kind: z.enum(RISK_KINDS),
  detail: z.string().trim().max(1000).optional(),
  affectedMovements: z.array(z.string().trim().max(40)).max(10).default([]),
  duringExerciseId: uuid.optional(),
  workoutSessionId: uuid.optional(),
});
export type MemberReportedRiskInput = z.infer<typeof memberReportedRiskInput>;
