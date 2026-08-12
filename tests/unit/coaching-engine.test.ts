import { describe, expect, it } from 'vitest';
import {
  computeAdherence,
  computeSessionTotals,
  computeStreak,
  detectPersonalRecords,
  estimatedOneRepMax,
  evaluateCoachingRules,
  metAllTargets,
  missedTargets,
  nextLoad,
  resolveSubstitutions,
  roundToLoadStep,
  suggestedLoadForNextSession,
  withinIntendedEffort,
  type CoachingContext,
  type ExerciseHistory,
  type ExerciseSessionRecord,
  type SubstitutionCandidate,
} from '@gymguide/domain';

function session(
  overrides: Partial<ExerciseSessionRecord> & { sets?: Array<Partial<ExerciseSessionRecord['sets'][number]>> } = {},
): ExerciseSessionRecord {
  const sets = (overrides.sets ?? [{}, {}, {}]).map((set, index) => ({
    setNumber: index + 1,
    reps: 10,
    weightKg: 40,
    rpe: 7,
    targetRepsMin: 8,
    targetRepsMax: 10,
    isWarmup: false,
    skipped: false,
    discomfortLevel: null,
    ...set,
  }));
  return {
    sessionId: overrides.sessionId ?? `s-${Math.random().toString(36).slice(2, 8)}`,
    performedOn: overrides.performedOn ?? '2026-08-01',
    prescribedSets: overrides.prescribedSets ?? sets.filter((s) => !s.isWarmup).length,
    targetRpe: overrides.targetRpe ?? 8,
    sets,
  };
}

function history(overrides: Partial<ExerciseHistory> = {}): ExerciseHistory {
  return {
    exerciseId: 'ex-goblet-squat',
    exerciseName: 'Goblet Squat',
    movementPattern: 'squat',
    loadStepKg: 2.5,
    sessions: [session(), session()],
    ...overrides,
  };
}

function context(overrides: Partial<CoachingContext> = {}): CoachingContext {
  return {
    userId: 'u1',
    programAssignmentId: 'pa1',
    goal: 'muscle_gain',
    experienceLevel: 'beginner',
    progressionHoldReason: null,
    restrictedMovements: [],
    trainingDaysPerWeek: 4,
    today: '2026-08-10',
    histories: [history()],
    recentSessions: [],
    recentCheckIns: [],
    availableEquipmentCodes: ['dumbbell', 'barbell', 'bench'],
    ...overrides,
  };
}

describe('target evaluation', () => {
  it('recognises a session where every working set hit the top of the range', () => {
    expect(metAllTargets(session())).toBe(true);
  });

  it('does not count a session with fewer working sets than prescribed', () => {
    expect(metAllTargets(session({ prescribedSets: 4 }))).toBe(false);
  });

  it('ignores warm-up sets when judging targets', () => {
    const s = session({
      sets: [{ isWarmup: true, reps: 5, weightKg: 20 }, {}, {}, {}],
      prescribedSets: 3,
    });
    expect(metAllTargets(s)).toBe(true);
  });

  it('flags a session that fell below the rep floor', () => {
    expect(missedTargets(session({ sets: [{ reps: 6 }, {}, {}] }))).toBe(true);
  });

  it('treats a skipped set as a miss', () => {
    expect(missedTargets(session({ sets: [{ skipped: true }, {}, {}], prescribedSets: 3 }))).toBe(true);
  });

  it('respects the effort ceiling', () => {
    expect(withinIntendedEffort(session({ targetRpe: 8, sets: [{ rpe: 8 }, { rpe: 8.5 }, { rpe: 8 }] }))).toBe(true);
    expect(withinIntendedEffort(session({ targetRpe: 7, sets: [{ rpe: 9.5 }, { rpe: 10 }, { rpe: 9 }] }))).toBe(false);
  });

  it('treats a missing RPE as within effort (simple effort scale)', () => {
    expect(withinIntendedEffort(session({ sets: [{ rpe: null }, { rpe: null }, { rpe: null }] }))).toBe(true);
  });
});

describe('load progression maths', () => {
  it('rounds to the loadable step', () => {
    expect(roundToLoadStep(41.3, 2.5)).toBe(42.5);
    expect(roundToLoadStep(40.9, 2.5)).toBe(40);
    expect(roundToLoadStep(43.9, 2.5)).toBe(45);
  });

  it('adds the step for light loads', () => {
    expect(nextLoad(40, 2.5)).toBe(42.5);
  });

  it('never jumps more than 7.5% on a heavy lift', () => {
    const from = 200;
    const to = nextLoad(from, 2.5);
    expect(to).toBeGreaterThan(from);
    expect(to - from).toBeLessThanOrEqual(from * 0.075 + 2.5);
  });

  it('computes Epley 1RM and returns the weight itself for a single', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.3, 1);
    expect(estimatedOneRepMax(0, 5)).toBe(0);
  });
});

