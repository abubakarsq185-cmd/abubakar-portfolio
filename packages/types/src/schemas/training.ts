import { z } from 'zod';
import { isoDate, uuid } from './common';
import {
  EXPERIENCE_LEVELS,
  MOVEMENT_PATTERNS,
  PROGRAM_INTENTS,
  TRAINING_GOALS,
} from '../enums';

export const exerciseInput = z.object({
  code: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
  name: z.string().trim().min(2).max(120),
  nameUr: z.string().trim().max(120).optional(),
  nameUrRm: z.string().trim().max(120).optional(),
  movementPattern: z.enum(MOVEMENT_PATTERNS),
  primaryMuscles: z.array(z.string().trim().max(40)).min(1, 'List at least one target muscle'),
  secondaryMuscles: z.array(z.string().trim().max(40)).default([]),
  requiredEquipmentCodes: z.array(z.string().trim().max(40)).default([]),
  difficulty: z.enum(EXPERIENCE_LEVELS).default('beginner'),
  isUnilateral: z.boolean().default(false),
  isCompound: z.boolean().default(false),
  isLowImpact: z.boolean().default(false),
  setupInstructions: z.string().trim().min(10, 'Describe the setup so a first-timer can follow it').max(2000),
  executionSteps: z.array(z.string().trim().max(300)).min(1, 'Add at least one step'),
  formCues: z.array(z.string().trim().max(200)).default([]),
  commonMistakes: z.array(z.string().trim().max(200)).default([]),
  safetyNotes: z.array(z.string().trim().max(200)).default([]),
  breathingCue: z.string().trim().max(200).optional(),
  tempoDefault: z.string().trim().max(20).optional(),
  contraindications: z.array(z.string().trim().max(80)).default([]),
  defaultRestSeconds: z.number().int().min(15).max(600).default(90),
  loadStepKg: z.number().min(0.5).max(20).default(2.5),
});
export type ExerciseInput = z.infer<typeof exerciseInput>;

export const workoutItemInput = z.object({
  exerciseId: uuid,
  position: z.number().int().min(1),
  targetSets: z.number().int().min(1).max(12),
  targetRepsMin: z.number().int().min(1).max(100).optional(),
  targetRepsMax: z.number().int().min(1).max(100).optional(),
  targetSeconds: z.number().int().min(5).max(3600).optional(),
  targetRpe: z.number().min(1).max(10).optional(),
  tempo: z.string().trim().max(20).optional(),
  restSeconds: z.number().int().min(0).max(600).default(90),
  loadGuidance: z.string().trim().max(200).optional(),
  startingLoadKg: z.number().min(0).max(500).optional(),
  allowSubstitution: z.boolean().default(true),
  memberNote: z.string().trim().max(300).optional(),
  coachNote: z.string().trim().max(300).optional(),
}).refine(
  (v) => !v.targetRepsMin || !v.targetRepsMax || v.targetRepsMax >= v.targetRepsMin,
  { message: 'Max reps must be at least min reps', path: ['targetRepsMax'] },
);

export const workoutBlockInput = z.object({
  kind: z.enum(['warmup', 'main', 'superset', 'circuit', 'finisher', 'cooldown']),
  label: z.string().trim().min(2).max(80),
  position: z.number().int().min(1),
  rounds: z.number().int().min(1).max(10).default(1),
  restBetweenRoundsSeconds: z.number().int().min(0).max(600).default(60),
  instructions: z.string().trim().max(500).optional(),
  items: z.array(workoutItemInput).min(1, 'A block needs at least one exercise'),
});

export const workoutInput = z.object({
  name: z.string().trim().min(3).max(120),
  focus: z.string().trim().min(2).max(60).default('full_body'),
  intent: z.enum(PROGRAM_INTENTS).default('general_fitness'),
  estimatedMinutes: z.number().int().min(10).max(180).default(45),
  difficulty: z.enum(EXPERIENCE_LEVELS).default('beginner'),
  effortScale: z.enum(['rpe', 'rir', 'simple']).default('simple'),
  memberIntro: z.string().trim().max(500).optional(),
  coachNotes: z.string().trim().max(1000).optional(),
  blocks: z.array(workoutBlockInput).min(1, 'Add at least one block'),
});
export type WorkoutInput = z.infer<typeof workoutInput>;

export const programAssignmentInput = z.object({
  userId: uuid,
  programId: uuid,
  startsOn: isoDate,
  source: z.enum(['engine', 'coach', 'front_desk', 'member_choice']).default('coach'),
  note: z.string().trim().max(500).optional(),
  personalisation: z
    .object({
      sessionMinutes: z.number().int().min(20).max(120).optional(),
      daysPerWeek: z.number().int().min(1).max(7).optional(),
      excludedExerciseIds: z.array(uuid).default([]),
      lowImpactOnly: z.boolean().default(false),
    })
    .default({ excludedExerciseIds: [], lowImpactOnly: false }),
});
export type ProgramAssignmentInput = z.infer<typeof programAssignmentInput>;

