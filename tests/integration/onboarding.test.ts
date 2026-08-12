import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { permissionsForRoles, type Actor } from '@gymguide/types';
import { enrolMember } from '../../apps/web/src/server/services/members';
import {
  completeOnboarding,
  loadOnboarding,
  saveGoals,
  saveHealthScreening,
  saveSchedule,
} from '../../apps/web/src/server/services/onboarding';
import { loadNutrition, logMeal } from '../../apps/web/src/server/services/nutrition';
import { closePools } from '../../apps/web/src/server/db/pool';
import { ownerClient } from './helpers';

/**
 * MVP acceptance criteria 2 and 4, from the member's side:
 *
 *   a member completes onboarding, receives a program, and a reported problem
 *   produces a restricted, high-priority escalation that prevents unsafe
 *   progression.
 *
 * The wizard is driven through the real services, so what is asserted is what a
 * member on a phone would actually cause to happen.
 */
describe('member onboarding', () => {
  let owner: Client;
  let deskActor: Actor;
  let organizationId: string;
  let branchId: string;
  let planId: string;

  const createdUserIds: string[] = [];

  const CLEAN_FLAGS = {
    chestPain: false,
    fainting: false,
    severeDizziness: false,
    breathingDifficulty: false,
    currentSharpPain: false,
    recentSurgery: false,
    pregnancyOrPostpartum: false,
    doctorAdvisedAgainstExercise: false,
    disorderedEatingConcern: false,
  };

  /**
   * A brand new member, enrolled the way the front desk does it, then stripped
   * back to the state a fresh app account is really in: no program, onboarding
   * not started. That is what makes the wizard's own matching observable.
   */
  async function freshMember(name: string): Promise<Actor> {
    const suffix = `${Date.now()}${createdUserIds.length}`;
    const result = await enrolMember(deskActor, {
      branchId,
      fullName: name,
      email: `onboarding.${suffix}@example.com`,
      phone: `+92321${String(4500000 + createdUserIds.length * 7 + (Date.now() % 1000)).slice(0, 7)}`,
      gender: 'female',
      locale: 'en',
      primaryGoal: 'general_fitness',
      experienceLevel: 'beginner',
      membershipPlanId: planId,
      membershipStartsOn: new Date().toISOString().slice(0, 10),
      chargeJoiningFee: false,
      emergencyContact: { fullName: 'Next Of Kin', relationship: 'Spouse', phone: '+923214560000' },
      consents: {
        terms: true,
        privacy: true,
        healthData: true,
        progressPhotos: false,
        aiCoaching: true,
        marketingEmail: false,
        marketingSms: false,
        marketingWhatsapp: false,
      },
      waiverSigned: true,
      waiverSignatureName: name,
      sendAppInvite: true,
    });
    if (!result.ok || !result.userId) throw new Error(result.error ?? 'enrolment failed');
    const userId = result.userId;
    createdUserIds.push(userId);

    await owner.query(`delete from program_assignments where user_id = $1`, [userId]);
    await owner.query(
      `update member_profiles
          set onboarding_step = 'not_started', onboarding_completed_at = null,
              training_days_per_week = null, preferred_session_minutes = null
        where user_id = $1`,
      [userId],
    );

    return {
      userId,
      organizationId,
      role: 'member',
      roles: ['member'],
      permissions: permissionsForRoles(['member']),
      branchIds: [],
      isPlatformAdmin: false,
      fullName: name,
      email: `onboarding.${suffix}@example.com`,
    };
  }

  beforeAll(async () => {
    owner = await ownerClient();

    const { rows: staff } = await owner.query<{ id: string; organization_id: string; branch_id: string }>(
      `select u.id, u.organization_id, sa.branch_id
         from users u join staff_assignments sa on sa.user_id = u.id
        where u.email = 'frontdesk@apexfitness.pk'`,
    );
    organizationId = staff[0]!.organization_id;
    branchId = staff[0]!.branch_id;

    const { rows: plans } = await owner.query<{ id: string }>(
      `select mp.id from membership_plans mp join organizations o on o.id = mp.organization_id
        where o.slug = 'apex-fitness-lahore' and mp.code = 'gold_monthly'`,
    );
    planId = plans[0]!.id;

    deskActor = {
      userId: staff[0]!.id,
      organizationId,
      role: 'front_desk',
      roles: ['front_desk'],
      permissions: permissionsForRoles(['front_desk']),
      branchIds: [branchId],
      isPlatformAdmin: false,
      fullName: 'Zoya Ahmed',
      email: 'frontdesk@apexfitness.pk',
    };
  }, 30_000);

  afterAll(async () => {
    if (createdUserIds.length) {
      await owner.query('delete from users where id = any($1::uuid[])', [createdUserIds]);
    }
    await closePools();
    await owner?.end();
  });

  it('starts a new member at the beginning, whatever the column says', async () => {
    const member = await freshMember('Onboarding Start');
    const state = await loadOnboarding(member);
    expect(state.step).toBe('welcome');
    expect(state.completed).toBe(false);
  });

  it('saves each step and advances, so a half-finished form is not lost', async () => {
    const member = await freshMember('Onboarding Resume');

    expect((await saveGoals(member, { primaryGoal: 'fat_loss', experienceLevel: 'beginner', heightCm: 165, startingWeightKg: 72 })).ok).toBe(true);
    let state = await loadOnboarding(member);
    expect(state.step).toBe('schedule');
    expect(state.primaryGoal).toBe('fat_loss');
    expect(state.heightCm).toBe(165);

    expect(
      (
        await saveSchedule(member, {
          trainingDaysPerWeek: 4,
          preferredSessionMinutes: 45,
          preferredTrainingTime: 'evening',
          preferredDays: ['mon', 'wed', 'fri', 'sat'],
        })
      ).ok,
    ).toBe(true);
    state = await loadOnboarding(member);
    expect(state.step).toBe('health');
    expect(state.trainingDaysPerWeek).toBe(4);
    expect(state.preferredDays).toEqual(['mon', 'wed', 'fri', 'sat']);
  });

  it('rejects an impossible schedule rather than storing it', async () => {
    const member = await freshMember('Onboarding Bad Schedule');
    const result = await saveSchedule(member, {
      trainingDaysPerWeek: 9,
      preferredSessionMinutes: 45,
      preferredTrainingTime: 'evening',
      preferredDays: [],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/one and seven/i);
  });

  it('records a clean screening without holding anyone back', async () => {
    const member = await freshMember('Onboarding Healthy');
    const result = await saveHealthScreening(member, {
      redFlags: CLEAN_FLAGS,
      conditions: [],
      painAreas: [],
      medications: false,
    });
    expect(result.ok).toBe(true);
    expect(result.escalation).toBeUndefined();

    const state = await loadOnboarding(member);
    expect(state.hasScreening).toBe(true);
    expect(state.progressionHoldReason).toBeNull();
    expect(state.step).toBe('preferences');
  });

  it('escalates chest pain, pauses progression and raises a case a human owns', async () => {
    const member = await freshMember('Onboarding Chest Pain');
    const result = await saveHealthScreening(member, {
      redFlags: { ...CLEAN_FLAGS, chestPain: true },
      conditions: [],
      painAreas: [],
      medications: false,
      detail: 'Tightness when I climb stairs.',
    });

    expect(result.ok).toBe(true);
    expect(result.escalation).toBeDefined();
    expect(result.escalation!.progressionPaused).toBe(true);
    expect(result.escalation!.caseReference).toBeTruthy();
    // A calm, non-diagnostic notice — it must not tell anyone what is wrong.
    expect(result.escalation!.notice.body).not.toMatch(/heart attack|angina|diagnos/i);

    const { rows: flags } = await owner.query<{
      kind: string;
      severity: string;
      blocks_progression: boolean;
      requires_human_review: boolean;
      support_case_id: string | null;
    }>(
      `select kind::text as kind, severity::text as severity, blocks_progression,
              requires_human_review, support_case_id
         from risk_flags where user_id = $1 and resolved_at is null`,
      [member.userId],
    );
    expect(flags.some((flag) => flag.kind === 'chest_pain')).toBe(true);
    const chestPain = flags.find((flag) => flag.kind === 'chest_pain')!;
    expect(chestPain.severity).toBe('critical');
    expect(chestPain.blocks_progression).toBe(true);
    expect(chestPain.requires_human_review).toBe(true);
    expect(chestPain.support_case_id).toBeTruthy();

    const { rows: profile } = await owner.query<{ progression_hold_reason: string | null }>(
      'select progression_hold_reason from member_profiles where user_id = $1',
      [member.userId],
    );
    expect(profile[0]!.progression_hold_reason).toBeTruthy();

    const { rows: supportCase } = await owner.query<{ priority: string; state: string }>(
      `select priority::text as priority, state::text as state from support_cases
        where id = $1`,
      [chestPain.support_case_id],
    );
    expect(['urgent', 'high']).toContain(supportCase[0]!.priority);
    expect(supportCase[0]!.state).not.toBe('resolved');
  });

  it('keeps painful movements out of the plan without stopping training altogether', async () => {
    const member = await freshMember('Onboarding Sore Knee');
    const result = await saveHealthScreening(member, {
      redFlags: CLEAN_FLAGS,
      conditions: [],
      painAreas: ['knee'],
      medications: false,
    });
    expect(result.ok).toBe(true);

    const { rows } = await owner.query<{ affected_movements: string[]; blocks_progression: boolean }>(
      `select affected_movements, blocks_progression from risk_flags
        where user_id = $1 and kind = 'joint_limitation' and resolved_at is null`,
      [member.userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.affected_movements).toContain('squat');
    // Sore knees restrict what you do; they do not stop you progressing at all.
    expect(rows[0]!.blocks_progression).toBe(false);
  });

  it('finishes onboarding by matching an approved template to the member’s own answers', async () => {
    const member = await freshMember('Onboarding Complete');
    await saveGoals(member, { primaryGoal: 'muscle_gain', experienceLevel: 'beginner' });
    await saveSchedule(member, {
      trainingDaysPerWeek: 3,
      preferredSessionMinutes: 45,
      preferredTrainingTime: 'evening',
      preferredDays: ['mon', 'wed', 'fri'],
    });
    await saveHealthScreening(member, {
      redFlags: CLEAN_FLAGS,
      conditions: [],
      painAreas: [],
      medications: false,
    });

    const result = await completeOnboarding(member, {
      ramadanMode: false,
      trainsAtHome: false,
      needsLowImpact: false,
    });
    expect(result.ok, result.message).toBe(true);

    const state = await loadOnboarding(member);
    expect(state.completed).toBe(true);
    expect(state.step).toBe('plan');
    expect(state.assignedProgramName).toBeTruthy();

    const { rows } = await owner.query<{ assignment_source: string; state: string; lifecycle_stage: string }>(
      `select pa.assignment_source, pa.state, mp.lifecycle_stage
         from program_assignments pa join member_profiles mp on mp.user_id = pa.user_id
        where pa.user_id = $1 and pa.state = 'active'`,
      [member.userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.assignment_source).toBe('engine');
    expect(rows[0]!.lifecycle_stage).toBe('active');
  });

  it('hands the plan to a coach instead of guessing when a health hold is open', async () => {
    const member = await freshMember('Onboarding Needs Coach');
    await saveGoals(member, { primaryGoal: 'strength', experienceLevel: 'beginner' });
    await saveSchedule(member, {
      trainingDaysPerWeek: 3,
      preferredSessionMinutes: 45,
      preferredTrainingTime: 'morning',
      preferredDays: ['tue', 'thu', 'sat'],
    });
    await saveHealthScreening(member, {
      redFlags: { ...CLEAN_FLAGS, doctorAdvisedAgainstExercise: true },
      conditions: ['heart_condition'],
      painAreas: [],
      medications: true,
    });

    const result = await completeOnboarding(member, {
      ramadanMode: false,
      trainsAtHome: false,
      needsLowImpact: true,
    });
    expect(result.ok, result.message).toBe(true);

    const state = await loadOnboarding(member);
    expect(state.completed).toBe(true);
    expect(state.progressionHoldReason).toBeTruthy();
    // No template was assigned: a plan nobody is confident in is worse than none.
    expect(state.assignedProgramName).toBeNull();
    expect(state.needsHumanPlan).toBe(true);
  });
});

describe('member nutrition', () => {
  let owner: Client;
  let member: Actor;
  let today: string;
  const loggedIds: string[] = [];

  beforeAll(async () => {
    owner = await ownerClient();
    const { rows } = await owner.query<{ id: string; organization_id: string; full_name: string }>(
      `select id, organization_id, full_name from users where email = 'ayesha.khan@example.com'`,
    );
    member = {
      userId: rows[0]!.id,
      organizationId: rows[0]!.organization_id,
      role: 'member',
      roles: ['member'],
      permissions: permissionsForRoles(['member']),
      branchIds: [],
      isPlatformAdmin: false,
      fullName: rows[0]!.full_name,
      email: 'ayesha.khan@example.com',
    };
    today = new Date().toISOString().slice(0, 10);
  }, 30_000);

  beforeEach(async () => {
    await owner.query('delete from meal_logs where user_id = $1 and logged_on = $2::date', [member.userId, today]);
  });

  afterAll(async () => {
    await owner.query('delete from meal_logs where user_id = $1 and logged_on = $2::date', [member.userId, today]);
    await closePools();
    await owner?.end();
  });

  it('always offers portion guidance, targets or no targets', async () => {
    const page = await loadNutrition(member, today);
    expect(page.plate.proteinPalms).toBeGreaterThan(0);
    expect(page.plate.explanation.length).toBeGreaterThan(3);
    expect(page.water.targetMl).toBeGreaterThan(0);
  });

  it('lists local staples before anything else', async () => {
    const page = await loadNutrition(member, today);
    expect(page.commonFoods.length).toBeGreaterThan(5);
    expect(page.commonFoods[0]!.isLocalStaple).toBe(true);
  });

  it('takes the numbers from the food library, not from the member', async () => {
    const page = await loadNutrition(member, today);
    const food = page.commonFoods[0]!;

    expect((await logMeal(member, { day: today, slot: 'lunch', foodItemId: food.id, servings: 2 })).ok).toBe(true);

    const { rows } = await owner.query<{ calories_kcal: string; protein_g: string; quantity_servings: string }>(
      `select calories_kcal, protein_g, quantity_servings from meal_logs
        where user_id = $1 and logged_on = $2::date`,
      [member.userId, today],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.quantity_servings)).toBe(2);
    expect(Number(rows[0]!.calories_kcal)).toBeCloseTo(food.caloriesKcal * 2, 1);
    expect(Number(rows[0]!.protein_g)).toBeCloseTo(food.proteinG * 2, 1);
  });

  it('records a described meal without inventing calories for it', async () => {
    expect(
      (await logMeal(member, { day: today, slot: 'dinner', freeText: 'Two roti and chicken salan', servings: 1 })).ok,
    ).toBe(true);

    const { rows } = await owner.query<{ calories_kcal: string | null; free_text: string }>(
      `select calories_kcal, free_text from meal_logs where user_id = $1 and logged_on = $2::date`,
      [member.userId, today],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.calories_kcal).toBeNull();
    expect(rows[0]!.free_text).toMatch(/roti/i);

    const page = await loadNutrition(member, today);
    expect(page.meals).toHaveLength(1);
    expect(page.meals[0]!.caloriesKcal).toBeNull();
  });

  it('refuses an empty or absurd entry', async () => {
    expect((await logMeal(member, { day: today, slot: 'lunch', servings: 1 })).ok).toBe(false);
    expect((await logMeal(member, { day: today, slot: 'lunch', freeText: 'Rice', servings: 0 })).ok).toBe(false);
    expect((await logMeal(member, { day: today, slot: 'lunch', freeText: 'Rice', servings: 500 })).ok).toBe(false);

    const { rows } = await owner.query<{ count: string }>(
      'select count(*) as count from meal_logs where user_id = $1 and logged_on = $2::date',
      [member.userId, today],
    );
    expect(Number(rows[0]!.count)).toBe(0);
  });

  it('never tells someone to eat less after a heavy day', async () => {
    const page = await loadNutrition(member, today);
    const food = page.commonFoods[0]!;
    await logMeal(member, { day: today, slot: 'lunch', foodItemId: food.id, servings: 20 });

    const after = await loadNutrition(member, today);
    if (after.targets?.caloriesKcal) {
      expect(after.band.band).toBe('well_over');
      expect(after.band.message).not.toMatch(/skip|fast|burn it off|make up for/i);
    }
  });

  it('keeps one member’s food diary out of another’s', async () => {
    const page = await loadNutrition(member, today);
    await logMeal(member, { day: today, slot: 'lunch', foodItemId: page.commonFoods[0]!.id, servings: 1 });

    const { rows } = await owner.query<{ id: string; organization_id: string; full_name: string }>(
      `select id, organization_id, full_name from users where email = 'bilal.ahmed@example.com'`,
    );
    const other: Actor = {
      userId: rows[0]!.id,
      organizationId: rows[0]!.organization_id,
      role: 'member',
      roles: ['member'],
      permissions: permissionsForRoles(['member']),
      branchIds: [],
      isPlatformAdmin: false,
      fullName: rows[0]!.full_name,
      email: 'bilal.ahmed@example.com',
    };

    const otherPage = await loadNutrition(other, today);
    expect(otherPage.meals).toHaveLength(0);
  });
});