describe('R-PROG-001 controlled progression', () => {
  it('progresses load after two clean sessions at the intended effort', () => {
    const recommendations = evaluateCoachingRules(context());
    expect(recommendations).toHaveLength(1);
    const rec = recommendations[0]!;
    expect(rec.ruleId).toBe('R-PROG-001');
    expect(rec.kind).toBe('progress_load');
    expect(rec.beforeValue).toEqual({ weightKg: 40 });
    expect(rec.afterValue).toEqual({ weightKg: 42.5 });
    expect(rec.requiresStaffApproval).toBe(false);
  });

  it('does not progress after only one good session', () => {
    const recommendations = evaluateCoachingRules(
      context({ histories: [history({ sessions: [session()] })] }),
    );
    expect(recommendations).toHaveLength(0);
  });

  it('does not progress when the member was grinding', () => {
    const grinding = session({ targetRpe: 8, sets: [{ rpe: 10 }, { rpe: 10 }, { rpe: 9.5 }] });
    const recommendations = evaluateCoachingRules(
      context({ histories: [history({ sessions: [grinding, grinding] })] }),
    );
    expect(recommendations).toHaveLength(0);
  });

  it('raises reps instead of load for bodyweight work', () => {
    const bodyweight = session({ sets: [{ weightKg: null }, { weightKg: null }, { weightKg: null }] });
    const [rec] = evaluateCoachingRules(
      context({
        histories: [history({ exerciseName: 'Push-up', sessions: [bodyweight, bodyweight] })],
      }),
    );
    expect(rec?.kind).toBe('progress_reps');
    expect(rec?.afterValue).toEqual({ reps: 12 });
  });
});

describe('safety invariants', () => {
  it('never auto-progresses a member with a progression hold', () => {
    const recommendations = evaluateCoachingRules(
      context({ progressionHoldReason: 'new_injury reported — awaiting staff review' }),
    );
    expect(recommendations.some((r) => r.kind.startsWith('progress'))).toBe(false);
  });

  it('never auto-progresses a restricted movement pattern', () => {
    const recommendations = evaluateCoachingRules(context({ restrictedMovements: ['squat'] }));
    expect(recommendations.some((r) => r.kind.startsWith('progress'))).toBe(false);
  });

  it('pain outranks progression and demands staff approval', () => {
    const painful = session({ sets: [{ discomfortLevel: 7 }, {}, {}] });
    const recommendations = evaluateCoachingRules(
      context({ histories: [history({ sessions: [painful, session()] })] }),
    );
    const rec = recommendations[0]!;
    expect(rec.ruleId).toBe('R-PAIN-007');
    expect(rec.kind).toBe('stop_progression');
    expect(rec.requiresStaffApproval).toBe(true);
    expect(recommendations.some((r) => r.kind.startsWith('progress'))).toBe(false);
  });

  it('produces at most one recommendation per exercise', () => {
    const painful = session({ sets: [{ discomfortLevel: 8, reps: 4 }, { reps: 4 }, { reps: 4 }] });
    const recommendations = evaluateCoachingRules(
      context({ histories: [history({ sessions: [painful, painful] })] }),
    );
    expect(recommendations.filter((r) => r.exerciseId === 'ex-goblet-squat')).toHaveLength(1);
  });
});

describe('R-HOLD-003 backing off', () => {
  it('reduces load about 10% after two missed sessions', () => {
    const missed = session({ sets: [{ reps: 5 }, { reps: 5 }, { reps: 4 }] });
    const [rec] = evaluateCoachingRules(
      context({ histories: [history({ sessions: [missed, missed] })] }),
    );
    expect(rec?.ruleId).toBe('R-HOLD-003');
    expect(rec?.afterValue).toEqual({ weightKg: 35 });
  });
});

describe('R-MISS-005 missed workouts', () => {
  it('offers a shorter week after three missed sessions in 14 days', () => {
    const recommendations = evaluateCoachingRules(
      context({
        histories: [],
        recentSessions: [
          { sessionId: '1', scheduledFor: '2026-08-01', state: 'skipped', sessionRpe: null, discomfortReported: false },
          { sessionId: '2', scheduledFor: '2026-08-03', state: 'skipped', sessionRpe: null, discomfortReported: false },
          { sessionId: '3', scheduledFor: '2026-08-05', state: 'expired', sessionRpe: null, discomfortReported: false },
          { sessionId: '4', scheduledFor: '2026-08-07', state: 'completed', sessionRpe: 7, discomfortReported: false },
        ],
      }),
    );
    const rec = recommendations.find((r) => r.ruleId === 'R-MISS-005');
    expect(rec?.kind).toBe('shorten_week');
    expect(rec?.afterValue).toEqual({ daysPerWeek: 3 });
  });

  it('ignores sessions outside the 14-day window', () => {
    const recommendations = evaluateCoachingRules(
      context({
        histories: [],
        recentSessions: [
          { sessionId: '1', scheduledFor: '2026-06-01', state: 'skipped', sessionRpe: null, discomfortReported: false },
          { sessionId: '2', scheduledFor: '2026-06-03', state: 'skipped', sessionRpe: null, discomfortReported: false },
          { sessionId: '3', scheduledFor: '2026-06-05', state: 'skipped', sessionRpe: null, discomfortReported: false },
        ],
      }),
    );
    expect(recommendations).toHaveLength(0);
  });
});

