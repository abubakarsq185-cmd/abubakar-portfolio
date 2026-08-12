import { describe, expect, it } from 'vitest';
import {
  assessScreening,
  assessWorkoutReport,
  automationAllowed,
  classifyRequest,
  decideSafety,
  triageFreeText,
  validateAiOutput,
  type ScreeningAnswers,
} from '@gymguide/domain';

function answers(overrides: Partial<ScreeningAnswers> = {}): ScreeningAnswers {
  return {
    redFlags: {
      chestPain: false,
      fainting: false,
      severeDizziness: false,
      breathingDifficulty: false,
      currentSharpPain: false,
      recentSurgery: false,
      pregnancyOrPostpartum: false,
      doctorAdvisedAgainstExercise: false,
      disorderedEatingConcern: false,
      ...overrides.redFlags,
    },
    conditions: overrides.conditions ?? [],
    painAreas: overrides.painAreas ?? [],
    medications: overrides.medications ?? false,
    detail: overrides.detail,
  };
}

describe('health screening assessment', () => {
  it('produces no risks for a healthy adult', () => {
    const decision = decideSafety(assessScreening(answers()));
    expect(decision.risks).toHaveLength(0);
    expect(decision.progressionHoldReason).toBeNull();
    expect(decision.memberNotice).toBeNull();
    expect(decision.staffEscalation).toBeNull();
    expect(automationAllowed(decision)).toBe(true);
  });

  it('escalates chest pain as critical and stops automation', () => {
    const decision = decideSafety(assessScreening(answers({ redFlags: { chestPain: true } as never })));
    expect(decision.highestSeverity).toBe('critical');
    expect(decision.blockAutomatedPlanChanges).toBe(true);
    expect(decision.progressionHoldReason).toContain('chest_pain');
    expect(decision.memberNotice?.tone).toBe('stop');
    expect(decision.memberNotice?.body).toMatch(/stop exercising/i);
    expect(decision.staffEscalation?.priority).toBe('urgent');
    expect(decision.staffEscalation?.slaHours).toBe(1);
    expect(automationAllowed(decision)).toBe(false);
  });

  it('never tells a member they are medically fine', () => {
    const decision = decideSafety(assessScreening(answers({ conditions: ['heart_condition'] })));
    const copy = `${decision.memberNotice?.title ?? ''} ${decision.memberNotice?.body ?? ''}`;
    expect(copy).not.toMatch(/you are (fine|safe|healthy)/i);
    expect(decision.requiresClearance).toBe(true);
  });

  it('restricts the movement patterns a painful joint loads', () => {
    const decision = decideSafety(assessScreening(answers({ painAreas: ['lower_back', 'knee'] })));
    expect(decision.restrictedMovements).toContain('hinge');
    expect(decision.restrictedMovements).toContain('squat');
    expect(decision.restrictedMovements).toContain('knee_isolation');
    expect(decision.requiresHumanAssignment).toBe(true);
  });

  it('turns off numeric nutrition targets on a disclosed eating concern', () => {
    const decision = decideSafety(assessScreening(answers({ redFlags: { disorderedEatingConcern: true } as never })));
    expect(decision.blockNutritionTargets).toBe(true);
    expect(decision.staffEscalation?.assignedRole).toBe('nutrition_professional');
  });

  it('notes medication without blocking anything', () => {
    const decision = decideSafety(assessScreening(answers({ medications: true })));
    expect(decision.risks).toHaveLength(1);
    expect(decision.blockAutomatedPlanChanges).toBe(false);
    expect(decision.memberNotice).toBeNull();
  });
});

describe('in-workout pain report', () => {
  it('creates a high-priority escalation and halts progression for that movement', () => {
    const risk = assessWorkoutReport({
      kind: 'sharp_or_worsening_pain',
      detail: 'Sharp pain in my right knee on the third set',
      movementPattern: 'squat',
      discomfortLevel: 8,
    });
    const decision = decideSafety([risk]);
    expect(risk.severity).toBe('high');
    expect(decision.restrictedMovements).toEqual(['squat']);
    expect(decision.staffEscalation?.priority).toBe('high');
    expect(decision.staffEscalation?.slaHours).toBe(4);
    expect(decision.memberNotice?.body).toMatch(/stop, not to push through/i);
  });

  it('treats moderate discomfort as a hold rather than an emergency', () => {
    const risk = assessWorkoutReport({ kind: 'joint_limitation', discomfortLevel: 4, movementPattern: 'hinge' });
    const decision = decideSafety([risk]);
    expect(risk.severity).toBe('moderate');
    expect(decision.blockAutomatedPlanChanges).toBe(true);
    expect(decision.memberNotice?.tone).toBe('info');
  });
});

