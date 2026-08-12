import { describe, expect, it } from 'vitest';
import {
  computeNutritionTargets,
  detectMilestones,
  estimateBmr,
  evaluateAutomationGate,
  isWithinQuietHours,
  matchProgram,
  nutritionAdherenceBand,
  plateGuidance,
  scoreInactivityRisk,
  type AutomationGateInput,
  type MatchProfile,
  type ProgramCandidate,
  type TargetInputs,
} from '@gymguide/domain';

function targetInputs(overrides: Partial<TargetInputs> = {}): TargetInputs {
  return {
    weightKg: 82,
    heightCm: 175,
    ageYears: 31,
    sex: 'male',
    activityLevel: 'desk',
    trainingDaysPerWeek: 4,
    goal: 'fat_loss',
    approach: 'macros',
    eatingDisorderConcern: false,
    pregnancyOrPostpartum: false,
    ramadanSchedule: false,
    ...overrides,
  };
}

describe('nutrition guard rails', () => {
  it('never recommends fewer than 1200 kcal', () => {
    const result = computeNutritionTargets(
      targetInputs({ weightKg: 42, heightCm: 148, ageYears: 60, sex: 'female', goal: 'fat_loss', activityLevel: 'desk' }),
    );
    expect(result.caloriesKcal).not.toBeNull();
    expect(result.caloriesKcal!).toBeGreaterThanOrEqual(1200);
  });

  it('never sets a deficit deeper than 20% of maintenance', () => {
    const inputs = targetInputs({ goal: 'fat_loss' });
    const result = computeNutritionTargets(inputs);
    const bmr = estimateBmr(inputs);
    expect(result.caloriesKcal!).toBeGreaterThanOrEqual(Math.round(bmr * 0.85));
  });

  it('caps weekly weight change at 0.75 kg', () => {
    for (const goal of ['fat_loss', 'weight_gain', 'bulking'] as const) {
      const result = computeNutritionTargets(targetInputs({ goal }));
      expect(Math.abs(result.weeklyChangeKg ?? 0)).toBeLessThanOrEqual(0.75);
    }
  });

  it('refuses numeric targets entirely when an eating concern is on file', () => {
    const result = computeNutritionTargets(targetInputs({ eatingDisorderConcern: true }));
    expect(result.caloriesKcal).toBeNull();
    expect(result.proteinG).toBeNull();
    expect(result.approach).toBe('plate');
    expect(result.requiresProfessionalReview).toBe(true);
    expect(result.guardRailNotes.join(' ')).toMatch(/disabled/i);
  });

  it('flags pregnancy for professional review', () => {
    const result = computeNutritionTargets(targetInputs({ pregnancyOrPostpartum: true }));
    expect(result.requiresProfessionalReview).toBe(true);
    expect(result.guardRailNotes.join(' ')).toMatch(/qualified professional/i);
  });

  it('hides macro numbers for members who chose plate guidance', () => {
    const result = computeNutritionTargets(targetInputs({ approach: 'plate' }));
    expect(result.caloriesKcal).toBeNull();
    expect(result.plate.explanation.length).toBeGreaterThan(3);
  });

  it('always attaches a non-medical disclaimer', () => {
    expect(computeNutritionTargets(targetInputs()).disclaimer).toMatch(/not medical/i);
  });

  it('scales plate portions to the goal', () => {
    const lean = plateGuidance({ goal: 'fat_loss', weightKg: 80, trainingDaysPerWeek: 4 });
    const gain = plateGuidance({ goal: 'muscle_gain', weightKg: 80, trainingDaysPerWeek: 4 });
    expect(gain.proteinPalms).toBeGreaterThan(lean.proteinPalms);
    expect(lean.vegFists).toBeGreaterThan(gain.vegFists);
  });

  it('gives supportive, non-punitive feedback on a heavy day', () => {
    const band = nutritionAdherenceBand(3200, 2200);
    expect(band.band).toBe('well_over');
    expect(band.message).toMatch(/no need to compensate/i);
  });

  it('warns when a member is eating far too little', () => {
    expect(nutritionAdherenceBand(900, 2200).band).toBe('well_under');
  });
});

