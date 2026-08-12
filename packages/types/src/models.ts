/**
 * Read models shared by the web app, the mobile app and the tests.
 * These describe API responses, not raw table rows.
 */
import type {
  AiSafetyResult,
  BookingState,
  CasePriority,
  CaseState,
  ExperienceLevel,
  InvoiceState,
  LifecycleStage,
  LocaleCode,
  MealSlot,
  MembershipState,
  MovementPattern,
  NotificationChannel,
  PaymentMethodKind,
  PaymentState,
  ProgramIntent,
  RiskKind,
  RiskSeverity,
  RoleCode,
  SessionState,
  TrainingGoal,
} from './enums';

export interface OrganizationSummary {
  id: string;
  slug: string;
  displayName: string;
  defaultCurrency: string;
  defaultLocale: LocaleCode;
  defaultTimezone: string;
  whiteLabel: boolean;
  taxRateBps: number;
}

export interface BranchSummary {
  id: string;
  name: string;
  code: string;
  city: string | null;
  timezone: string;
  isActive: boolean;
}

export interface MemberListRow {
  memberProfileId: string;
  userId: string;
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  branchId: string;
  branchName: string;
  lifecycleStage: LifecycleStage;
  primaryGoal: TrainingGoal | null;
  experienceLevel: ExperienceLevel | null;
  coachName: string | null;
  membershipState: MembershipState | null;
  planName: string | null;
  membershipPeriodEnd: string | null;
  balanceDueMinor: number;
  currency: string;
  lastVisitAt: string | null;
  lastWorkoutAt: string | null;
  inactivityRiskScore: number;
  openHighRiskCount: number;
  onboardingCompletedAt: string | null;
}

export interface ExerciseDetail {
  id: string;
  code: string;
  name: string;
  nameUr: string | null;
  nameUrRm: string | null;
  movementPattern: MovementPattern;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  requiredEquipmentCodes: string[];
  difficulty: ExperienceLevel;
  isLowImpact: boolean;
  setupInstructions: string;
  executionSteps: string[];
  formCues: string[];
  commonMistakes: string[];
  safetyNotes: string[];
  breathingCue: string | null;
  contraindications: string[];
  defaultRestSeconds: number;
  loadStepKg: number;
  primaryMediaUrl: string | null;
  mediaKind: 'video' | 'animation' | 'image' | 'audio' | null;
}

export interface PreviousPerformance {
  exerciseId: string;
  lastPerformedOn: string | null;
  bestWeightKg: number | null;
  bestReps: number | null;
  lastSets: Array<{ setNumber: number; weightKg: number | null; reps: number | null; rpe: number | null }>;
}

export interface WorkoutPlayerItem {
  workoutItemId: string;
  position: number;
  exercise: ExerciseDetail;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetSeconds: number | null;
  targetRpe: number | null;
  tempo: string | null;
  restSeconds: number;
  loadGuidance: string | null;
  suggestedLoadKg: number | null;
  allowSubstitution: boolean;
  memberNote: string | null;
  previous: PreviousPerformance | null;
  substitutions: Array<{ exerciseId: string; name: string; reason: string; requiresEquipment: string[] }>;
}

export interface WorkoutPlayerBlock {
  id: string;
  kind: 'warmup' | 'main' | 'superset' | 'circuit' | 'finisher' | 'cooldown';
  label: string;
  position: number;
  rounds: number;
  restBetweenRoundsSeconds: number;
  instructions: string | null;
  items: WorkoutPlayerItem[];
}

/** Everything the workout player needs — and everything it caches offline. */
export interface WorkoutPlayerPayload {
  sessionId: string | null;
  clientSessionId: string;
  programAssignmentId: string | null;
  programDayId: string | null;
  workoutId: string | null;
  title: string;
  intent: ProgramIntent;
  goalHeadline: string;
  estimatedMinutes: number;
  scheduledFor: string;
  weekNumber: number | null;
  dayNumber: number | null;
  memberIntro: string | null;
  effortScale: 'rpe' | 'rir' | 'simple';
  blocks: WorkoutPlayerBlock[];
  safety: {
    progressionLocked: boolean;
    lockReason: string | null;
    restrictedMovements: string[];
    banner: string | null;
  };
  generatedAt: string;
}