export const bulkAssignInput = z.object({
  programId: uuid,
  userIds: z.array(uuid).min(1, 'Select at least one member').max(200, 'Assign at most 200 members at once'),
  startsOn: isoDate,
  replaceExisting: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Workout player
// ---------------------------------------------------------------------------

export const setLogInput = z.object({
  clientSetId: z.string().trim().min(6).max(80),
  workoutItemId: uuid.nullable(),
  exerciseId: uuid,
  substitutedForExerciseId: uuid.nullish(),
  setNumber: z.number().int().min(1).max(30),
  // The prescribed range is echoed back so the log records what was asked for,
  // even if the program is later edited.
  targetRepsMin: z.number().int().min(1).max(100).nullish(),
  targetRepsMax: z.number().int().min(1).max(100).nullish(),
  repsCompleted: z.number().int().min(0).max(500).nullish(),
  weightKg: z.number().min(0).max(600).nullish(),
  secondsHeld: z.number().int().min(0).max(7200).nullish(),
  distanceM: z.number().int().min(0).max(100000).nullish(),
  rpe: z.number().min(1).max(10).nullish(),
  restTakenSeconds: z.number().int().min(0).max(3600).nullish(),
  isWarmup: z.boolean().default(false),
  skipped: z.boolean().default(false),
  skipReason: z.string().trim().max(200).optional(),
  discomfortLevel: z.number().int().min(0).max(10).nullish(),
  discomfortArea: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
  loggedAt: z.string().datetime(),
});
export type SetLogInput = z.infer<typeof setLogInput>;

/**
 * The offline-capable sync payload. The client keeps a queue of these and
 * replays them; `clientSessionId` makes replays idempotent.
 */
export const workoutSessionSyncInput = z.object({
  clientSessionId: z.string().trim().min(6).max(80),
  programAssignmentId: uuid.nullish(),
  programDayId: uuid.nullish(),
  workoutId: uuid.nullish(),
  title: z.string().trim().min(2).max(160),
  scheduledFor: isoDate,
  startedAt: z.string().datetime().nullish(),
  completedAt: z.string().datetime().nullish(),
  state: z.enum(['in_progress', 'completed', 'skipped']),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 8).nullish(),
  sessionRpe: z.number().min(1).max(10).nullish(),
  mood: z.enum(['great', 'good', 'ok', 'tired', 'sore', 'unwell']).nullish(),
  sleepHours: z.number().min(0).max(16).nullish(),
  energyLevel: z.number().int().min(1).max(5).nullish(),
  memberNote: z.string().trim().max(1000).optional(),
  sets: z.array(setLogInput).max(300),
  reportedRisk: z
    .object({
      kind: z.string().trim().max(60),
      detail: z.string().trim().max(1000).optional(),
      exerciseId: uuid.optional(),
    })
    .nullish(),
  clientRecordedAt: z.string().datetime(),
});
export type WorkoutSessionSyncInput = z.infer<typeof workoutSessionSyncInput>;

export const substitutionRequestInput = z.object({
  workoutSessionId: uuid,
  workoutItemId: uuid,
  reason: z.enum(['equipment', 'difficulty_down', 'difficulty_up', 'low_impact', 'space', 'injury_friendly', 'preference']),
});

export const checkInInput = z.object({
  weekStarting: isoDate,
  weightKg: z.number().min(25).max(400).optional(),
  sleepQuality: z.number().int().min(1).max(5),
  stressLevel: z.number().int().min(1).max(5),
  sorenessLevel: z.number().int().min(1).max(5),
  energyLevel: z.number().int().min(1).max(5),
  nutritionAdherence: z.number().int().min(1).max(5),
  wins: z.string().trim().max(1000).optional(),
  blockers: z.string().trim().max(1000).optional(),
  memberQuestion: z.string().trim().max(1000).optional(),
});
export type CheckInInput = z.infer<typeof checkInInput>;

export const metricLogInput = z.object({
  metricKey: z.string().trim().min(2).max(40),
  value: z.number(),
  measuredOn: isoDate,
  note: z.string().trim().max(200).optional(),
});

export const goalInput = z.object({
  kind: z.enum(TRAINING_GOALS),
  headline: z.string().trim().min(4).max(160),
  metricKey: z.string().trim().max(40).optional(),
  startValue: z.number().optional(),
  targetValue: z.number().optional(),
  unit: z.string().trim().max(12).optional(),
  targetDate: isoDate.optional(),
});

export const habitLogInput = z.object({
  habitKey: z.string().trim().min(2).max(40),
  loggedOn: isoDate,
  value: z.number().min(0).max(100000),
  completed: z.boolean().default(true),
});

export const coachingDecisionInput = z.object({
  recommendationId: uuid,
  decision: z.enum(['approve', 'reject', 'override']),
  note: z.string().trim().max(500).optional(),
  overrideValue: z.record(z.unknown()).optional(),
}).refine((v) => v.decision !== 'override' || Boolean(v.note), {
  message: 'An override needs a reason for the audit trail',
  path: ['note'],
});
