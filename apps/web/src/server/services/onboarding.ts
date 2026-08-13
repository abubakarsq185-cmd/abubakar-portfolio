import 'server-only';
/**
 * Member onboarding.
 *
 * Six steps, each saved as it is completed, so someone can put their phone down
 * at step three on the bus and pick up where they left off. The step is stored
 * on the profile rather than in a cookie for exactly that reason.
 *
 * The health step is the one that matters. Its answers go straight through the
 * deterministic risk engine: a red flag stops the automated plan there and then,
 * raises a case for a human, and the member is told plainly — without being
 * given a diagnosis or a prognosis, neither of which this software is entitled
 * to offer.
 */
import { redirect } from 'next/navigation';
import type { Actor } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant } from '../db/pool';
import { recordAudit } from '../audit';
import { applyScreening } from './safety';
import { assignBestProgram } from './members';

export const ONBOARDING_STEPS = ['welcome', 'goals', 'schedule', 'health', 'preferences', 'plan'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_TITLES: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  goals: 'What you want',
  schedule: 'When you can train',
  health: 'Staying safe',
  preferences: 'How you like to train',
  plan: 'Your plan',
};

/** The step after this one, or null when onboarding is finished. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] ?? null;
}

export interface OnboardingState {
  step: OnboardingStep;
  completed: boolean;
  memberName: string;
  branchId: string;
  primaryGoal: string | null;
  experienceLevel: string | null;
  trainingDaysPerWeek: number | null;
  preferredSessionMinutes: number | null;
  preferredTrainingTime: string | null;
  preferredDays: string[];
  heightCm: number | null;
  startingWeightKg: number | null;
  targetWeightKg: number | null;
  ramadanMode: boolean;
  hasScreening: boolean;
  progressionHoldReason: string | null;
  assignedProgramName: string | null;
  needsHumanPlan: boolean;
  equipmentAtBranch: string[];
}

/**
 * Returns null when the signed-in account has no member profile.
 *
 * A guardian pays for someone else and never has one, so asking them to
 * onboard is meaningless — and throwing here returned a 500 for a role the
 * product supports. Not finding a profile is a fact about who is asking, not
 * an error.
 */
