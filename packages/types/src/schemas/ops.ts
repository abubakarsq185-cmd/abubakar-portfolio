import { z } from 'zod';
import { isoDate, personName, uuid } from './common';
import {
  ATTENDANCE_METHODS,
  CASE_PRIORITIES,
  MEAL_SLOTS,
  NOTIFICATION_CHANNELS,
  NUTRITION_APPROACHES,
  ROLE_CODES,
  TRAINING_GOALS,
} from '../enums';

// --- Scheduling -------------------------------------------------------------

export const classInput = z.object({
  branchId: uuid,
  roomId: uuid.nullish(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  category: z
    .enum(['group', 'hiit', 'strength', 'yoga', 'pilates', 'spin', 'boxing', 'zumba', 'functional', 'womens_only', 'induction', 'pt'])
    .default('group'),
  intensity: z.enum(['gentle', 'moderate', 'high']).default('moderate'),
  defaultCoachId: uuid.nullish(),
  capacity: z.number().int().min(1).max(200),
  durationMinutes: z.number().int().min(15).max(180),
  creditsRequired: z.number().int().min(0).max(10).default(1),
  womenOnly: z.boolean().default(false),
  bookingOpensHoursBefore: z.number().int().min(1).max(720).default(48),
  bookingClosesMinutesBefore: z.number().int().min(0).max(1440).default(30),
  cancellationWindowHours: z.number().int().min(0).max(168).default(4),
  waitlistEnabled: z.boolean().default(true),
  waitlistCapacity: z.number().int().min(0).max(100).default(10),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).default([]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  weeksToSchedule: z.number().int().min(1).max(26).default(4),
});
export type ClassInput = z.infer<typeof classInput>;

export const bookingInput = z.object({
  classSessionId: uuid,
  userId: uuid.optional(),
});

export const cancelBookingInput = z.object({
  bookingId: uuid,
  reason: z.string().trim().max(300).optional(),
});

export const checkInMemberInput = z.object({
  branchId: uuid,
  method: z.enum(ATTENDANCE_METHODS).default('manual'),
  userId: uuid.optional(),
  credentialToken: z.string().trim().max(200).optional(),
  memberNumber: z.string().trim().max(40).optional(),
  classSessionId: uuid.nullish(),
  overrideReason: z.string().trim().max(300).optional(),
}).refine((v) => Boolean(v.userId || v.credentialToken || v.memberNumber), {
  message: 'Identify the member by scan, member number or selection',
  path: ['userId'],
});
export type CheckInMemberInput = z.infer<typeof checkInMemberInput>;

export const equipmentInventoryInput = z.object({
  branchId: uuid,
  equipmentId: uuid,
  quantity: z.number().int().min(0).max(500),
  condition: z.enum(['new', 'good', 'fair', 'maintenance', 'out_of_service']).default('good'),
  serialNumber: z.string().trim().max(80).optional(),
  nextServiceOn: isoDate.optional(),
  isAvailable: z.boolean().default(true),
});

// --- Support & messaging ----------------------------------------------------

export const supportCaseInput = z.object({
  memberUserId: uuid.nullish(),
  category: z
    .enum(['general', 'billing', 'technical', 'coaching', 'nutrition', 'health_escalation', 'complaint', 'membership'])
    .default('general'),
  priority: z.enum(CASE_PRIORITIES).default('normal'),
  subject: z.string().trim().min(4).max(160),
  detail: z.string().trim().min(4).max(4000),
  assignedRole: z.enum(ROLE_CODES).optional(),
  assignedToUserId: uuid.nullish(),
});
export type SupportCaseInput = z.infer<typeof supportCaseInput>;

export const supportCaseUpdateInput = z.object({
  caseId: uuid,
  state: z.enum(['open', 'acknowledged', 'in_progress', 'waiting_member', 'resolved', 'closed']).optional(),
  priority: z.enum(CASE_PRIORITIES).optional(),
  assignedToUserId: uuid.nullish(),
  resolutionNote: z.string().trim().max(2000).optional(),
}).refine((v) => v.state !== 'resolved' || Boolean(v.resolutionNote), {
  message: 'Add a resolution note before resolving',
  path: ['resolutionNote'],
});

export const messageInput = z.object({
  conversationId: uuid.nullish(),
  memberUserId: uuid.nullish(),
  body: z.string().trim().min(1, 'Write a message').max(4000),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).default(['in_app']),
});
export type MessageInput = z.infer<typeof messageInput>;

export const announcementInput = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(4000),
  branchIds: z.array(uuid).default([]),
  audience: z.enum(['all_members', 'active_members', 'inactive_members', 'trial_members']).default('active_members'),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).default(['in_app']),
  isMarketing: z.boolean().default(false),
});

export const notificationPreferenceInput = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  operationalEnabled: z.boolean(),
  coachingEnabled: z.boolean(),
  billingEnabled: z.boolean(),
  marketingEnabled: z.boolean(),
  maxPerWeek: z.number().int().min(0).max(50).default(7),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
});

