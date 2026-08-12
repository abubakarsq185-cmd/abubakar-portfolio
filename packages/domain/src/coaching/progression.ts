/**
 * The adaptive coaching engine.
 *
 * Deterministic and rule-based on purpose. Every recommendation names the rule
 * that produced it, the evidence it used and the before/after values, so a
 * coach can audit or override it. The AI layer may *explain* these decisions;
 * it never makes them.
 *
 * Hard safety invariants (enforced here, tested in
 * tests/unit/coaching-engine.test.ts):
 *   1. A member with a progression hold is never auto-progressed.
 *   2. A restricted movement pattern is never auto-progressed.
 *   3. Reported pain outranks every progression rule.
 */
import type { MovementPattern } from '@gymguide/types';
import {
  RULE_VERSION,
  type CoachingContext,
  type CoachingRecommendation,
  type ExerciseHistory,
  type ExerciseSessionRecord,
  type SetRecord,
} from './types';

const WORKING_SET = (set: SetRecord): boolean => !set.isWarmup && !set.skipped;

/** Did the member hit the top of the prescribed range on every working set? */
export function metAllTargets(session: ExerciseSessionRecord): boolean {
  const working = session.sets.filter(WORKING_SET);
  if (working.length === 0) return false;
  if (working.length < session.prescribedSets) return false;
  return working.every((set) => {
    const target = set.targetRepsMax ?? set.targetRepsMin;
    if (target === null || set.reps === null) return false;
    return set.reps >= target;
  });
}

/** Missed the bottom of the range on any working set, or dropped sets. */
export function missedTargets(session: ExerciseSessionRecord): boolean {
  const working = session.sets.filter(WORKING_SET);
  if (working.length === 0) return true;
  if (working.length < session.prescribedSets) return true;
  return working.some((set) => {
    const floor = set.targetRepsMin;
    if (floor === null || set.reps === null) return false;
    return set.reps < floor;
  });
}

/**
 * "At the intended effort" means the member was not grinding: either no RPE was
 * recorded (simple effort scale), or the average RPE is at or below the
 * prescribed target plus a half-point of tolerance.
 */
export function withinIntendedEffort(session: ExerciseSessionRecord): boolean {
  const rpes = session.sets.filter(WORKING_SET).map((s) => s.rpe).filter((v): v is number => v !== null);
  if (rpes.length === 0) return true;
  const average = rpes.reduce((sum, v) => sum + v, 0) / rpes.length;
  const ceiling = (session.targetRpe ?? 8) + 0.5;
  return average <= ceiling;
}

export function heaviestWorkingWeight(session: ExerciseSessionRecord): number | null {
  const weights = session.sets.filter(WORKING_SET).map((s) => s.weightKg).filter((v): v is number => v !== null);
  return weights.length ? Math.max(...weights) : null;
}

function reportedDiscomfort(session: ExerciseSessionRecord): number {
  return session.sets.reduce((max, set) => Math.max(max, set.discomfortLevel ?? 0), 0);
}

/** Round to the nearest step the gym can actually load on a bar or machine. */
export function roundToLoadStep(weightKg: number, stepKg: number): number {
  if (stepKg <= 0) return Math.round(weightKg * 2) / 2;
  return Math.round(weightKg / stepKg) * stepKg;
}

/**
 * Progression size. Beginners on compound lifts can add more; everyone gets a
 * capped percentage so the engine cannot make a large jump on a heavy lift.
 */