describe('program matching', () => {
  const candidates: ProgramCandidate[] = [
    {
      programId: 'p-induction',
      code: 'beginner_induction',
      name: 'Gym Induction',
      summary: '',
      intent: 'beginner_induction',
      goal: 'beginner_confidence',
      experienceLevel: 'first_time',
      daysPerWeek: 2,
      sessionMinutes: 30,
      totalWeeks: 4,
      requiresEquipmentCodes: ['dumbbell'],
      lowImpact: true,
      ramadanFriendly: true,
      contraindications: [],
      scope: 'platform',
    },
    {
      programId: 'p-hyper',
      code: 'hypertrophy_4d',
      name: 'Hypertrophy 4-Day',
      summary: '',
      intent: 'hypertrophy',
      goal: 'muscle_gain',
      experienceLevel: 'intermediate',
      daysPerWeek: 4,
      sessionMinutes: 60,
      totalWeeks: 12,
      requiresEquipmentCodes: ['barbell', 'rack', 'bench', 'cable'],
      lowImpact: false,
      ramadanFriendly: false,
      contraindications: ['heart_condition'],
      scope: 'organization',
    },
    {
      programId: 'p-lowimpact',
      code: 'low_impact',
      name: 'Low Impact Strength',
      summary: '',
      intent: 'low_impact',
      goal: 'general_fitness',
      experienceLevel: 'beginner',
      daysPerWeek: 3,
      sessionMinutes: 40,
      totalWeeks: 8,
      requiresEquipmentCodes: ['dumbbell'],
      lowImpact: true,
      ramadanFriendly: true,
      contraindications: [],
      scope: 'platform',
    },
  ];

  function profile(overrides: Partial<MatchProfile> = {}): MatchProfile {
    return {
      goal: 'muscle_gain',
      experienceLevel: 'intermediate',
      daysPerWeek: 4,
      sessionMinutes: 60,
      availableEquipmentCodes: ['barbell', 'rack', 'bench', 'cable', 'dumbbell'],
      needsLowImpact: false,
      ramadanMode: false,
      trainsAtHome: false,
      conditions: [],
      requiresHumanReview: false,
      ...overrides,
    };
  }

  it('matches an experienced member to the hypertrophy template', () => {
    const outcome = matchProgram(profile(), candidates);
    expect(outcome.best?.program.programId).toBe('p-hyper');
    expect(outcome.needsHumanAssignment).toBe(false);
  });

  it('sends a first-timer to the induction program', () => {
    const outcome = matchProgram(
      profile({ experienceLevel: 'first_time', goal: 'beginner_confidence', daysPerWeek: 2, sessionMinutes: 30 }),
      candidates,
    );
    expect(outcome.best?.program.programId).toBe('p-induction');
  });

  it('prefers low-impact programming when the safety engine requires it', () => {
    const outcome = matchProgram(profile({ needsLowImpact: true }), candidates);
    expect(outcome.best?.program.lowImpact).toBe(true);
  });

  it('requires a human when the member was flagged by screening', () => {
    const outcome = matchProgram(profile({ requiresHumanReview: true }), candidates);
    expect(outcome.needsHumanAssignment).toBe(true);
    expect(outcome.note).toMatch(/qualified staff member must approve/i);
  });

  it('penalises a program the branch lacks equipment for', () => {
    const outcome = matchProgram(profile({ availableEquipmentCodes: ['dumbbell'] }), candidates);
    expect(outcome.best?.program.programId).not.toBe('p-hyper');
  });

  it('warns loudly about a contraindicated program', () => {
    const explanation = matchProgram(profile({ conditions: ['heart_condition'] }), candidates).ranked.find(
      (r) => r.program.programId === 'p-hyper',
    );
    expect(explanation?.warnings.join(' ')).toMatch(/Contraindicated/);
    expect(explanation?.requiresCoachApproval).toBe(true);
  });
});