export async function loadOnboarding(actor: Actor): Promise<OnboardingState | null> {
  const session = tenantSessionFor(actor);

  return withTenant(session, async (db) => {
    const { rows } = await db.query<{
      onboarding_step: string;
      onboarding_completed_at: string | null;
      full_name: string;
      branch_id: string;
      primary_goal: string | null;
      experience_level: string | null;
      training_days_per_week: number | null;
      preferred_session_minutes: number | null;
      preferred_training_time: string | null;
      preferred_days: string[];
      height_cm: string | null;
      starting_weight_kg: string | null;
      target_weight_kg: string | null;
      ramadan_mode: boolean;
      progression_hold_reason: string | null;
      has_screening: boolean;
      program_name: string | null;
    }>(
      `select mp.onboarding_step, mp.onboarding_completed_at, u.full_name, mp.branch_id,
              mp.primary_goal::text as primary_goal, mp.experience_level::text as experience_level,
              mp.training_days_per_week, mp.preferred_session_minutes, mp.preferred_training_time,
              mp.preferred_days, mp.height_cm, mp.starting_weight_kg, mp.target_weight_kg,
              mp.ramadan_mode, mp.progression_hold_reason,
              exists (select 1 from health_screenings hs where hs.user_id = mp.user_id) as has_screening,
              (select p.name from program_assignments pa join programs p on p.id = pa.program_id
                where pa.user_id = mp.user_id and pa.state = 'active' limit 1) as program_name
         from member_profiles mp join users u on u.id = mp.user_id
        where mp.user_id = $1`,
      [actor.userId],
    );
    const row = rows[0];
    if (!row) return null;

    const { rows: equipment } = await db.query<{ name: string }>(
      `select e.name from branch_equipment be join equipment e on e.id = be.equipment_id
        where be.branch_id = $1 and be.is_available order by e.name`,
      [row.branch_id],
    );

    // The column is free text and predates this wizard, so anything it does not
    // recognise starts at the beginning rather than crashing. `not_started` is
    // the column default and `complete` is the pre-wizard terminal value.
    const legacy: Record<string, OnboardingStep> = { not_started: 'welcome', complete: 'plan' };
    const stored = row.onboarding_step;
    const step: OnboardingStep = ONBOARDING_STEPS.includes(stored as OnboardingStep)
      ? (stored as OnboardingStep)
      : (legacy[stored] ?? 'welcome');

    return {
      step,
      completed: row.onboarding_completed_at !== null,
      memberName: row.full_name,
      branchId: row.branch_id,
      primaryGoal: row.primary_goal,
      experienceLevel: row.experience_level,
      trainingDaysPerWeek: row.training_days_per_week,
      preferredSessionMinutes: row.preferred_session_minutes,
      preferredTrainingTime: row.preferred_training_time,
      preferredDays: row.preferred_days ?? [],
      heightCm: row.height_cm === null ? null : Number(row.height_cm),
      startingWeightKg: row.starting_weight_kg === null ? null : Number(row.starting_weight_kg),
      targetWeightKg: row.target_weight_kg === null ? null : Number(row.target_weight_kg),
      ramadanMode: row.ramadan_mode,
      hasScreening: row.has_screening,
      progressionHoldReason: row.progression_hold_reason,
      assignedProgramName: row.program_name,
      needsHumanPlan: row.program_name === null && row.onboarding_completed_at !== null,
      equipmentAtBranch: equipment.map((item) => item.name),
    };
  });
}

export interface StepResult {
  ok: boolean;
  message?: string;
  /**
   * Set when the health step raised something a person needs to see. The notice
   * is the risk engine's own wording, carried through unchanged — it is written
   * to be calm and non-diagnostic, and rephrasing it here would risk losing that.
   */
  escalation?: {
    notice: { title: string; body: string; tone: 'info' | 'warning' | 'stop' };
    caseReference: string | null;
    progressionPaused: boolean;
  };
}

export interface GoalsInput {
  primaryGoal: string;
  experienceLevel: string;
  heightCm?: number | null;
  startingWeightKg?: number | null;
  targetWeightKg?: number | null;
}

export async function saveGoals(actor: Actor, input: GoalsInput): Promise<StepResult> {
  if (!input.primaryGoal || !input.experienceLevel) {
    return { ok: false, message: 'Pick a goal and how much training you have done before.' };
  }
  const session = tenantSessionFor(actor);
  await withTenant(session, (db) =>
    db.query(
      `update member_profiles
          set primary_goal = $2::training_goal,
              experience_level = $3::experience_level,
              height_cm = coalesce($4, height_cm),
              starting_weight_kg = coalesce($5, starting_weight_kg),
              target_weight_kg = $6,
              onboarding_step = 'schedule'
        where user_id = $1`,
      [
        actor.userId,
        input.primaryGoal,
        input.experienceLevel,
        input.heightCm ?? null,
        input.startingWeightKg ?? null,
        input.targetWeightKg ?? null,
      ],
    ),
  );
  return { ok: true };
}

export interface ScheduleInput {
  trainingDaysPerWeek: number;
  preferredSessionMinutes: number;
  preferredTrainingTime: string;
  preferredDays: string[];
}

