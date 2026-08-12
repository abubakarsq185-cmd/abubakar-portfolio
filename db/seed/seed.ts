/**
 * Demo seed: "Apex Fitness Lahore".
 *
 * Produces a complete, believable tenant — two branches, every staff role,
 * sixteen members at different stages, twelve weeks of training history,
 * money that reconciles against the ledger, classes, automations, escalations
 * and support cases.
 *
 * The seed is deterministic: ids come from uuidFor() and all "randomness" runs
 * through a fixed-seed PRNG, so re-running produces the same database and
 * documentation can point at a specific member.
 *
 *   pnpm db:seed
 */
import { Client } from 'pg';
import { loadEnv } from '../scripts/env.js';
import { hashPassword, generateToken, hashToken } from '../../apps/web/src/server/auth/password.js';
import { EQUIPMENT, EXERCISES, SUBSTITUTIONS } from './data/exercises.js';
import { PROGRAMS, WORKOUTS, type SeedWorkout } from './data/programs.js';
import { FOODS, FOOD_SWAPS, RECIPES } from './data/nutrition.js';
import { seedOperations } from './operations.js';
import {
  MEMBERS,
  PLANS,
  STAFF,
  goalHeadline,
  targetWeightFor,
  type MemberSpec,
} from './data/people.js';
import {
  addDays,
  atTime,
  chance,
  createRng,
  insert,
  insertMany,
  intBetween,
  isoDate,
  moneyPkr,
  pick,
  step,
  uuidFor,
  type Db,
} from './lib.js';

const TODAY = new Date('2026-08-11T09:00:00.000Z');
const ORG_SLUG = 'apex-fitness-lahore';

/**
 * A fixed base32 TOTP secret for the demo staff accounts.
 *
 * Present so `mfa_enabled` can be switched on for a demo without inventing an
 * enrolment flow, and so the account's stored state is truthful either way. It
 * is deliberately a published constant: it protects nothing in a seeded demo,
 * and a real deployment enrols per-user secrets through an authenticator app.
 */
const DEMO_MFA_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

// ---------------------------------------------------------------------------

export async function seed(): Promise<void> {
  const env = loadEnv();
  const db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();

  const rng = createRng(20260811);
  const demoPasswordHash = await hashPassword(env.SEED_DEMO_PASSWORD);

  try {
    await db.query('begin');

    step('clearing previous demo data');
    await db.query('delete from organizations where slug = $1', [ORG_SLUG]);
    await db.query('delete from users where organization_id is null and email = $1', ['support@gymguide.app']);
    await db.query('delete from programs where organization_id is null');
    await db.query('delete from workouts where organization_id is null');
    await db.query('delete from exercises where organization_id is null');
    await db.query('delete from equipment where organization_id is null');
    await db.query('delete from food_items where organization_id is null');
    await db.query('delete from recipes where organization_id is null');
    await db.query('delete from subscription_plans');
    await db.query('delete from notification_templates where organization_id is null');

    const ids = await seedPlatform(db, demoPasswordHash);
    const org = await seedOrganization(db, ids, demoPasswordHash);
    await seedOperations(db, ids, org, rng);

    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    await db.end();
  }

  console.log('\nSeed complete — "Apex Fitness Lahore" is ready.');
  console.log(`Demo password for every account: ${env.SEED_DEMO_PASSWORD}`);
  console.log('Sign in at http://localhost:3000/sign-in — see README.md for the account list.\n');
}