describe('inactivity risk', () => {
  const base = {
    daysSinceLastVisit: 2,
    daysSinceLastWorkout: 2,
    workoutsLast28Days: 14,
    plannedLast28Days: 16,
    checkInsLast8Weeks: 6,
    habitLogsLast7Days: 6,
    hasOverdueInvoice: false,
    membershipEndsInDays: 60,
    onboardingComplete: true,
    daysSinceJoined: 200,
  };

  it('scores a consistent member as healthy', () => {
    const risk = scoreInactivityRisk(base);
    expect(risk.band).toBe('healthy');
    expect(risk.recommendedAction).toMatch(/No action/);
  });

  it('escalates a member who has vanished for a month with money owing', () => {
    const risk = scoreInactivityRisk({
      ...base,
      daysSinceLastWorkout: 35,
      workoutsLast28Days: 0,
      hasOverdueInvoice: true,
      membershipEndsInDays: 7,
    });
    expect(risk.band).toBe('critical');
    expect(risk.drivers).toContain('Payment overdue');
    expect(risk.recommendedAction).toMatch(/Call the member/);
  });

  it('does not punish a member who joined three days ago', () => {
    const risk = scoreInactivityRisk({
      ...base,
      daysSinceJoined: 3,
      daysSinceLastWorkout: null,
      workoutsLast28Days: 0,
      plannedLast28Days: 4,
      onboardingComplete: false,
      checkInsLast8Weeks: 0,
      habitLogsLast7Days: 0,
    });
    expect(risk.score).toBeLessThanOrEqual(25);
  });

  it('flags abandoned onboarding', () => {
    const risk = scoreInactivityRisk({ ...base, onboardingComplete: false, daysSinceJoined: 10 });
    expect(risk.drivers).toContain('Onboarding never finished');
  });
});

describe('automation gate', () => {
  function gate(overrides: Partial<AutomationGateInput> = {}): AutomationGateInput {
    return {
      channel: 'push',
      category: 'coaching',
      memberLocalTime: '18:00',
      quietHoursStart: '21:30',
      quietHoursEnd: '07:30',
      respectQuietHours: true,
      requiresOptIn: true,
      memberOptedIn: true,
      categoryEnabled: true,
      sentThisWeek: 0,
      maxPerWeek: 3,
      hoursSinceLastSameAutomation: null,
      cooldownHours: 24,
      alreadySentDedupeKey: false,
      memberIsSuspended: false,
      automationPausedUntil: null,
      now: '2026-08-11T13:00:00.000Z',
      ...overrides,
    };
  }

  it('detects quiet hours that wrap midnight', () => {
    expect(isWithinQuietHours('22:00', '21:30', '07:30')).toBe(true);
    expect(isWithinQuietHours('03:00', '21:30', '07:30')).toBe(true);
    expect(isWithinQuietHours('12:00', '21:30', '07:30')).toBe(false);
    expect(isWithinQuietHours('07:30', '21:30', '07:30')).toBe(false);
  });

  it('allows an ordinary coaching nudge in the evening', () => {
    expect(evaluateAutomationGate(gate()).allowed).toBe(true);
  });

  it('defers a message that lands inside quiet hours', () => {
    const decision = evaluateAutomationGate(gate({ memberLocalTime: '23:15' }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/Quiet hours/);
      expect(decision.deferUntil).not.toBeNull();
    }
  });

  it('blocks marketing without opt-in', () => {
    const decision = evaluateAutomationGate(gate({ category: 'marketing', memberOptedIn: false }));
    expect(decision.allowed).toBe(false);
  });

  it('respects the weekly cap and the cooldown', () => {
    expect(evaluateAutomationGate(gate({ sentThisWeek: 3 })).allowed).toBe(false);
    expect(evaluateAutomationGate(gate({ hoursSinceLastSameAutomation: 4 })).allowed).toBe(false);
  });

  it('is idempotent on the dedupe key', () => {
    const decision = evaluateAutomationGate(gate({ alreadySentDedupeKey: true }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toMatch(/Already sent/);
  });

  it('lets safety messages through quiet hours and caps', () => {
    const decision = evaluateAutomationGate(
      gate({ category: 'safety', memberLocalTime: '02:00', sentThisWeek: 20, memberOptedIn: false }),
    );
    expect(decision.allowed).toBe(true);
  });

  it('never messages a suspended member', () => {
    expect(evaluateAutomationGate(gate({ category: 'safety', memberIsSuspended: true })).allowed).toBe(false);
  });
});

describe('milestones', () => {
  it('celebrates the first session warmly', () => {
    const milestones = detectMilestones({ completedWorkouts: 1, currentStreak: 1, totalVolumeKg: 800, daysSinceJoined: 2 });
    expect(milestones[0]?.label).toBe('First session done');
  });

  it('does not invent a milestone on an ordinary day', () => {
    expect(detectMilestones({ completedWorkouts: 7, currentStreak: 3, totalVolumeKg: 4200, daysSinceJoined: 30 })).toHaveLength(0);
  });

  it('recognises tonnage milestones', () => {
    const milestones = detectMilestones({ completedWorkouts: 51, currentStreak: 4, totalVolumeKg: 25_400, daysSinceJoined: 200 });
    expect(milestones.some((m) => m.key === 'volume_25t')).toBe(true);
  });
});