export async function saveSchedule(actor: Actor, input: ScheduleInput): Promise<StepResult> {
  if (input.trainingDaysPerWeek < 1 || input.trainingDaysPerWeek > 7) {
    return { ok: false, message: 'Choose between one and seven days a week.' };
  }
  const session = tenantSessionFor(actor);
  await withTenant(session, (db) =>
    db.query(
      `update member_profiles
          set training_days_per_week = $2,
              preferred_session_minutes = $3,
              preferred_training_time = $4,
              preferred_days = $5,
              onboarding_step = 'health'
        where user_id = $1`,
      [
        actor.userId,
        input.trainingDaysPerWeek,
        input.preferredSessionMinutes,
        input.preferredTrainingTime,
        input.preferredDays,
      ],
    ),
  );
  return { ok: true };
}

export interface HealthInput {
  redFlags: {
    chestPain: boolean;
    fainting: boolean;
    severeDizziness: boolean;
    breathingDifficulty: boolean;
    currentSharpPain: boolean;
    recentSurgery: boolean;
    pregnancyOrPostpartum: boolean;
    doctorAdvisedAgainstExercise: boolean;
    disorderedEatingConcern: boolean;
  };
  conditions: string[];
  painAreas: string[];
  medications: boolean;
  detail?: string;
}

/**
 * Record the screening and act on it.
 *
 * The answers are stored first so the evidence exists regardless of what the
 * engine decides, then the engine decides. Nothing here interprets the answers
 * itself — that is the risk engine's job, and it is deterministic so the same
 * answers always produce the same outcome.
 */
export async function saveHealthScreening(actor: Actor, input: HealthInput): Promise<StepResult> {
  const session = tenantSessionFor(actor);

  const requiresClearance =
    input.redFlags.doctorAdvisedAgainstExercise ||
    input.redFlags.recentSurgery ||
    input.redFlags.pregnancyOrPostpartum;

  await withTenant(session, (db) =>
    db.query(
      `insert into health_screenings
         (organization_id, user_id, questionnaire_code, answers, reported_conditions,
          medications_disclosed, pain_areas, pregnancy_status, surgery_last_12_months, requires_clearance)
       values ($1, $2, 'parq_plus', $3::jsonb, $4, $5, $6, $7, $8, $9)`,
      [
        actor.organizationId,
        actor.userId,
        JSON.stringify({ redFlags: input.redFlags, detail: input.detail ?? null }),
        input.conditions,
        input.medications,
        input.painAreas,
        input.redFlags.pregnancyOrPostpartum ? 'pregnant' : 'not_applicable',
        input.redFlags.recentSurgery,
        requiresClearance,
      ],
    ),
  );

  const escalation = await applyScreening(actor, actor.userId, {
    redFlags: input.redFlags,
    conditions: input.conditions,
    painAreas: input.painAreas,
    medications: input.medications,
    detail: input.detail,
  });

  await withTenant(session, (db) =>
    db.query(`update member_profiles set onboarding_step = 'preferences' where user_id = $1`, [actor.userId]),
  );

  await recordAudit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'create',
    entityType: 'health_screening',
    subjectUserId: actor.userId,
    summary: `${actor.fullName} completed the health screening during onboarding`,
  });

  return {
    ok: true,
    ...(escalation.escalated
      ? {
          escalation: {
            notice: escalation.memberNotice ?? {
              title: 'A member of staff will be in touch',
              body: 'Thanks for telling us. Someone will speak to you before you start training.',
              tone: 'warning' as const,
            },
            caseReference: escalation.caseReference,
            progressionPaused: escalation.progressionPaused,
          },
        }
      : {}),
  };
}

export interface PreferencesInput {
  ramadanMode: boolean;
  trainsAtHome: boolean;
  needsLowImpact: boolean;
}

/**
 * Last step: save the remaining preferences, then match a program.
 *
 * Matching happens here rather than at enrolment because this is the first
 * point at which the member's own answers exist. If the matcher is not
 * confident — missing equipment, an unmet low-impact requirement, an open
 * health hold — it declines and a coach assigns instead. A plan nobody is
 * confident in is worse than waiting a day for one.
 */
