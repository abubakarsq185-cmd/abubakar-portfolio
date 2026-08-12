/**
 * TypeScript mirrors of the PostgreSQL enum types declared in
 * db/migrations/0001_foundation.sql.
 *
 * `tests/integration/enum-parity.test.ts` reads pg_enum and fails if the
 * database and these arrays ever drift apart.
 */

export const ROLE_CODES = [
  'platform_super_admin',
  'gym_owner',
  'branch_manager',
  'coach',
  'front_desk',
  'nutrition_professional',
  'member',
  'guardian',
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const STAFF_ROLE_CODES = [
  'gym_owner',
  'branch_manager',
  'coach',
  'front_desk',
  'nutrition_professional',
] as const;
export type StaffRoleCode = (typeof STAFF_ROLE_CODES)[number];

export const USER_STATUSES = ['invited', 'active', 'suspended', 'archived'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LOCALE_CODES = ['en', 'ur', 'ur_rm'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const LIFECYCLE_STAGES = [
  'lead',
  'trial',
  'active',
  'frozen',
  'expired',
  'cancelled',
  'churned',
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'trial_booked',
  'trial_attended',
  'converted',
  'lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const TRAINING_GOALS = [
  'fat_loss',
  'weight_gain',
  'muscle_gain',
  'bulking',
  'recomposition',
  'strength',
  'general_fitness',
  'endurance',
  'beginner_confidence',
  'maintenance',
] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export const EXPERIENCE_LEVELS = ['first_time', 'beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const PROGRAM_INTENTS = [
  'beginner_induction',
  'fat_loss',
  'hypertrophy',
  'weight_gain',
  'strength',
  'general_fitness',
  'home',
  'hybrid',
  'low_impact',
  'ramadan',
  'class_support',
] as const;
export type ProgramIntent = (typeof PROGRAM_INTENTS)[number];

export const PROGRAM_SCOPES = ['platform', 'organization', 'branch', 'member'] as const;
export type ProgramScope = (typeof PROGRAM_SCOPES)[number];

export const PUBLISH_STATES = ['draft', 'in_review', 'published', 'archived'] as const;
export type PublishState = (typeof PUBLISH_STATES)[number];

export const SESSION_STATES = [
  'scheduled',
  'in_progress',
  'completed',
  'skipped',
  'expired',
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const EFFORT_SCALES = ['rpe', 'rir', 'simple'] as const;
export type EffortScale = (typeof EFFORT_SCALES)[number];

export const BILLING_INTERVALS = [
  'one_time',
  'weekly',
  'monthly',
  'quarterly',
  'biannual',
  'annual',
] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const MEMBERSHIP_STATES = [
  'pending',
  'active',
  'frozen',
  'past_due',
  'cancelled',
  'expired',
  'trial',
] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

export const INVOICE_STATES = [
  'draft',
  'open',
  'paid',
  'partially_paid',
  'void',
  'uncollectible',
  'refunded',
] as const;
export type InvoiceState = (typeof INVOICE_STATES)[number];

export const PAYMENT_STATES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
  'cancelled',
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_METHOD_KINDS = [
  'cash',
  'bank_transfer',
  'card',
  'wallet',
  'qr',
  'cheque',
  'credit_note',
  'other',
] as const;
export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

export const LEDGER_DIRECTIONS = ['debit', 'credit'] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export const LEDGER_ACCOUNTS = [
  'accounts_receivable',
  'cash',
  'bank',
  'card_clearing',
  'wallet_clearing',
  'membership_revenue',
  'joining_fee_revenue',
  'class_revenue',
  'pt_revenue',
  'product_revenue',
  'discounts',
  'refunds',
  'tax_payable',
  'deferred_revenue',
  'processor_fees',
  'write_off',
] as const;
export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

export const RISK_SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const RISK_KINDS = [
  'chest_pain',
  'fainting',
  'severe_dizziness',
  'breathing_difficulty',
  'sharp_or_worsening_pain',
  'new_injury',
  'surgery_recovery',
  'pregnancy_postpartum',
  'medical_condition_clearance',
  'eating_disorder_concern',
  'blood_pressure',
  'diabetes',
  'joint_limitation',
  'other',
] as const;
export type RiskKind = (typeof RISK_KINDS)[number];

export const CASE_STATES = [
  'open',
  'acknowledged',
  'in_progress',
  'waiting_member',
  'resolved',
  'closed',
] as const;
export type CaseState = (typeof CASE_STATES)[number];

export const CASE_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'email', 'sms', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATES = [
  'queued',
  'suppressed',
  'sent',
  'delivered',
  'failed',
  'read',
] as const;
export type NotificationState = (typeof NOTIFICATION_STATES)[number];

export const CONSENT_KINDS = [
  'terms',
  'privacy',
  'health_data',
  'progress_photos',
  'marketing_email',
  'marketing_sms',
  'marketing_whatsapp',
  'ai_coaching',
  'guardian_billing_access',
] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const BOOKING_STATES = [
  'booked',
  'waitlisted',
  'attended',
  'late_cancelled',
  'cancelled',
  'no_show',
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];

export const ATTENDANCE_METHODS = [
  'qr',
  'barcode',
  'manual',
  'kiosk',
  'door_access',
  'app',
] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'read_sensitive',
  'login',
  'login_failed',
  'logout',
  'role_change',
  'permission_grant',
  'impersonate_start',
  'impersonate_end',
  'payment_record',
  'refund',
  'consent_capture',
  'consent_withdraw',
  'program_assign',
  'program_override',
  'escalation',
  'export',
  'erasure_request',
  'ai_output',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AI_SAFETY_RESULTS = [
  'allowed',
  'redirected_to_staff',
  'blocked_unsafe',
  'blocked_out_of_scope',
] as const;
export type AiSafetyResult = (typeof AI_SAFETY_RESULTS)[number];

export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'lunge',
  'carry',
  'rotation',
  'anti_extension',
  'anti_rotation',
  'hip_isolation',
  'knee_isolation',
  'elbow_flexion',
  'elbow_extension',
  'calf',
  'shoulder_isolation',
  'cardio',
  'mobility',
  'stretch',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const MEAL_SLOTS = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
  'sehri',
  'iftar',
] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const NUTRITION_APPROACHES = ['plate', 'macros', 'calories_only'] as const;
export type NutritionApproach = (typeof NUTRITION_APPROACHES)[number];

/** Human labels. Kept here so staff UI, member UI and mobile agree. */
export const GOAL_LABELS: Record<TrainingGoal, string> = {
  fat_loss: 'Fat loss',
  weight_gain: 'Healthy weight gain',
  muscle_gain: 'Muscle gain',
  bulking: 'Bulking',
  recomposition: 'Body recomposition',
  strength: 'Strength',
  general_fitness: 'General fitness',
  endurance: 'Endurance',
  beginner_confidence: 'Beginner confidence',
  maintenance: 'Maintenance',
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  first_time: 'First time in a gym',
  beginner: 'Beginner (under 6 months)',
  intermediate: 'Intermediate (6 months – 2 years)',
  advanced: 'Advanced (2+ years)',
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  platform_super_admin: 'Platform Super Admin',
  gym_owner: 'Gym Owner',
  branch_manager: 'Branch Manager',
  coach: 'Coach',
  front_desk: 'Front Desk',
  nutrition_professional: 'Nutrition Professional',
  member: 'Member',
  guardian: 'Guardian / Family Payer',
};

export const RISK_KIND_LABELS: Record<RiskKind, string> = {
  chest_pain: 'Chest pain',
  fainting: 'Fainting or blackout',
  severe_dizziness: 'Severe dizziness',
  breathing_difficulty: 'Difficulty breathing',
  sharp_or_worsening_pain: 'Sharp or worsening pain',
  new_injury: 'New injury',
  surgery_recovery: 'Recovering from surgery',
  pregnancy_postpartum: 'Pregnancy or postpartum',
  medical_condition_clearance: 'Medical condition needing clearance',
  eating_disorder_concern: 'Disordered eating concern',
  blood_pressure: 'Blood pressure',
  diabetes: 'Diabetes',
  joint_limitation: 'Joint limitation',
  other: 'Other',
};