describe('R-RECOV-006 poor recovery', () => {
  it('reduces volume and requires a human to look at it', () => {
    const recommendations = evaluateCoachingRules(
      context({
        histories: [],
        recentCheckIns: [
          { weekStarting: '2026-08-03', sleepQuality: 2, stressLevel: 4, sorenessLevel: 5, energyLevel: 2, nutritionAdherence: 3 },
          { weekStarting: '2026-07-27', sleepQuality: 1, stressLevel: 5, sorenessLevel: 4, energyLevel: 2, nutritionAdherence: 3 },
        ],
      }),
    );
    const rec = recommendations.find((r) => r.ruleId === 'R-RECOV-006');
    expect(rec?.kind).toBe('reduce_volume');
    expect(rec?.requiresStaffApproval).toBe(true);
  });

  it('does not fire on a single bad week', () => {
    const recommendations = evaluateCoachingRules(
      context({
        histories: [],
        recentCheckIns: [
          { weekStarting: '2026-08-03', sleepQuality: 1, stressLevel: 5, sorenessLevel: 5, energyLevel: 1, nutritionAdherence: 3 },
        ],
      }),
    );
    expect(recommendations).toHaveLength(0);
  });
});

describe('suggested load for the workout player', () => {
  it('pre-fills the progressed load after two good sessions', () => {
    expect(suggestedLoadForNextSession(history(), { progressionHoldReason: null, restrictedMovements: [] }, 30)).toBe(42.5);
  });

  it('holds the load when a hold is in force', () => {
    expect(
      suggestedLoadForNextSession(history(), { progressionHoldReason: 'pain', restrictedMovements: [] }, 30),
    ).toBe(40);
  });

  it('falls back to the prescribed starting load with no history', () => {
    expect(
      suggestedLoadForNextSession(history({ sessions: [] }), { progressionHoldReason: null, restrictedMovements: [] }, 30),
    ).toBe(30);
  });

  it('backs off after a missed session, rounded to a loadable step', () => {
    const missed = session({ sets: [{ reps: 5 }, { reps: 5 }, { reps: 5 }] });
    // 40kg × 0.9 = 36kg, which rounds down to the nearest 2.5kg the gym can load.
    expect(
      suggestedLoadForNextSession(history({ sessions: [missed] }), { progressionHoldReason: null, restrictedMovements: [] }, 30),
    ).toBe(35);
  });
});

describe('substitutions', () => {
  const candidates: SubstitutionCandidate[] = [
    {
      exerciseId: 'ex-leg-press',
      name: 'Leg Press',
      movementPattern: 'squat',
      requiredEquipmentCodes: ['leg_press'],
      difficulty: 'beginner',
      isLowImpact: true,
      contraindications: [],
      reason: 'equipment',
      preferenceRank: 2,
    },
    {
      exerciseId: 'ex-bodyweight-squat',
      name: 'Bodyweight Squat',
      movementPattern: 'squat',
      requiredEquipmentCodes: ['bodyweight'],
      difficulty: 'first_time',
      isLowImpact: true,
      contraindications: [],
      reason: 'equipment',
      preferenceRank: 1,
    },
    {
      exerciseId: 'ex-bench-press',
      name: 'Bench Press',
      movementPattern: 'horizontal_push',
      requiredEquipmentCodes: ['barbell', 'bench'],
      difficulty: 'intermediate',
      isLowImpact: false,
      contraindications: [],
      reason: 'equipment',
      preferenceRank: 1,
    },
    {
      exerciseId: 'ex-box-squat',
      name: 'Box Squat',
      movementPattern: 'squat',
      requiredEquipmentCodes: ['box'],
      difficulty: 'beginner',
      isLowImpact: true,
      contraindications: ['knee_replacement'],
      reason: 'equipment',
      preferenceRank: 3,
    },
  ];

  it('only offers approved swaps in the same movement pattern with available equipment', () => {
    const result = resolveSubstitutions({
      originalExerciseId: 'ex-goblet-squat',
      originalMovementPattern: 'squat',
      reason: 'equipment',
      availableEquipmentCodes: ['box'],
      restrictedMovements: [],
      memberConditions: [],
      requireLowImpact: false,
      approvedCandidates: candidates,
    });
    expect(result.allowed.map((c) => c.exerciseId)).toEqual(['ex-bodyweight-squat', 'ex-box-squat']);
    expect(result.rejected.find((r) => r.exerciseId === 'ex-bench-press')?.because).toBe('Different movement pattern');
    expect(result.rejected.find((r) => r.exerciseId === 'ex-leg-press')?.because).toContain('not available');
  });

  it('refuses swaps that clash with a condition on file', () => {
    const result = resolveSubstitutions({
      originalExerciseId: 'ex-goblet-squat',
      originalMovementPattern: 'squat',
      reason: 'equipment',
      availableEquipmentCodes: ['box'],
      restrictedMovements: [],
      memberConditions: ['knee_replacement'],
      requireLowImpact: false,
      approvedCandidates: candidates,
    });
    expect(result.allowed.map((c) => c.exerciseId)).toEqual(['ex-bodyweight-squat']);
    expect(result.rejected.some((r) => r.because.includes('Contraindicated'))).toBe(true);
  });

  it('escalates to staff when nothing is safe', () => {
    const result = resolveSubstitutions({
      originalExerciseId: 'ex-goblet-squat',
      originalMovementPattern: 'squat',
      reason: 'equipment',
      availableEquipmentCodes: [],
      restrictedMovements: ['squat'],
      memberConditions: [],
      requireLowImpact: false,
      approvedCandidates: candidates,
    });
    expect(result.allowed).toHaveLength(0);
    expect(result.escalationHint).toContain('Ask a coach');
  });
});