export async function completeOnboarding(actor: Actor, input: PreferencesInput): Promise<StepResult> {
  // Only a platform admin has no organization, and a platform admin is not a
  // member going through onboarding.
  const organizationId = actor.organizationId;
  if (!organizationId) {
    return { ok: false, message: 'This account is not a member of a gym.' };
  }
  const session = tenantSessionFor(actor);

  const outcome = await withTenant(session, async (db) => {
    const { rows } = await db.query<{
      branch_id: string;
      primary_goal: string | null;
      experience_level: string | null;
      training_days_per_week: number | null;
      preferred_session_minutes: number | null;
      progression_hold_reason: string | null;
      has_program: boolean;
    }>(
      `update member_profiles
          set ramadan_mode = $2,
              onboarding_step = 'plan',
              onboarding_completed_at = coalesce(onboarding_completed_at, now()),
              lifecycle_stage = case when lifecycle_stage = 'lead' then 'active'::lifecycle_stage else lifecycle_stage end
        where user_id = $1
      returning branch_id, primary_goal::text as primary_goal, experience_level::text as experience_level,
                training_days_per_week, preferred_session_minutes, progression_hold_reason,
                exists (select 1 from program_assignments pa
                         where pa.user_id = member_profiles.user_id and pa.state = 'active') as has_program`,
      [actor.userId, input.ramadanMode],
    );
    const profile = rows[0];
    if (!profile) throw new Error('No member profile found for this account.');
    if (profile.has_program) {
      return { programName: null as string | null, needsHuman: false, alreadyAssigned: true };
    }

    const assignment = await assignBestProgram(db, {
      organizationId,
      branchId: profile.branch_id,
      userId: actor.userId,
      goal: profile.primary_goal ?? 'general_fitness',
      experienceLevel: profile.experience_level ?? 'beginner',
      assignedBy: actor.userId,
      preferences: {
        daysPerWeek: profile.training_days_per_week ?? undefined,
        sessionMinutes: profile.preferred_session_minutes ?? undefined,
        needsLowImpact: input.needsLowImpact,
        ramadanMode: input.ramadanMode,
        trainsAtHome: input.trainsAtHome,
        // An open health hold is precisely when a human should choose the plan.
        requiresHumanReview: profile.progression_hold_reason !== null,
      },
    });
    return { ...assignment, alreadyAssigned: false };
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'program_assign',
    entityType: 'member_profile',
    subjectUserId: actor.userId,
    summary: outcome.alreadyAssigned
      ? `${actor.fullName} finished onboarding; existing plan kept`
      : outcome.needsHuman
        ? `${actor.fullName} finished onboarding; no confident template match, a coach will assign`
        : `${actor.fullName} finished onboarding and was matched to ${outcome.programName}`,
  });

  return { ok: true };
}

/**
 * Send a member who has not finished onboarding to the wizard.
 *
 * Used by the screens that assume a plan exists. Plan, Progress and Support are
 * deliberately left reachable — they degrade to empty states, and locking
 * someone out of Support because they have not filled a form in is exactly the
 * wrong behaviour.
 */
export async function requireOnboarded(actor: Actor): Promise<void> {
  const session = tenantSessionFor(actor);
  const done = await withTenant(session, async (db) => {
    const { rows } = await db.query<{ completed: boolean }>(
      'select onboarding_completed_at is not null as completed from member_profiles where user_id = $1',
      [actor.userId],
    );
    // No profile at all is not an onboarding problem; let the page handle it.
    return rows[0] ? rows[0].completed : true;
  });
  if (!done) redirect('/app/onboarding');
}

/** Let someone revisit an earlier step without losing what they entered. */
export async function goToStep(actor: Actor, step: OnboardingStep): Promise<void> {
  if (!ONBOARDING_STEPS.includes(step)) return;
  const session = tenantSessionFor(actor);
  await withTenant(session, (db) =>
    db.query('update member_profiles set onboarding_step = $2 where user_id = $1', [actor.userId, step]),
  );
}