export function nextLoad(currentKg: number, stepKg: number): number {
  const percentageCap = currentKg * 0.075;
  const increment = Math.min(Math.max(stepKg, 0.5), Math.max(percentageCap, stepKg));
  return roundToLoadStep(currentKg + increment, stepKg);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const CONSECUTIVE_SUCCESSES_TO_PROGRESS = 2;
const CONSECUTIVE_MISSES_TO_BACK_OFF = 2;

function ruleProgressExercise(
  history: ExerciseHistory,
  context: CoachingContext,
): CoachingRecommendation | null {
  if (context.progressionHoldReason) return null;
  if (context.restrictedMovements.includes(history.movementPattern)) return null;

  const recent = history.sessions.slice(0, CONSECUTIVE_SUCCESSES_TO_PROGRESS);
  if (recent.length < CONSECUTIVE_SUCCESSES_TO_PROGRESS) return null;
  if (recent.some((session) => reportedDiscomfort(session) >= 4)) return null;
  if (!recent.every((session) => metAllTargets(session) && withinIntendedEffort(session))) return null;

  const latest = recent[0]!;
  const currentLoad = heaviestWorkingWeight(latest);
  const evidence = {
    sessionsConsidered: recent.map((s) => ({
      sessionId: s.sessionId,
      performedOn: s.performedOn,
      metAllTargets: true,
      averageRpe: averageRpe(s),
    })),
  };

  // Loaded exercise → add weight. Bodyweight / timed → add reps.
  if (currentLoad !== null && currentLoad > 0) {
    const proposed = nextLoad(currentLoad, history.loadStepKg);
    return {
      ruleId: 'R-PROG-001',
      ruleVersion: RULE_VERSION,
      kind: 'progress_load',
      exerciseId: history.exerciseId,
      memberMessage: `Nice work — you hit every target on ${history.exerciseName} twice in a row. Try ${proposed} kg next time.`,
      rationale: `Two consecutive sessions met all prescribed reps within the intended effort ceiling; load increased by ${(
        proposed - currentLoad
      ).toFixed(1)} kg (capped at 7.5%).`,
      evidence,
      beforeValue: { weightKg: currentLoad },
      afterValue: { weightKg: proposed },
      requiresStaffApproval: false,
      precedence: 10,
    };
  }

  const topReps = Math.max(
    ...latest.sets.filter(WORKING_SET).map((s) => s.reps ?? 0),
    0,
  );
  const proposedReps = topReps + 2;
  return {
    ruleId: 'R-PROG-002',
    ruleVersion: RULE_VERSION,
    kind: 'progress_reps',
    exerciseId: history.exerciseId,
    memberMessage: `You are ready for a little more on ${history.exerciseName}. Aim for ${proposedReps} reps per set.`,
    rationale:
      'Two consecutive sessions met all prescribed reps within the intended effort ceiling on an unloaded movement; rep target raised by 2.',
    evidence,
    beforeValue: { reps: topReps },
    afterValue: { reps: proposedReps },
    requiresStaffApproval: false,
    precedence: 10,
  };
}

function averageRpe(session: ExerciseSessionRecord): number | null {
  const rpes = session.sets.filter(WORKING_SET).map((s) => s.rpe).filter((v): v is number => v !== null);
  if (!rpes.length) return null;
  return Number((rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1));
}

function ruleBackOffExercise(history: ExerciseHistory): CoachingRecommendation | null {
  const recent = history.sessions.slice(0, CONSECUTIVE_MISSES_TO_BACK_OFF);
  if (recent.length < CONSECUTIVE_MISSES_TO_BACK_OFF) return null;
  if (!recent.every((session) => missedTargets(session))) return null;

  const latest = recent[0]!;
  const currentLoad = heaviestWorkingWeight(latest);
  if (currentLoad !== null && currentLoad > 0) {
    const proposed = roundToLoadStep(currentLoad * 0.9, history.loadStepKg);
    return {
      ruleId: 'R-HOLD-003',
      ruleVersion: RULE_VERSION,
      kind: 'reduce_volume',
      exerciseId: history.exerciseId,
      memberMessage: `${history.exerciseName} has felt heavy for two sessions. We have set it to ${proposed} kg so you can rebuild clean reps — this is normal and it works.`,
      rationale:
        'Two consecutive sessions fell short of the prescribed rep floor. Load reduced ~10% to re-establish the target range.',
      evidence: {
        sessionsConsidered: recent.map((s) => ({ sessionId: s.sessionId, performedOn: s.performedOn, missedTargets: true })),
      },
      beforeValue: { weightKg: currentLoad },
      afterValue: { weightKg: proposed },
      requiresStaffApproval: false,
      precedence: 20,
    };
  }

  return {
    ruleId: 'R-HOLD-004',
    ruleVersion: RULE_VERSION,
    kind: 'hold',
    exerciseId: history.exerciseId,
    memberMessage: `We are holding ${history.exerciseName} at the same target this week. Focus on smooth reps rather than more reps.`,
    rationale: 'Two consecutive sessions fell short of target on an unloaded movement; targets held rather than increased.',
    evidence: { sessionsConsidered: recent.map((s) => s.sessionId) },
    beforeValue: null,
    afterValue: null,
    requiresStaffApproval: false,
    precedence: 20,
  };
}

function ruleMissedWorkouts(context: CoachingContext): CoachingRecommendation | null {
  const window = context.recentSessions.filter((s) => withinDays(s.scheduledFor, context.today, 14));
  const missed = window.filter((s) => s.state === 'skipped' || s.state === 'expired').length;
  const completed = window.filter((s) => s.state === 'completed').length;
  if (missed < 3) return null;

  const suggestedDays = Math.max(2, Math.min(context.trainingDaysPerWeek - 1, 3));
  return {
    ruleId: 'R-MISS-005',
    ruleVersion: RULE_VERSION,
    kind: 'shorten_week',
    exerciseId: null,
    memberMessage: `Life got busy — that happens. Want to switch to ${suggestedDays} shorter sessions a week? Consistency beats perfect.`,
    rationale: `${missed} missed sessions in the last 14 days against ${completed} completed. Offering a reduced weekly commitment instead of letting the plan drift.`,
    evidence: { missed, completed, windowDays: 14 },
    beforeValue: { daysPerWeek: context.trainingDaysPerWeek },
    afterValue: { daysPerWeek: suggestedDays },
    requiresStaffApproval: false,
    precedence: 30,
  };
}

function rulePoorRecovery(context: CoachingContext): CoachingRecommendation | null {
  const recent = context.recentCheckIns.slice(0, 2);
  if (recent.length < 2) return null;

  const poor = recent.filter(
    (c) =>
      (c.sorenessLevel ?? 0) >= 4 &&
      ((c.sleepQuality ?? 5) <= 2 || (c.energyLevel ?? 5) <= 2),
  );
  if (poor.length < 2) return null;

  return {
    ruleId: 'R-RECOV-006',
    ruleVersion: RULE_VERSION,
    kind: 'reduce_volume',
    exerciseId: null,
    memberMessage:
      'Your last two check-ins show high soreness with low sleep or energy. We have trimmed this week’s volume by about a third and a coach will look at your plan.',
    rationale:
      'Two consecutive check-ins reported soreness ≥ 4 with sleep or energy ≤ 2. Weekly volume reduced 33% and a staff review task created.',
    evidence: {
      checkIns: recent.map((c) => ({
        weekStarting: c.weekStarting,
        soreness: c.sorenessLevel,
        sleep: c.sleepQuality,
        energy: c.energyLevel,
      })),
    },
    beforeValue: { weeklyVolumeFactor: 1 },
    afterValue: { weeklyVolumeFactor: 0.67 },
    // A human decides whether this is training load or something else.
    requiresStaffApproval: true,
    precedence: 40,
  };
}

function ruleDiscomfortStopsProgression(
  history: ExerciseHistory,
): CoachingRecommendation | null {
  const latest = history.sessions[0];
  if (!latest) return null;
  const worst = reportedDiscomfort(latest);
  if (worst < 4) return null;

  return {
    ruleId: 'R-PAIN-007',
    ruleVersion: RULE_VERSION,
    kind: 'stop_progression',
    exerciseId: history.exerciseId,
    memberMessage: `You told us ${history.exerciseName} felt uncomfortable. We have stopped increasing it and asked a coach to check in with you. Please do not push through pain.`,
    rationale: `Discomfort level ${worst}/10 logged on ${history.exerciseName}. Automatic progression halted for this movement pending human review.`,
    evidence: { sessionId: latest.sessionId, discomfortLevel: worst, movementPattern: history.movementPattern },
    beforeValue: { progression: 'automatic' },
    afterValue: { progression: 'stopped', requiresReview: true },
    requiresStaffApproval: true,
    precedence: 100,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Evaluate every rule and return the surviving recommendations.
 *
 * Collision handling: at most one recommendation per exercise (highest
 * precedence wins) plus at most one plan-level recommendation. That keeps the
 * member from being handed three contradictory instructions.
 */
export function evaluateCoachingRules(context: CoachingContext): CoachingRecommendation[] {
  const perExercise = new Map<string, CoachingRecommendation>();

  for (const history of context.histories) {
    const candidates = [
      ruleDiscomfortStopsProgression(history),
      ruleBackOffExercise(history),
      ruleProgressExercise(history, context),
    ].filter((r): r is CoachingRecommendation => r !== null);

    const winner = candidates.sort((a, b) => b.precedence - a.precedence)[0];
    if (winner) perExercise.set(history.exerciseId, winner);
  }

  const planLevel = [rulePoorRecovery(context), ruleMissedWorkouts(context)]
    .filter((r): r is CoachingRecommendation => r !== null)
    .sort((a, b) => b.precedence - a.precedence)
    .slice(0, 1);

  return [...planLevel, ...perExercise.values()].sort((a, b) => b.precedence - a.precedence);
}

/**
 * The load to pre-fill in the workout player. Uses the member's own history,
 * never a population average, and refuses to suggest an increase while a
 * progression hold or movement restriction is in force.
 */
export function suggestedLoadForNextSession(
  history: ExerciseHistory,
  context: Pick<CoachingContext, 'progressionHoldReason' | 'restrictedMovements'>,
  prescribedStartingLoadKg: number | null,
): number | null {
  const latest = history.sessions[0];
  if (!latest) return prescribedStartingLoadKg;

  const last = heaviestWorkingWeight(latest);
  if (last === null) return prescribedStartingLoadKg;

  const blocked =
    Boolean(context.progressionHoldReason) ||
    context.restrictedMovements.includes(history.movementPattern) ||
    reportedDiscomfort(latest) >= 4;
  if (blocked) return last;

  const previous = history.sessions[1];
  const twoGoodSessions =
    previous !== undefined &&
    metAllTargets(latest) &&
    withinIntendedEffort(latest) &&
    metAllTargets(previous) &&
    withinIntendedEffort(previous);

  if (twoGoodSessions) return nextLoad(last, history.loadStepKg);
  if (missedTargets(latest)) return roundToLoadStep(last * 0.9, history.loadStepKg);
  return last;
}

export function withinDays(date: string, today: string, days: number): boolean {
  const then = new Date(`${date}T00:00:00Z`).getTime();
  const now = new Date(`${today}T00:00:00Z`).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return false;
  const diff = (now - then) / 86_400_000;
  return diff >= 0 && diff <= days;
}

/** Estimated 1RM (Epley), used for strength trends and PR detection. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Number((weightKg * (1 + reps / 30)).toFixed(1));
}

export function movementPatternLabel(pattern: MovementPattern): string {
  return pattern.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