export const automationInput = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  triggerKind: z.enum([
    'member_enrolled',
    'onboarding_incomplete',
    'trial_ending',
    'workout_missed',
    'inactive_7_days',
    'inactive_14_days',
    'payment_due',
    'payment_failed',
    'membership_expiring',
    'birthday',
    'workout_milestone',
    'checkin_missing',
    'class_waitlist_promoted',
    'escalation_raised',
    'manual',
  ]),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1),
  templateKey: z.string().trim().min(2).max(60),
  audience: z.enum(['member', 'staff', 'both']).default('member'),
  requiresOptIn: z.boolean().default(true),
  respectQuietHours: z.boolean().default(true),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('21:30'),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('07:30'),
  maxPerMemberPerWeek: z.number().int().min(1).max(20).default(3),
  cooldownHours: z.number().int().min(1).max(720).default(24),
  createsStaffTask: z.boolean().default(false),
  taskAssigneeRole: z.enum(ROLE_CODES).optional(),
  isActive: z.boolean().default(true),
});
export type AutomationInput = z.infer<typeof automationInput>;

// --- Nutrition --------------------------------------------------------------

export const nutritionTargetInput = z.object({
  userId: uuid,
  approach: z.enum(NUTRITION_APPROACHES),
  goal: z.enum(TRAINING_GOALS),
  caloriesKcal: z.number().int().min(1200, 'Below 1200 kcal is not permitted').max(5000).nullish(),
  proteinG: z.number().int().min(20).max(400).nullish(),
  carbsG: z.number().int().min(30).max(700).nullish(),
  fatG: z.number().int().min(20).max(250).nullish(),
  waterMl: z.number().int().min(1000).max(6000).default(2500),
  weeklyChangeKg: z.number().min(-1).max(1).nullish(),
  dietaryPreferences: z.array(z.string().trim().max(40)).default([]),
  allergies: z.array(z.string().trim().max(40)).default([]),
  halalOnly: z.boolean().default(true),
  budgetBand: z.enum(['low', 'medium', 'high']).default('medium'),
  ramadanSchedule: z.boolean().default(false),
  guardRailNotes: z.string().trim().max(500).optional(),
});
export type NutritionTargetInput = z.infer<typeof nutritionTargetInput>;

export const mealLogInput = z.object({
  loggedOn: isoDate,
  mealSlot: z.enum(MEAL_SLOTS),
  recipeId: uuid.nullish(),
  foodItemId: uuid.nullish(),
  freeText: z.string().trim().max(200).optional(),
  quantityServings: z.number().min(0.1).max(20).default(1),
  plateRating: z.number().int().min(1).max(5).nullish(),
}).refine((v) => Boolean(v.recipeId || v.foodItemId || v.freeText), {
  message: 'Pick a food, a recipe, or describe what you ate',
  path: ['freeText'],
});
export type MealLogInput = z.infer<typeof mealLogInput>;

export const recipeInput = z.object({
  name: z.string().trim().min(2).max(120),
  nameUr: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  servings: z.number().min(0.5).max(20).default(1),
  prepMinutes: z.number().int().min(0).max(240).default(10),
  cookMinutes: z.number().int().min(0).max(480).default(15),
  mealSlot: z.enum(MEAL_SLOTS).optional(),
  methodSteps: z.array(z.string().trim().max(400)).min(1, 'Add at least one step'),
  isVegetarian: z.boolean().default(false),
  costBand: z.enum(['low', 'medium', 'high']).default('medium'),
  items: z
    .array(
      z.object({
        foodItemId: uuid,
        quantityServings: z.number().min(0.1).max(50),
        note: z.string().trim().max(120).optional(),
      }),
    )
    .min(1, 'Add at least one ingredient'),
});

// --- Platform console -------------------------------------------------------

export const organizationInput = z.object({
  slug: z.string().trim().min(3).max(40).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens'),
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(120),
  countryCode: z.string().length(2).toUpperCase().default('PK'),
  defaultCurrency: z.string().length(3).toUpperCase().default('PKR'),
  defaultTimezone: z.string().trim().min(3).max(60).default('Asia/Karachi'),
  taxRateBps: z.number().int().min(0).max(10000).default(0),
  supportEmail: z.string().email().optional(),
  ownerName: personName,
  ownerEmail: z.string().email(),
  subscriptionPlanCode: z.string().trim().min(2).max(40),
  billingInterval: z.enum(['monthly', 'annual']).default('monthly'),
});
export type OrganizationInput = z.infer<typeof organizationInput>;

export const featureFlagOverrideInput = z.object({
  organizationId: uuid,
  featureFlagKey: z.string().trim().min(2).max(60),
  enabled: z.boolean(),
  note: z.string().trim().max(300).optional(),
});

export const dataRequestInput = z.object({
  kind: z.enum(['export', 'erasure', 'rectification']),
  detail: z.string().trim().max(1000).optional(),
});
