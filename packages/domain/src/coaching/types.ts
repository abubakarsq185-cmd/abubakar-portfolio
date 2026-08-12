import type { ExperienceLevel, MovementPattern, TrainingGoal } from '@gymguide/types';

/** One logged set as the engine sees it. */
export interface SetRecord {
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  isWarmup: boolean;
  skipped: boolean;
  discomfortLevel: number | null;
}

/** One session's worth of work on a single exercise, newest first. */
export interface ExerciseSessionRecord {
  sessionId: string;
  performedOn: string;
  prescribedSets: number;
  targetRpe: number | null;
  sets: SetRecord[];
}

export interface ExerciseHistory {
  exerciseId: string;
  exerciseName: string;
  movementPattern: MovementPattern;
  loadStepKg: number;
  /** Newest session first. */
  sessions: ExerciseSessionRecord[];
}

export interface SessionSummaryRecord {
  sessionId: string;
  scheduledFor: string;
  state: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'expired';
  sessionRpe: number | null;
  discomfortReported: boolean;
}

export interface CheckInRecord {
  weekStarting: string;
  sleepQuality: number | null;
  stressLevel: number | null;
  sorenessLevel: number | null;
  energyLevel: number | null;
  nutritionAdherence: number | null;
}

export interface CoachingContext {
  userId: string;
  programAssignmentId: string | null;
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  /** Set by the safety engine. Non-null means: never auto-progress. */
  progressionHoldReason: string | null;
  /** Movement patterns the member must not be progressed on. */
  restrictedMovements: MovementPattern[];
  trainingDaysPerWeek: number;
  today: string;
  histories: ExerciseHistory[];
  recentSessions: SessionSummaryRecord[];
  recentCheckIns: CheckInRecord[];
  /** Equipment codes actually available at the member's branch right now. */
  availableEquipmentCodes: string[];
}

export type RecommendationKind =
  | 'progress_load'
  | 'progress_reps'
  | 'hold'
  | 'reduce_volume'
  | 'deload'
  | 'substitute_exercise'
  | 'reschedule_week'
  | 'shorten_week'
  | 'stop_progression'
  | 'staff_review';

export interface CoachingRecommendation {
  ruleId: string;
  ruleVersion: string;
  kind: RecommendationKind;
  exerciseId: string | null;
  /** Shown to the member. Plain, supportive, never diagnostic. */
  memberMessage: string;
  /** Shown to staff and stored on the audit record. */
  rationale: string;
  evidence: Record<string, unknown>;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  requiresStaffApproval: boolean;
  /** Recommendations with a higher number win when two rules collide. */
  precedence: number;
}

export const RULE_VERSION = '1.0.0';