export interface TodayCard {
  kind:
    | 'workout'
    | 'rest'
    | 'class'
    | 'checkin'
    | 'habit'
    | 'nutrition'
    | 'payment'
    | 'onboarding'
    | 'escalation';
  title: string;
  subtitle: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  meta?: Record<string, string | number | null>;
}

export interface ProgressSnapshot {
  adherencePercent: number;
  workoutsCompleted4Weeks: number;
  workoutsPlanned4Weeks: number;
  currentStreakDays: number;
  bestStreakDays: number;
  totalVolumeKg: number;
  weightSeries: Array<{ date: string; value: number }>;
  volumeSeries: Array<{ week: string; value: number }>;
  adherenceSeries: Array<{ week: string; value: number }>;
  habitStreaks: Array<{ key: string; label: string; streak: number; target: number; unit: string }>;
  personalRecords: Array<{ exerciseName: string; kind: string; value: number; unit: string; achievedAt: string }>;
  milestones: Array<{ label: string; achievedAt: string }>;
  goal: { headline: string; startValue: number | null; currentValue: number | null; targetValue: number | null; unit: string | null } | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  state: InvoiceState;
  currency: string;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  issuedAt: string;
  dueAt: string;
  daysOverdue: number;
  lines: Array<{ description: string; totalMinor: number }>;
}

export interface PaymentSummary {
  id: string;
  reference: string;
  state: PaymentState;
  method: PaymentMethodKind;
  amountMinor: number;
  currency: string;
  receivedAt: string;
  receiptNumber: string | null;
  reconciledAt: string | null;
}

export interface BookingSummary {
  id: string;
  classSessionId: string;
  className: string;
  coachName: string | null;
  roomName: string | null;
  startsAt: string;
  endsAt: string;
  state: BookingState;
  canCancelUntil: string;
  waitlistPosition: number | null;
}

export interface NotificationSummary {
  id: string;
  channel: NotificationChannel;
  category: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaPath: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface SupportCaseSummary {
  id: string;
  reference: string;
  subject: string;
  detail: string;
  category: string;
  priority: CasePriority;
  state: CaseState;
  containsHealthData: boolean;
  memberName: string | null;
  memberUserId: string | null;
  assignedToName: string | null;
  createdAt: string;
  slaDueAt: string | null;
  raisedByAi: boolean;
}

export interface EscalationRow {
  riskFlagId: string;
  userId: string;
  memberName: string;
  kind: RiskKind;
  severity: RiskSeverity;
  source: string;
  detail: string | null;
  blocksProgression: boolean;
  raisedAt: string;
  hoursOpen: number;
  supportCaseId: string | null;
  caseReference: string | null;
  caseState: CaseState | null;
}

export interface AiCoachMessage {
  id: string;
  role: 'member' | 'coach_ai' | 'staff' | 'system';
  body: string;
  isAiAssisted: boolean;
  createdAt: string;
  safetyResult?: AiSafetyResult;
  sources?: Array<{ kind: string; label: string; id: string | null }>;
  escalatedCaseReference?: string | null;
}

export interface NutritionDay {
  date: string;
  approach: 'plate' | 'macros' | 'calories_only';
  targets: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    waterMl: number;
    proteinPalms: number | null;
    carbCuppedHands: number | null;
    vegFists: number | null;
    fatThumbs: number | null;
  };
  consumed: { caloriesKcal: number; proteinG: number; carbsG: number; fatG: number; waterMl: number };
  meals: Array<{
    id: string;
    slot: MealSlot;
    label: string;
    caloriesKcal: number | null;
    proteinG: number | null;
    plateRating: number | null;
  }>;
  guidance: string[];
}

export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
  formatted: string;
  delta: number | null;
  deltaLabel: string | null;
  tone: 'neutral' | 'positive' | 'negative' | 'warning';
  href: string | null;
}

export interface StaffQueueItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string | null;
  tone: 'neutral' | 'warning' | 'danger' | 'success';
  href: string;
  timestamp: string | null;
}

export interface SessionUser {
  userId: string;
  fullName: string;
  email: string | null;
  role: RoleCode;
  roles: RoleCode[];
  organizationId: string | null;
  organizationName: string | null;
  branchIds: string[];
  isPlatformAdmin: boolean;
  locale: LocaleCode;
  avatarUrl: string | null;
  impersonatedBy: string | null;
}