export interface PlatformIds {
  platformAdminId: string;
  exerciseIds: Map<string, string>;
  equipmentIds: Map<string, string>;
  workoutIds: Map<string, string>;
  workoutItemIds: Map<string, string>;
  programIds: Map<string, string>;
  programVersionIds: Map<string, string>;
  programDayIds: Map<string, string[]>;
  foodIds: Map<string, string>;
  recipeIds: Map<string, string>;
  planIds: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Platform level content
// ---------------------------------------------------------------------------

async function seedPlatform(db: Db, passwordHash: string): Promise<PlatformIds> {
  step('platform: SaaS plans, support admin, content library');

  const platformAdminId = uuidFor('user:platform-support');
  await insert(db, 'users', {
    id: platformAdminId,
    organization_id: null,
    email: 'support@gymguide.app',
    full_name: 'Nadia Kamal',
    password_hash: passwordHash,
    status: 'active',
    is_platform_admin: true,
    // A real secret, so the account's state is internally consistent and MFA is
    // provably wired rather than merely claimed. Left switched off because the
    // demo tenant has to be reachable without an authenticator app — see the
    // README for how to turn it on.
    mfa_enabled: false,
    mfa_secret: DEMO_MFA_SECRET,
    mfa_enrolled_at: null,
    timezone: 'Asia/Karachi',
  });
  await db.query(
    `insert into user_roles (id, user_id, role_id, organization_id)
     select $1, $2, r.id, null from roles r where r.code = 'platform_super_admin'`,
    [uuidFor('role:platform-support'), platformAdminId],
  );

  // --- GymGuide subscription plans (platform → gym) -------------------------
  const saasPlans = [
    {
      code: 'starter', name: 'Starter', tagline: 'One branch, everything a growing gym needs.',
      monthly: 24_000, annual: 240_000, branches: 1, extraBranch: 12_000, members: 250, extraMember: 40,
      seats: 5, extraSeat: 1_500, messaging: 1_000, overage: 120, whiteLabel: false, analytics: false, api: false, priority: false, sort: 1,
    },
    {
      code: 'growth', name: 'Growth', tagline: 'Multi-branch operations with advanced analytics.',
      monthly: 55_000, annual: 550_000, branches: 3, extraBranch: 10_000, members: 800, extraMember: 30,
      seats: 15, extraSeat: 1_200, messaging: 5_000, overage: 100, whiteLabel: false, analytics: true, api: true, priority: true, sort: 2,
    },
    {
      code: 'enterprise', name: 'Enterprise / White Label', tagline: 'Your brand, your app, unlimited scale.',
      monthly: 145_000, annual: 1_450_000, branches: 10, extraBranch: 8_000, members: 5_000, extraMember: 20,
      seats: 60, extraSeat: 900, messaging: 25_000, overage: 80, whiteLabel: true, analytics: true, api: true, priority: true, sort: 3,
    },
  ];

  for (const plan of saasPlans) {
    await insert(db, 'subscription_plans', {
      id: uuidFor(`saas-plan:${plan.code}`),
      code: plan.code,
      name: plan.name,
      tagline: plan.tagline,
      currency: 'PKR',
      monthly_price_minor: moneyPkr(plan.monthly),
      annual_price_minor: moneyPkr(plan.annual),
      included_branches: plan.branches,
      extra_branch_minor: moneyPkr(plan.extraBranch),
      included_members: plan.members,
      extra_member_minor: moneyPkr(plan.extraMember),
      included_staff_seats: plan.seats,
      extra_staff_seat_minor: moneyPkr(plan.extraSeat),
      messaging_included: plan.messaging,
      messaging_overage_minor: moneyPkr(plan.overage) / 100,
      white_label: plan.whiteLabel,
      advanced_analytics: plan.analytics,
      api_access: plan.api,
      priority_support: plan.priority,
      sort_order: plan.sort,
    });
  }

  // --- Equipment catalogue --------------------------------------------------
  const equipmentIds = new Map<string, string>();
  for (const item of EQUIPMENT) {
    const id = uuidFor(`equipment:${item.code}`);
    equipmentIds.set(item.code, id);
    await insert(db, 'equipment', {
      id,
      organization_id: null,
      code: item.code,
      name: item.name,
      category: item.category,
      description: item.description,
    });
  }
  // Bodyweight is a pseudo-equipment so workout items can require "nothing".
  const bodyweightId = uuidFor('equipment:bodyweight');
  equipmentIds.set('bodyweight', bodyweightId);
  await insert(db, 'equipment', {
    id: bodyweightId, organization_id: null, code: 'bodyweight', name: 'Bodyweight only',
    category: 'bodyweight', description: 'No equipment required',
  });

  // --- Exercise library -----------------------------------------------------
  const exerciseIds = new Map<string, string>();
  for (const exercise of EXERCISES) {
    const id = uuidFor(`exercise:${exercise.code}`);
    exerciseIds.set(exercise.code, id);
    await insert(db, 'exercises', {
      id,
      organization_id: null,
      code: exercise.code,
      name: exercise.name,
      name_ur: exercise.nameUr ?? null,
      name_ur_rm: exercise.nameUrRm ?? null,
      movement_pattern: exercise.movementPattern,
      primary_muscles: exercise.primaryMuscles,
      secondary_muscles: exercise.secondaryMuscles,
      required_equipment_codes: exercise.requiredEquipmentCodes,
      difficulty: exercise.difficulty,
      is_unilateral: exercise.isUnilateral ?? false,
      is_compound: exercise.isCompound ?? false,
      is_low_impact: exercise.isLowImpact ?? false,
      setup_instructions: exercise.setupInstructions,
      execution_steps: exercise.executionSteps,
      form_cues: exercise.formCues,
      common_mistakes: exercise.commonMistakes,
      safety_notes: exercise.safetyNotes,
      breathing_cue: exercise.breathingCue ?? null,
      tempo_default: exercise.tempoDefault ?? null,
      contraindications: exercise.contraindications ?? [],
      default_rest_seconds: exercise.defaultRestSeconds,
      load_step_kg: exercise.loadStepKg,
      publish_state: 'published',
      approved_at: TODAY.toISOString(),
    });
    await insert(db, 'exercise_media', {
      id: uuidFor(`media:${exercise.code}`),
      organization_id: null,
      exercise_id: id,
      kind: 'animation',
      // Media is served through a signed-URL endpoint; the seed registers the
      // key rather than shipping binaries into the repository.
      storage_key: `library/exercises/${exercise.code}.mp4`,
      mime_type: 'video/mp4',
      duration_seconds: 12,
      width: 1080,
      height: 1080,
      is_primary: true,
      caption: `${exercise.name} — technique demonstration`,
    });
  }

  for (const sub of SUBSTITUTIONS) {
    const from = exerciseIds.get(sub.from);
    const to = exerciseIds.get(sub.to);
    if (!from || !to) continue;
    await insert(db, 'exercise_substitutions', {
      id: uuidFor(`sub:${sub.from}:${sub.to}:${sub.reason}`),
      organization_id: null,
      exercise_id: from,
      alternative_exercise_id: to,
      reason: sub.reason,
      preference_rank: sub.rank,
      notes: sub.notes ?? null,
    });
  }

  // --- Workouts -------------------------------------------------------------
  const workoutIds = new Map<string, string>();
  const workoutItemIds = new Map<string, string>();

  for (const workout of WORKOUTS) {
    const workoutId = uuidFor(`workout:${workout.code}`);
    workoutIds.set(workout.code, workoutId);
    await insert(db, 'workouts', {
      id: workoutId,
      organization_id: null,
      code: workout.code,
      name: workout.name,
      focus: workout.focus,
      intent: intentForWorkout(workout),
      estimated_minutes: workout.estimatedMinutes,
      difficulty: workout.difficulty,
      effort_scale: workout.effortScale,
      member_intro: workout.memberIntro,
      coach_notes: workout.coachNotes ?? null,
      publish_state: 'published',
    });

    let blockPosition = 1;
    for (const block of workout.blocks) {
      const blockId = uuidFor(`block:${workout.code}:${blockPosition}`);
      await insert(db, 'workout_blocks', {
        id: blockId,
        organization_id: null,
        workout_id: workoutId,
        kind: block.kind,
        label: block.label,
        position: blockPosition,
        rounds: block.rounds ?? 1,
        rest_between_rounds_seconds: 60,
        instructions: block.instructions ?? null,
      });

      let itemPosition = 1;
      for (const item of block.items) {
        const exerciseId = exerciseIds.get(item.exercise);
        if (!exerciseId) throw new Error(`Unknown exercise "${item.exercise}" in workout ${workout.code}`);
        const itemId = uuidFor(`item:${workout.code}:${blockPosition}:${itemPosition}`);
        workoutItemIds.set(`${workout.code}:${item.exercise}:${blockPosition}:${itemPosition}`, itemId);
        await insert(db, 'workout_items', {
          id: itemId,
          organization_id: null,
          workout_block_id: blockId,
          exercise_id: exerciseId,
          position: itemPosition,
          target_sets: item.sets,
          target_reps_min: item.repsMin ?? null,
          target_reps_max: item.repsMax ?? null,
          target_seconds: item.seconds ?? null,
          target_rpe: item.rpe ?? null,
          tempo: item.tempo ?? null,
          rest_seconds: item.restSeconds ?? 90,
          load_guidance: item.loadGuidance ?? null,
          starting_load_kg: item.startingLoadKg ?? null,
          allow_substitution: item.allowSubstitution ?? true,
          member_note: item.memberNote ?? null,
        });
        itemPosition += 1;
      }
      blockPosition += 1;
    }
  }

  // --- Programs -------------------------------------------------------------
  const programIds = new Map<string, string>();
  const programVersionIds = new Map<string, string>();
  const programDayIds = new Map<string, string[]>();

  for (const program of PROGRAMS) {
    const programId = uuidFor(`program:${program.code}`);
    programIds.set(program.code, programId);
    await insert(db, 'programs', {
      id: programId,
      organization_id: null,
      scope: 'platform',
      code: program.code,
      name: program.name,
      summary: program.summary,
      intent: program.intent,
      goal: program.goal,
      experience_level: program.experienceLevel,
      days_per_week: program.daysPerWeek,
      session_minutes: program.sessionMinutes,
      total_weeks: program.totalWeeks,
      requires_equipment_codes: program.requiresEquipmentCodes,
      low_impact: program.lowImpact ?? false,
      ramadan_friendly: program.ramadanFriendly ?? false,
      contraindications: program.contraindications ?? [],
      publish_state: 'published',
      approved_at: TODAY.toISOString(),
    });

    const versionId = uuidFor(`program-version:${program.code}:1`);
    programVersionIds.set(program.code, versionId);
    await insert(db, 'program_versions', {
      id: versionId,
      organization_id: null,
      program_id: programId,
      version: 1,
      changelog: 'Initial published version',
      publish_state: 'published',
      published_at: TODAY.toISOString(),
    });

    const dayIds: string[] = [];
    let phasePosition = 1;
    for (const phase of program.phases) {
      const phaseId = uuidFor(`phase:${program.code}:${phasePosition}`);
      await insert(db, 'program_phases', {
        id: phaseId,
        organization_id: null,
        program_version_id: versionId,
        position: phasePosition,
        name: phase.name,
        focus: phase.focus,
        weeks: phase.weeks,
        progression_rule: phase.progressionRule,
        deload_at_end: phase.deloadAtEnd ?? false,
        member_summary: phase.memberSummary,
      });

      for (let week = 1; week <= phase.weeks; week += 1) {
        for (let day = 1; day <= 7; day += 1) {
          const workoutCode = phase.days[day] ?? null;
          const dayId = uuidFor(`day:${program.code}:${phasePosition}:${week}:${day}`);
          await insert(db, 'program_days', {
            id: dayId,
            organization_id: null,
            program_phase_id: phaseId,
            week_number: week,
            day_number: day,
            workout_id: workoutCode ? workoutIds.get(workoutCode) : null,
            is_rest_day: !workoutCode,
            label: workoutCode ? WORKOUTS.find((w) => w.code === workoutCode)?.name : 'Rest day',
          });
          if (workoutCode) dayIds.push(dayId);
        }
      }
      phasePosition += 1;
    }
    programDayIds.set(program.code, dayIds);
  }

  // --- Nutrition library ----------------------------------------------------
  const foodIds = new Map<string, string>();
  for (const food of FOODS) {
    const id = uuidFor(`food:${food.code}`);
    foodIds.set(food.code, id);
    await insert(db, 'food_items', {
      id,
      organization_id: null,
      code: food.code,
      name: food.name,
      name_ur: food.nameUr ?? null,
      name_ur_rm: food.nameUrRm ?? null,
      category: food.category,
      serving_label: food.servingLabel,
      serving_grams: food.servingGrams,
      calories_kcal: food.calories,
      protein_g: food.protein,
      carbs_g: food.carbs,
      fat_g: food.fat,
      fibre_g: food.fibre ?? 0,
      is_halal: true,
      is_vegetarian: food.isVegetarian ?? false,
      is_local_staple: food.isLocalStaple ?? false,
      typical_cost_band: food.costBand ?? 'medium',
      allergens: food.allergens ?? [],
    });
  }
  for (const swap of FOOD_SWAPS) {
    const from = foodIds.get(swap.from);
    const to = foodIds.get(swap.to);
    if (!from || !to) continue;
    await insert(db, 'food_substitutions', {
      id: uuidFor(`food-swap:${swap.from}:${swap.to}`),
      organization_id: null,
      food_item_id: from,
      alternative_food_item_id: to,
      reason: swap.reason,
      note: swap.note,
    });
  }

  const recipeIds = new Map<string, string>();
  for (const recipe of RECIPES) {
    const id = uuidFor(`recipe:${recipe.code}`);
    recipeIds.set(recipe.code, id);
    const totals = recipe.items.reduce(
      (acc, item) => {
        const food = FOODS.find((f) => f.code === item.food);
        if (!food) return acc;
        return {
          calories: acc.calories + food.calories * item.servings,
          protein: acc.protein + food.protein * item.servings,
          carbs: acc.carbs + food.carbs * item.servings,
          fat: acc.fat + food.fat * item.servings,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    await insert(db, 'recipes', {
      id,
      organization_id: null,
      code: recipe.code,
      name: recipe.name,
      name_ur: recipe.nameUr ?? null,
      description: recipe.description,
      servings: recipe.servings,
      prep_minutes: recipe.prepMinutes,
      cook_minutes: recipe.cookMinutes,
      method_steps: recipe.methodSteps,
      meal_slot: recipe.mealSlot,
      is_halal: true,
      is_vegetarian: recipe.isVegetarian ?? false,
      cost_band: recipe.costBand,
      visibility: 'platform',
      calories_kcal: Math.round(totals.calories),
      protein_g: Math.round(totals.protein),
      carbs_g: Math.round(totals.carbs),
      fat_g: Math.round(totals.fat),
    });
    let position = 0;
    for (const item of recipe.items) {
      const foodId = foodIds.get(item.food);
      if (!foodId) continue;
      await insert(db, 'recipe_items', {
        id: uuidFor(`recipe-item:${recipe.code}:${item.food}`),
        organization_id: null,
        recipe_id: id,
        food_item_id: foodId,
        quantity_servings: item.servings,
        position: position += 1,
      });
    }
  }

  // --- Notification templates ----------------------------------------------
  const templates = [
    { key: 'welcome_member', channel: 'in_app', category: 'operational', subject: 'Welcome to {{gym_name}}', body: 'Hi {{first_name}} — welcome to {{gym_name}}. Your plan is ready in the app. Tap below to see what you are doing on your first session.', cta: 'See my first workout', path: '/app' },
    { key: 'onboarding_incomplete', channel: 'push', category: 'operational', subject: 'Two minutes to finish setting up', body: '{{first_name}}, your coach needs a couple more answers before your plan is ready. It takes about two minutes.', cta: 'Finish setup', path: '/app/onboarding' },
    { key: 'workout_missed', channel: 'push', category: 'coaching', subject: 'Yesterday’s session is still there', body: 'No guilt, {{first_name}} — your session from yesterday is still waiting. Even 20 minutes counts.', cta: 'Start now', path: '/app/train' },
    { key: 'inactive_7_days', channel: 'push', category: 'coaching', subject: 'We miss you at {{gym_name}}', body: 'It has been a week, {{first_name}}. Would a shorter two-day plan help? Your coach can set it up today.', cta: 'Talk to my coach', path: '/app/support' },
    { key: 'payment_due_today', channel: 'in_app', category: 'billing', subject: 'Membership renews today', body: 'Your {{plan_name}} renews today — {{amount}}. You can pay at the front desk or by bank transfer.', cta: 'View invoice', path: '/app/billing' },
    { key: 'payment_missed_gentle', channel: 'push', category: 'billing', subject: 'Payment reminder', body: 'Hi {{first_name}}, we could not collect {{amount}} for your membership. No rush — you can settle it at the desk any time this week.', cta: 'View invoice', path: '/app/billing' },
    { key: 'payment_overdue_week', channel: 'email', category: 'billing', subject: 'Your membership payment is a week overdue', body: 'Hi {{first_name}},\n\nYour {{plan_name}} payment of {{amount}} is now seven days overdue. If something has changed, please talk to us — we would rather adjust your plan than lose you.\n\n{{gym_name}}', cta: 'Settle now', path: '/app/billing' },
    { key: 'membership_expiring', channel: 'in_app', category: 'billing', subject: 'Your membership ends in {{days}} days', body: 'Your {{plan_name}} ends on {{end_date}}. Renew at the desk or ask us about the annual plan.', cta: 'See options', path: '/app/billing' },
    { key: 'workout_milestone', channel: 'in_app', category: 'coaching', subject: '{{milestone}}', body: '{{celebration}}', cta: 'See my progress', path: '/app/progress' },
    { key: 'checkin_due', channel: 'in_app', category: 'coaching', subject: 'Weekly check-in', body: 'Two minutes, {{first_name}}. Your coach uses this to adjust next week.', cta: 'Check in', path: '/app/progress/check-in' },
    { key: 'escalation_staff', channel: 'in_app', category: 'safety', subject: 'Health escalation: {{member_name}}', body: '{{member_name}} reported {{risk_kind}}. Automatic plan changes are paused. Please review and contact them.', cta: 'Open case', path: '/dashboard/escalations' },
    { key: 'birthday', channel: 'in_app', category: 'marketing', subject: 'Happy birthday, {{first_name}}', body: 'Everyone at {{gym_name}} wishes you a great year ahead.', cta: null, path: null },
    { key: 'waitlist_promoted', channel: 'push', category: 'operational', subject: 'A spot opened up', body: 'You are in for {{class_name}} at {{class_time}}.', cta: 'View booking', path: '/app/classes' },
    { key: 'trial_ending', channel: 'push', category: 'operational', subject: 'Your trial ends in 2 days', body: 'Hi {{first_name}} — how has the week been? If you would like to keep going, the front desk can sort it in two minutes.', cta: 'See plans', path: '/app/billing' },
  ];
  for (const template of templates) {
    for (const locale of ['en'] as const) {
      await insert(db, 'notification_templates', {
        id: uuidFor(`template:${template.key}:${locale}:${template.channel}`),
        organization_id: null,
        key: template.key,
        locale,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        cta_label: template.cta,
        cta_path: template.path,
        category: template.category,
      });
    }
  }

  return {
    platformAdminId,
    exerciseIds,
    equipmentIds,
    workoutIds,
    workoutItemIds,
    programIds,
    programVersionIds,
    programDayIds,
    foodIds,
    recipeIds,
    planIds: new Map(),
  };
}

function intentForWorkout(workout: SeedWorkout): string {
  if (workout.code.startsWith('induction')) return 'beginner_induction';
  if (workout.code.startsWith('fatloss')) return 'fat_loss';
  if (workout.code.startsWith('hyper')) return 'hypertrophy';
  if (workout.code.startsWith('strength')) return 'strength';
  if (workout.code.startsWith('lowimpact')) return 'low_impact';
  if (workout.code.startsWith('home')) return 'home';
  if (workout.code.startsWith('ramadan')) return 'ramadan';
  return 'general_fitness';
}

// ---------------------------------------------------------------------------
// Organization, branches, people
// ---------------------------------------------------------------------------

export interface OrgContext {
  organizationId: string;
  branchIds: Record<'gulberg' | 'dha', string>;
  staffIds: Map<string, string>;
  memberIds: Map<string, string>;
  memberProfileIds: Map<string, string>;
  planIds: Map<string, string>;
  guardianId: string;
}

async function seedOrganization(db: Db, platform: PlatformIds, passwordHash: string): Promise<OrgContext> {
  step('organization: Apex Fitness Lahore, two branches, subscription');

  const organizationId = uuidFor('org:apex');
  await insert(db, 'organizations', {
    id: organizationId,
    slug: ORG_SLUG,
    legal_name: 'Apex Fitness (Private) Limited',
    display_name: 'Apex Fitness Lahore',
    country_code: 'PK',
    default_currency: 'PKR',
    default_locale: 'en',
    default_timezone: 'Asia/Karachi',
    default_units: 'metric',
    tax_registration: 'NTN 4820193-7',
    tax_rate_bps: 0,
    support_email: 'help@apexfitness.pk',
    support_phone: '+924235777000',
    white_label: false,
    onboarded_at: addDays(TODAY, -420).toISOString(),
  });

  await insert(db, 'brand_themes', {
    id: uuidFor('brand:apex'),
    organization_id: organizationId,
    accent_hex: '#C8A45C',
    surface_hex: '#0B0C0E',
    success_hex: '#2FBF87',
    danger_hex: '#E2685C',
    font_family: 'Manrope',
    member_app_name: 'Apex Fitness',
  });

  const branchIds = {
    gulberg: uuidFor('branch:gulberg'),
    dha: uuidFor('branch:dha'),
  } as const;

  await insert(db, 'branches', {
    id: branchIds.gulberg,
    organization_id: organizationId,
    code: 'GLB',
    name: 'Apex Gulberg',
    address_line1: '12-C, MM Alam Road',
    address_line2: 'Gulberg III',
    city: 'Lahore',
    province: 'Punjab',
    postal_code: '54660',
    phone: '+924235777001',
    latitude: 31.5204,
    longitude: 74.3587,
    opens_at: '05:30',
    closes_at: '23:00',
    member_capacity: 900,
  });
  await insert(db, 'branches', {
    id: branchIds.dha,
    organization_id: organizationId,
    code: 'DHA',
    name: 'Apex DHA Phase 5',
    address_line1: '45 Commercial Broadway',
    address_line2: 'DHA Phase 5',
    city: 'Lahore',
    province: 'Punjab',
    postal_code: '54792',
    phone: '+924235777002',
    latitude: 31.4697,
    longitude: 74.4123,
    opens_at: '06:00',
    closes_at: '22:30',
    member_capacity: 600,
  });

  await insert(db, 'organization_subscriptions', {
    id: uuidFor('org-sub:apex'),
    organization_id: organizationId,
    subscription_plan_id: uuidFor('saas-plan:growth'),
    billing_interval: 'monthly',
    state: 'active',
    seats_purchased: 15,
    branch_limit: 3,
    active_member_limit: 800,
    current_period_start: addDays(TODAY, -11).toISOString(),
    current_period_end: addDays(TODAY, 19).toISOString(),
    notes: 'Upgraded from Starter when the DHA branch opened.',
  });

  await insert(db, 'platform_invoices', {
    id: uuidFor('platform-invoice:apex-1'),
    organization_id: organizationId,
    number: 'GG-2026-0311',
    state: 'paid',
    currency: 'PKR',
    subtotal_minor: moneyPkr(55_000),
    tax_minor: 0,
    total_minor: moneyPkr(55_000),
    amount_paid_minor: moneyPkr(55_000),
    period_start: isoDate(addDays(TODAY, -41)),
    period_end: isoDate(addDays(TODAY, -12)),
    issued_at: addDays(TODAY, -41).toISOString(),
    due_at: addDays(TODAY, -27).toISOString(),
    paid_at: addDays(TODAY, -38).toISOString(),
    line_items: JSON.stringify([
      { description: 'GymGuide Growth — monthly', amount_minor: moneyPkr(55_000) },
    ]),
  });

  // Feature flags: this tenant gets Ramadan mode and family accounts on,
  // white label off (they are on Growth, not Enterprise).
  const flagOverrides: Array<[string, boolean, string]> = [
    ['advanced_analytics', true, 'Included with Growth'],
    ['white_label', false, 'Requires the Enterprise plan'],
    ['whatsapp_messaging', false, 'Awaiting approved WhatsApp templates'],
    ['door_access', false, 'Hardware not installed yet'],
  ];
  for (const [key, enabled, note] of flagOverrides) {
    const { rows } = await db.query<{ id: string }>('select id from feature_flags where key = $1', [key]);
    if (!rows[0]) continue;
    await insert(db, 'organization_feature_flags', {
      id: uuidFor(`flag:${key}`),
      organization_id: organizationId,
      feature_flag_id: rows[0].id,
      enabled,
      note,
    });
  }

  // --- Staff ----------------------------------------------------------------
  step('people: staff accounts, roles and branch assignments');
  const staffIds = new Map<string, string>();
  for (const person of STAFF) {
    const id = uuidFor(`user:${person.key}`);
    staffIds.set(person.key, id);
    await insert(db, 'users', {
      id,
      organization_id: organizationId,
      email: person.email,
      phone: person.phone,
      full_name: person.name,
      password_hash: passwordHash,
      status: 'active',
      locale: person.locale ?? 'en',
      timezone: 'Asia/Karachi',
      // Previously the owner was mfa_enabled with no secret, which no code could
      // ever satisfy: the person who buys the product could not sign in at all.
      mfa_enabled: false,
      mfa_secret: person.role === 'gym_owner' ? DEMO_MFA_SECRET : null,
      mfa_enrolled_at: null,
      last_login_at: addDays(TODAY, -1).toISOString(),
    });
    await db.query(
      `insert into user_roles (id, user_id, role_id, organization_id)
       select $1, $2, r.id, $3 from roles r where r.code = $4`,
      [uuidFor(`role:${person.key}`), id, organizationId, person.role],
    );
    await insert(db, 'staff_assignments', {
      id: uuidFor(`assignment:${person.key}`),
      organization_id: organizationId,
      user_id: id,
      branch_id: person.branch ? branchIds[person.branch] : null,
      job_title: person.jobTitle,
      is_primary: true,
      weekly_hours: person.role === 'coach' ? 40 : 45,
      max_active_members: person.role === 'coach' ? 45 : null,
      starts_on: isoDate(addDays(TODAY, -400)),
    });
  }

  // The head coach has been explicitly granted financial read access — the
  // demo for "coaches cannot see money unless someone decides otherwise".
  await db.query(
    `insert into user_permission_grants (id, user_id, permission_id, organization_id, granted_by, reason)
     select $1, $2, p.id, $3, $4, $5 from permissions p where p.key = 'finance.read'`,
    [
      uuidFor('grant:coach-finance'),
      staffIds.get('coach_hassan'),
      organizationId,
      staffIds.get('owner'),
      'Head coach runs the PT package P&L review with the owner each month.',
    ],
  );

  // --- Membership plans -----------------------------------------------------
  const planIds = new Map<string, string>();
  for (const [index, plan] of PLANS.entries()) {
    const id = uuidFor(`plan:${plan.code}`);
    planIds.set(plan.code, id);
    await insert(db, 'membership_plans', {
      id,
      organization_id: organizationId,
      branch_id: null,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      kind: plan.kind,
      currency: 'PKR',
      price_minor: moneyPkr(plan.price),
      billing_interval: plan.interval,
      joining_fee_minor: moneyPkr(plan.joining),
      class_credits: plan.classCredits,
      pt_sessions: plan.code === 'pt_10' ? 10 : null,
      freeze_days_per_year: plan.freezeDays,
      max_family_members: plan.code === 'gold_annual' ? 4 : 1,
      branch_access: plan.access,
      tax_rate_bps: 0,
      is_public: true,
      sort_order: index,
    });
  }

  await insert(db, 'promotions', {
    id: uuidFor('promo:newyear'),
    organization_id: organizationId,
    code: 'APEX20',
    label: '20% off the first month',
    discount_kind: 'percent',
    percent_off_bps: 2000,
    applies_to_plan_ids: [planIds.get('gold_monthly'), planIds.get('platinum_monthly')],
    max_redemptions: 200,
    redemption_count: 37,
    starts_on: isoDate(addDays(TODAY, -60)),
    ends_on: isoDate(addDays(TODAY, 30)),
  });
  await insert(db, 'promotions', {
    id: uuidFor('promo:student'),
    organization_id: organizationId,
    code: 'STUDENT1000',
    label: 'Rs 1,000 off for students',
    discount_kind: 'fixed',
    amount_off_minor: moneyPkr(1000),
    applies_to_plan_ids: [planIds.get('student_monthly')],
    starts_on: isoDate(addDays(TODAY, -120)),
  });

  // --- Branch equipment -----------------------------------------------------
  const gulbergEquipment = EQUIPMENT.map((e) => e.code);
  const dhaEquipment = EQUIPMENT.filter((e) => !['smith_machine', 'rower'].includes(e.code)).map((e) => e.code);
  for (const [branchKey, codes] of [['gulberg', gulbergEquipment], ['dha', dhaEquipment]] as const) {
    for (const code of codes) {
      const equipmentId = platform.equipmentIds.get(code);
      if (!equipmentId) continue;
      await insert(db, 'branch_equipment', {
        id: uuidFor(`branch-equipment:${branchKey}:${code}`),
        organization_id: organizationId,
        branch_id: branchIds[branchKey],
        equipment_id: equipmentId,
        quantity: code === 'dumbbell' ? 24 : code === 'bench' ? 6 : code === 'treadmill' ? 8 : 2,
        condition: code === 'leg_curl' && branchKey === 'dha' ? 'maintenance' : 'good',
        is_available: !(code === 'leg_curl' && branchKey === 'dha'),
        last_serviced_on: isoDate(addDays(TODAY, -45)),
        next_service_on: isoDate(addDays(TODAY, 45)),
      });
    }
  }

  // --- Members --------------------------------------------------------------
  step('people: 16 members with profiles, consent, screening and goals');
  const memberIds = new Map<string, string>();
  const memberProfileIds = new Map<string, string>();

  const guardianId = uuidFor('user:guardian_tariq');
  await insert(db, 'users', {
    id: guardianId,
    organization_id: organizationId,
    email: 'tariq.noor@example.com',
    phone: '+923214567099',
    full_name: 'Tariq Noor',
    password_hash: passwordHash,
    status: 'active',
    locale: 'en',
  });
  await db.query(
    `insert into user_roles (id, user_id, role_id, organization_id)
     select $1, $2, r.id, $3 from roles r where r.code = 'guardian'`,
    [uuidFor('role:guardian_tariq'), guardianId, organizationId],
  );

  let memberNumber = 1001;
  for (const member of MEMBERS) {
    const userId = uuidFor(`user:${member.key}`);
    memberIds.set(member.key, userId);
    const joinedOn = addDays(TODAY, -member.joinedDaysAgo);

    await insert(db, 'users', {
      id: userId,
      organization_id: organizationId,
      email: member.email,
      phone: member.phone,
      full_name: member.name,
      password_hash: passwordHash,
      status: 'active',
      locale: member.locale,
      timezone: 'Asia/Karachi',
      units: 'metric',
      last_login_at: addDays(TODAY, member.adherence > 0.5 ? -1 : -18).toISOString(),
      invite_accepted_at: addDays(joinedOn, 1).toISOString(),
    });
    await db.query(
      `insert into user_roles (id, user_id, role_id, organization_id)
       select $1, $2, r.id, $3 from roles r where r.code = 'member'`,
      [uuidFor(`role:${member.key}`), userId, organizationId],
    );

    const profileId = uuidFor(`profile:${member.key}`);
    memberProfileIds.set(member.key, profileId);
    const onboardingComplete = member.onboardingComplete !== false;

    await insert(db, 'member_profiles', {
      id: profileId,
      organization_id: organizationId,
      branch_id: branchIds[member.branch],
      user_id: userId,
      member_number: `APX-${memberNumber++}`,
      date_of_birth: member.dob,
      gender: member.gender,
      lifecycle_stage: member.lifecycle,
      joined_on: isoDate(joinedOn),
      primary_goal: member.goal,
      experience_level: member.experience,
      height_cm: member.heightCm,
      starting_weight_kg: member.startWeightKg,
      target_weight_kg: targetWeightFor(member),
      training_days_per_week: member.program === 'hypertrophy_4d' ? 4 : member.program === 'beginner_induction_2d' ? 2 : 3,
      preferred_days: member.program === 'hypertrophy_4d' ? ['mon', 'tue', 'thu', 'fri'] : ['mon', 'wed', 'fri'],
      preferred_session_minutes: member.experience === 'first_time' ? 30 : 45,
      preferred_training_time: member.gender === 'female' ? 'morning' : 'evening',
      ramadan_mode: member.ramadanMode ?? false,
      // Canonical step names live in apps/web/src/server/services/onboarding.ts.
      onboarding_step: onboardingComplete ? 'plan' : 'health',
      onboarding_completed_at: onboardingComplete ? addDays(joinedOn, 1).toISOString() : null,
      assigned_coach_id: staffIds.get(member.coach),
      assigned_nutritionist_id: ['ali', 'ayesha', 'junaid'].includes(member.key) ? staffIds.get('nutritionist') : null,
      guardian_user_id: member.guardian ? guardianId : null,
      referral_source: pick(createRng(memberNumber), ['walk_in', 'instagram', 'referral', 'google']),
      notes_summary: member.notes ?? null,
      last_visit_at: null,
      last_workout_at: null,
    });

    if (member.guardian) {
      await insert(db, 'family_links', {
        id: uuidFor(`family:${member.key}`),
        organization_id: organizationId,
        payer_user_id: guardianId,
        dependent_user_id: userId,
        relationship: 'parent',
        can_manage_billing: true,
        can_view_health: false,
      });
    }

    await insert(db, 'emergency_contacts', {
      id: uuidFor(`emergency:${member.key}`),
      organization_id: organizationId,
      user_id: userId,
      full_name: member.gender === 'female' ? 'Nasreen Bibi' : 'Rashid Mahmood',
      relationship: member.guardian ? 'Father' : 'Spouse / next of kin',
      phone: '+92321' + String(4560000 + memberNumber),
      is_primary: true,
    });

    // Consent evidence
    const consentKinds: Array<[string, boolean]> = [
      ['terms', true],
      ['privacy', true],
      ['health_data', onboardingComplete],
      ['ai_coaching', true],
      ['progress_photos', ['ayesha', 'bilal', 'sana'].includes(member.key)],
      ['marketing_email', member.adherence > 0.6],
      ['marketing_whatsapp', false],
    ];
    for (const [kind, granted] of consentKinds) {
      await insert(db, 'consents', {
        id: uuidFor(`consent:${member.key}:${kind}`),
        organization_id: organizationId,
        user_id: userId,
        kind,
        granted,
        version: '2026.1',
        collected_by: staffIds.get(member.branch === 'gulberg' ? 'front_desk_zoya' : 'front_desk_umar'),
        collected_channel: 'front_desk',
        granted_at: granted ? addDays(joinedOn, 0).toISOString() : null,
      });
    }

    await insert(db, 'waivers', {
      id: uuidFor(`waiver:${member.key}`),
      organization_id: organizationId,
      branch_id: branchIds[member.branch],
      user_id: userId,
      template_code: 'liability_waiver',
      template_version: '2026.1',
      body_snapshot:
        'I confirm that I am participating in physical exercise at my own risk, that I have disclosed relevant health conditions, and that I will stop and inform staff if I feel unwell.',
      signature_name: onboardingComplete ? member.name : null,
      signed_at: onboardingComplete ? addDays(joinedOn, 0).toISOString() : null,
      witnessed_by: staffIds.get(member.branch === 'gulberg' ? 'front_desk_zoya' : 'front_desk_umar'),
    });

    // Health screening
    const redFlags = {
      chestPain: false,
      fainting: false,
      severeDizziness: false,
      breathingDifficulty: false,
      currentSharpPain: member.redFlag === 'sharp_or_worsening_pain',
      recentSurgery: false,
      pregnancyOrPostpartum: member.redFlag === 'pregnancy_postpartum',
      doctorAdvisedAgainstExercise: false,
      disorderedEatingConcern: false,
    };
    if (onboardingComplete) {
      await insert(db, 'health_screenings', {
        id: uuidFor(`screening:${member.key}`),
        organization_id: organizationId,
        user_id: userId,
        questionnaire_code: 'parq_plus',
        version: '2026.1',
        answers: JSON.stringify({ redFlags, conditions: member.conditions ?? [], painAreas: member.painAreas ?? [] }),
        reported_conditions: member.conditions ?? [],
        medications_disclosed: (member.conditions ?? []).length > 0,
        pain_areas: member.painAreas ?? [],
        pregnancy_status: member.redFlag === 'pregnancy_postpartum' ? 'postpartum' : 'not_applicable',
        requires_clearance: member.redFlag === 'pregnancy_postpartum',
        clearance_document_url: member.redFlag === 'pregnancy_postpartum' ? 'private://clearance/zainab-2026.pdf' : null,
        clearance_confirmed_by: member.redFlag === 'pregnancy_postpartum' ? staffIds.get('manager_gulberg') : null,
        clearance_confirmed_at: member.redFlag === 'pregnancy_postpartum' ? addDays(joinedOn, 2).toISOString() : null,
        completed_at: addDays(joinedOn, 0).toISOString(),
        reviewed_by: staffIds.get(member.coach),
        reviewed_at: addDays(joinedOn, 1).toISOString(),
      });
    }

    // Goals
    if (onboardingComplete) {
      await insert(db, 'goals', {
        id: uuidFor(`goal:${member.key}`),
        organization_id: organizationId,
        user_id: userId,
        kind: member.goal,
        headline: goalHeadline(member),
        metric_key: 'body_weight',
        start_value: member.startWeightKg,
        target_value: targetWeightFor(member),
        current_value: member.currentWeightKg,
        unit: 'kg',
        target_date: isoDate(addDays(TODAY, 90)),
        state: 'active',
        set_by: staffIds.get(member.coach),
      });
    }

    // Habits
    const habits = [
      { key: 'steps', label: 'Walk 8,000 steps', target: 8000, unit: 'steps' },
      { key: 'water', label: 'Drink 2.5 litres of water', target: 2500, unit: 'ml' },
      { key: 'sleep', label: 'Sleep 7 hours', target: 7, unit: 'hours' },
      { key: 'protein', label: 'Protein at every meal', target: 3, unit: 'meals' },
    ];
    for (const habit of habits) {
      await insert(db, 'habits', {
        id: uuidFor(`habit:${member.key}:${habit.key}`),
        organization_id: organizationId,
        user_id: userId,
        key: habit.key,
        label: habit.label,
        target_value: habit.target,
        unit: habit.unit,
        cadence: 'daily',
        is_active: true,
        created_by: staffIds.get(member.coach),
      });
    }

    // Notification preferences
    for (const channel of ['in_app', 'push', 'email', 'sms', 'whatsapp'] as const) {
      await insert(db, 'notification_preferences', {
        id: uuidFor(`notif-pref:${member.key}:${channel}`),
        organization_id: organizationId,
        user_id: userId,
        channel,
        operational_enabled: true,
        coaching_enabled: channel !== 'sms',
        billing_enabled: true,
        marketing_enabled: channel === 'email' && member.adherence > 0.6,
        max_per_week: channel === 'push' ? 5 : 3,
        opted_in_at: channel === 'whatsapp' ? null : addDays(joinedOn, 0).toISOString(),
      });
    }

    // Rotating QR check-in credential
    const token = generateToken(24);
    await insert(db, 'access_credentials', {
      id: uuidFor(`credential:${member.key}`),
      organization_id: organizationId,
      branch_id: branchIds[member.branch],
      user_id: userId,
      kind: 'qr',
      token_hash: hashToken(`demo-${member.key}-${token}`),
      display_hint: `APX-${memberNumber - 1}`,
      is_active: true,
      issued_at: joinedOn.toISOString(),
    });
  }

  return {
    organizationId,
    branchIds: { gulberg: branchIds.gulberg, dha: branchIds.dha },
    staffIds,
    memberIds,
    memberProfileIds,
    planIds,
    guardianId,
  };
}