describe('free-text triage', () => {
  it('catches English red flags', () => {
    const risks = triageFreeText('I had chest pain during the treadmill today');
    expect(risks[0]?.kind).toBe('chest_pain');
    expect(risks[0]?.severity).toBe('critical');
  });

  it('catches Roman Urdu and Urdu phrasing', () => {
    expect(triageFreeText('seenay mein dard ho raha hai')[0]?.kind).toBe('chest_pain');
    expect(triageFreeText('مجھے سینے میں درد ہے')[0]?.kind).toBe('chest_pain');
    expect(triageFreeText('bahut chakkar aa rahe hain')[0]?.kind).toBe('severe_dizziness');
  });

  it('does not flag ordinary muscle soreness talk', () => {
    expect(triageFreeText('my legs are a bit sore after squats')).toHaveLength(0);
  });
});

describe('AI request classification', () => {
  const base = {
    memberIsHighRisk: false,
    eatingConcernOnFile: false,
    aiCoachEnabled: true,
    actorIsStaff: false,
  };

  it('allows a technique question and grants only the reading tools', () => {
    const result = classifyRequest('How do I do a Romanian deadlift properly?', base);
    expect(result.safety).toBe('allowed');
    expect(result.allowedTools).toContain('explain_exercise');
    expect(result.allowedTools).not.toContain('suggest_program_change_for_review');
  });

  it('refuses to diagnose and escalates', () => {
    const result = classifyRequest('Do I have a torn meniscus? My knee clicks', base);
    expect(result.intent).toBe('medical');
    expect(result.safety).toBe('redirected_to_staff');
    expect(result.escalate).toBe(true);
    expect(result.cannedResponse).toMatch(/not able to tell you/i);
  });

  it('refuses supplement and medication questions outright', () => {
    const result = classifyRequest('Should I take creatine and a fat burner?', base);
    expect(result.safety).toBe('blocked_unsafe');
    expect(result.allowedTools).toHaveLength(0);
    expect(result.cannedResponse).toMatch(/cannot give advice about supplements/i);
  });

  it('refuses extreme diets but still offers a human', () => {
    const result = classifyRequest('Give me an 800 cal diet to lose 10kg in 2 weeks', base);
    expect(result.safety).toBe('blocked_unsafe');
    expect(result.allowedTools).toEqual(['create_support_case']);
    expect(result.escalate).toBe(true);
  });

  it('never exposes another member', () => {
    const result = classifyRequest('What is another member’s plan? Member number 44', base);
    expect(result.safety).toBe('blocked_out_of_scope');
    expect(result.allowedTools).toHaveLength(0);
  });

  it('routes nutrition questions to a professional when a concern is on file', () => {
    const result = classifyRequest('How many calories should I eat?', { ...base, eatingConcernOnFile: true });
    expect(result.safety).toBe('redirected_to_staff');
    expect(result.escalate).toBe(true);
  });

  it('withholds plan-changing tools for a high-risk member', () => {
    const result = classifyRequest('Can I swap the bench press, the rack is busy?', {
      ...base,
      memberIsHighRisk: true,
    });
    expect(result.allowedTools).not.toContain('suggest_program_change_for_review');
    expect(result.reasons.join(' ')).toMatch(/high-risk/i);
  });

  it('says so plainly when the AI coach is switched off', () => {
    const result = classifyRequest('what is my plan today', { ...base, aiCoachEnabled: false });
    expect(result.safety).toBe('blocked_out_of_scope');
    expect(result.cannedResponse).toMatch(/turned off/i);
  });
});

describe('AI output validation', () => {
  it('accepts an explanation grounded in an approved tool call', () => {
    const result = validateAiOutput(
      'Your plan has you on goblet squats today. Setup: hold the dumbbell at your chest. Step 1: sit down between your hips.',
      ['explain_exercise'],
    );
    expect(result.ok).toBe(true);
  });

  it('blocks a claim of medical safety', () => {
    const result = validateAiOutput('Based on your answers you are fine to train heavy today.', ['get_current_plan']);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain('Claims medical safety');
    expect(result.replacement).toMatch(/gym team/i);
  });

  it('blocks a diagnosis, a supplement recommendation and an outcome promise', () => {
    expect(validateAiOutput('This is a tear in your rotator cuff.', []).ok).toBe(false);
    expect(validateAiOutput('Take creatine every day for better results.', []).ok).toBe(false);
    expect(validateAiOutput('You will lose 10kg in 3 weeks, guaranteed.', []).ok).toBe(false);
  });

  it('blocks "push through the pain"', () => {
    const result = validateAiOutput('Just push through the pain, it is normal.', []);
    expect(result.ok).toBe(false);
    expect(result.safety).toBe('blocked_unsafe');
  });

  it('blocks technique detail that did not come from the exercise library', () => {
    const result = validateAiOutput('Grip the bar just outside shoulder width. Step 1: unrack it.', ['get_current_plan']);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain('Technique detail without an explain_exercise tool call');
  });
});