describe('adherence, streaks and records', () => {
  it('gives half credit for partial sessions', () => {
    const result = computeAdherence([
      { scheduledFor: '2026-08-01', state: 'completed', completedSets: 12, prescribedSets: 12, totalVolumeKg: 1000 },
      { scheduledFor: '2026-08-03', state: 'skipped', completedSets: 6, prescribedSets: 12, totalVolumeKg: 400 },
      { scheduledFor: '2026-08-05', state: 'skipped', completedSets: 0, prescribedSets: 12, totalVolumeKg: 0 },
      { scheduledFor: '2026-08-07', state: 'completed', completedSets: 12, prescribedSets: 12, totalVolumeKg: 1100 },
    ]);
    expect(result.completed).toBe(2);
    expect(result.partial).toBe(1);
    expect(result.adherencePercent).toBe(63);
    expect(result.band).toBe('building');
  });

  it('never returns a negative adherence score', () => {
    expect(computeAdherence([]).adherencePercent).toBe(0);
  });

  it('counts the current streak back from the latest session', () => {
    const { current, best } = computeStreak([
      { scheduledFor: '2026-08-01', state: 'completed', completedSets: 1, prescribedSets: 1, totalVolumeKg: 0 },
      { scheduledFor: '2026-08-03', state: 'skipped', completedSets: 0, prescribedSets: 1, totalVolumeKg: 0 },
      { scheduledFor: '2026-08-05', state: 'completed', completedSets: 1, prescribedSets: 1, totalVolumeKg: 0 },
      { scheduledFor: '2026-08-07', state: 'completed', completedSets: 1, prescribedSets: 1, totalVolumeKg: 0 },
    ]);
    expect(current).toBe(2);
    expect(best).toBe(2);
  });

  it('detects personal records without regressing existing ones', () => {
    const found = detectPersonalRecords(
      [
        { exerciseId: 'ex1', exerciseName: 'Bench Press', weightKg: 60, reps: 8, setLogId: 'sl1', achievedAt: '2026-08-08T10:00:00Z' },
      ],
      [
        { exerciseId: 'ex1', kind: 'max_weight', value: 60 },
        { exerciseId: 'ex1', kind: 'best_e1rm', value: 70 },
        { exerciseId: 'ex1', kind: 'max_reps', value: 12 },
      ],
    );
    // 60kg equals the existing max, e1RM of 76 beats 70, 8 reps does not beat 12.
    expect(found.map((f) => f.kind)).toEqual(['best_e1rm']);
    expect(found[0]?.previousValue).toBe(70);
  });

  it('computes session totals ignoring warm-ups and skipped sets', () => {
    const totals = computeSessionTotals(
      [
        { reps: 10, weightKg: 20, rpe: 5, isWarmup: true, skipped: false },
        { reps: 10, weightKg: 50, rpe: 8, isWarmup: false, skipped: false },
        { reps: 8, weightKg: 50, rpe: 9, isWarmup: false, skipped: false },
        { reps: null, weightKg: null, rpe: null, isWarmup: false, skipped: true },
      ],
      3,
    );
    expect(totals.totalVolumeKg).toBe(900);
    expect(totals.completedSets).toBe(3);
    expect(totals.workingReps).toBe(18);
    expect(totals.hardestSetRpe).toBe(9);
  });
});
