import 'server-only';
/**
 * Member-facing nutrition.
 *
 * Scope is deliberately narrow. This gives portion guidance and, when a
 * qualified person has set them, calorie and macro targets. It does not produce
 * medical nutrition therapy, advice about medication or supplements, or
 * anything an eating-disorder-sensitive reader should not be handed by a piece
 * of software — those go to a human, and the screen says so.
 *
 * Targets are never invented here. If nobody has set them, the member gets
 * plate-based guidance, which is safe without knowing someone's history.
 */
import {
  nutritionAdherenceBand,
  plateGuidance,
  ramadanSchedule,
  sumMealLogs,
  type MealLogTotals,
} from '@gymguide/domain';
import type { Actor, TrainingGoal } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant } from '../db/pool';

export const MEAL_SLOTS = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
  'sehri',
  'iftar',
] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  pre_workout: 'Before training',
  post_workout: 'After training',
  sehri: 'Sehri',
  iftar: 'Iftar',
};

export interface NutritionTargets {
  approach: 'plate' | 'macros' | 'calories_only';
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  waterMl: number;
  proteinPalms: number | null;
  carbCuppedHands: number | null;
  vegFists: number | null;
  fatThumbs: number | null;
  halalOnly: boolean;
  dietaryPreferences: string[];
  allergies: string[];
  ramadanSchedule: boolean;
  setByName: string | null;
  setByRole: string | null;
  guardRailNotes: string | null;
}

export interface LoggedMeal {
  id: string;
  slot: MealSlot;
  description: string;
  servings: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  loggedOn: string;
}

export interface FoodChoice {
  id: string;
  name: string;
  nameUr: string | null;
  category: string;
  servingLabel: string;
  caloriesKcal: number;
  proteinG: number;
  isLocalStaple: boolean;
}

export interface PlanEntry {
  slot: MealSlot;
  title: string;
  guidance: string | null;
}

export interface NutritionPage {
  day: string;
  goal: TrainingGoal;
  targets: NutritionTargets | null;
  /** Portion guidance, always available — it needs no clinical judgement. */
  plate: ReturnType<typeof plateGuidance>;
  meals: LoggedMeal[];
  totals: MealLogTotals;
  band: ReturnType<typeof nutritionAdherenceBand>;
  water: { targetMl: number };
  planName: string | null;
  planEntries: PlanEntry[];
  ramadan: ReturnType<typeof ramadanSchedule> | null;
  commonFoods: FoodChoice[];
  weekTotals: Array<{ day: string; caloriesKcal: number }>;
}

export async function loadNutrition(actor: Actor, day: string): Promise<NutritionPage> {
  const session = tenantSessionFor(actor);

  return withTenant(session, async (db) => {
    const [profile, targetRows, mealRows, planRows, foodRows, weekRows] = await Promise.all([
      // Weight comes from the member's own logged history, falling back to what
      // they weighed on joining. Portion guidance needs a number; it does not
      // need a recent one.
      db.query<{ primary_goal: TrainingGoal; weight_kg: string | null; training_days_per_week: number }>(
        `select mp.primary_goal,
                coalesce(
                  (select ml.value from metric_logs ml
                     join metric_definitions md on md.id = ml.metric_definition_id
                    where ml.user_id = mp.user_id and md.key = 'body_weight'
                    order by ml.measured_on desc limit 1),
                  mp.starting_weight_kg
                )::text as weight_kg,
                mp.training_days_per_week
           from member_profiles mp where mp.user_id = $1`,
        [actor.userId],
      ),

      db.query<{
        approach: 'plate' | 'macros' | 'calories_only';
        calories_kcal: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        water_ml: number;
        protein_palms: string | null;
        carb_cupped_hands: string | null;
        veg_fists: string | null;
        fat_thumbs: string | null;
        halal_only: boolean;
        dietary_preferences: string[];
        allergies: string[];
        ramadan_schedule: boolean;
        set_by_name: string | null;
        set_by_role: string | null;
        guard_rail_notes: string | null;
      }>(
        `select nt.approach, nt.calories_kcal, nt.protein_g, nt.carbs_g, nt.fat_g, nt.water_ml,
                nt.protein_palms, nt.carb_cupped_hands, nt.veg_fists, nt.fat_thumbs,
                nt.halal_only, nt.dietary_preferences, nt.allergies, nt.ramadan_schedule,
                u.full_name as set_by_name, nt.set_by_role::text as set_by_role, nt.guard_rail_notes
           from nutrition_targets nt
           left join users u on u.id = nt.set_by_user_id
          where nt.user_id = $1 and nt.superseded_at is null`,
        [actor.userId],
      ),

      db.query<{
        id: string;
        meal_slot: MealSlot;
        description: string;
        quantity_servings: string;
        calories_kcal: string | null;
        protein_g: string | null;
        carbs_g: string | null;
        fat_g: string | null;
        logged_on: string;
      }>(
        `select ml.id, ml.meal_slot, ml.quantity_servings, ml.calories_kcal, ml.protein_g,
                ml.carbs_g, ml.fat_g, ml.logged_on::text as logged_on,
                coalesce(r.name, f.name, ml.free_text, 'Logged meal') as description
           from meal_logs ml
           left join recipes r on r.id = ml.recipe_id
           left join food_items f on f.id = ml.food_item_id
          where ml.user_id = $1 and ml.logged_on = $2::date
          order by ml.created_at`,
        [actor.userId, day],
      ),

      db.query<{ plan_name: string; meal_slot: MealSlot; title: string; guidance_text: string | null; position: number }>(
        `select mp.name as plan_name, mpe.meal_slot,
                coalesce(r.name, f.name, 'Guidance') as title,
                mpe.guidance_text, mpe.position
           from meal_plans mp
           join meal_plan_entries mpe on mpe.meal_plan_id = mp.id
           left join recipes r on r.id = mpe.recipe_id
           left join food_items f on f.id = mpe.food_item_id
          where mp.user_id = $1 and mp.state = 'published'
            and mpe.day_number = extract(isodow from $2::date)
          order by mpe.position`,
        [actor.userId, day],
      ),

      // Everyday local foods first: someone logging dinner in Lahore should see
      // roti and daal before quinoa.
      db.query<{
        id: string;
        name: string;
        name_ur: string | null;
        category: string;
        serving_label: string;
        calories_kcal: string;
        protein_g: string;
        is_local_staple: boolean;
      }>(
        `select id, name, name_ur, category, serving_label, calories_kcal, protein_g, is_local_staple
           from food_items
          order by is_local_staple desc, name
          limit 60`,
      ),

      db.query<{ day: string; calories: string }>(
        `select logged_on::text as day, coalesce(sum(calories_kcal), 0) as calories
           from meal_logs
          where user_id = $1 and logged_on between $2::date - 6 and $2::date
          group by logged_on order by logged_on`,
        [actor.userId, day],
      ),
    ]);

    const member = profile.rows[0];
    const goal: TrainingGoal = member?.primary_goal ?? 'general_fitness';
    const weightKg = member?.weight_kg ? Number(member.weight_kg) : 70;
    const trainingDaysPerWeek = member?.training_days_per_week ?? 3;

    const target = targetRows.rows[0];
    const targets: NutritionTargets | null = target
      ? {
          approach: target.approach,
          caloriesKcal: target.calories_kcal,
          proteinG: target.protein_g,
          carbsG: target.carbs_g,
          fatG: target.fat_g,
          waterMl: target.water_ml,
          proteinPalms: target.protein_palms === null ? null : Number(target.protein_palms),
          carbCuppedHands: target.carb_cupped_hands === null ? null : Number(target.carb_cupped_hands),
          vegFists: target.veg_fists === null ? null : Number(target.veg_fists),
          fatThumbs: target.fat_thumbs === null ? null : Number(target.fat_thumbs),
          halalOnly: target.halal_only,
          dietaryPreferences: target.dietary_preferences,
          allergies: target.allergies,
          ramadanSchedule: target.ramadan_schedule,
          setByName: target.set_by_name,
          setByRole: target.set_by_role,
          guardRailNotes: target.guard_rail_notes,
        }
      : null;

    const meals: LoggedMeal[] = mealRows.rows.map((row) => ({
      id: row.id,
      slot: row.meal_slot,
      description: row.description,
      servings: Number(row.quantity_servings),
      caloriesKcal: row.calories_kcal === null ? null : Number(row.calories_kcal),
      proteinG: row.protein_g === null ? null : Number(row.protein_g),
      loggedOn: row.logged_on,
    }));

    const totals = sumMealLogs(
      mealRows.rows.map((row) => ({
        caloriesKcal: row.calories_kcal === null ? null : Number(row.calories_kcal),
        proteinG: row.protein_g === null ? null : Number(row.protein_g),
        carbsG: row.carbs_g === null ? null : Number(row.carbs_g),
        fatG: row.fat_g === null ? null : Number(row.fat_g),
        quantityServings: Number(row.quantity_servings),
      })),
    );

    return {
      day,
      goal,
      targets,
      plate: plateGuidance({ goal, weightKg, trainingDaysPerWeek }),
      meals,
      totals,
      band: nutritionAdherenceBand(totals.caloriesKcal, targets?.caloriesKcal ?? null),
      water: { targetMl: targets?.waterMl ?? 2500 },
      planName: planRows.rows[0]?.plan_name ?? null,
      planEntries: planRows.rows.map((row) => ({
        slot: row.meal_slot,
        title: row.title,
        guidance: row.guidance_text,
      })),
      ramadan: targets?.ramadanSchedule ? ramadanSchedule('04:20', '18:55') : null,
      commonFoods: foodRows.rows.map((row) => ({
        id: row.id,
        name: row.name,
        nameUr: row.name_ur,
        category: row.category,
        servingLabel: row.serving_label,
        caloriesKcal: Number(row.calories_kcal),
        proteinG: Number(row.protein_g),
        isLocalStaple: row.is_local_staple,
      })),
      weekTotals: weekRows.rows.map((row) => ({ day: row.day, caloriesKcal: Number(row.calories) })),
    };
  });
}

export interface LogMealInput {
  day: string;
  slot: MealSlot;
  foodItemId?: string;
  freeText?: string;
  servings: number;
}

/**
 * Record what someone ate.
 *
 * Nutrition figures are copied from the food item at the chosen serving size
 * rather than trusted from the client, so a member cannot post arbitrary
 * calorie numbers into their own history.
 */
export async function logMeal(actor: Actor, input: LogMealInput): Promise<{ ok: boolean; message: string }> {
  if (!MEAL_SLOTS.includes(input.slot)) {
    return { ok: false, message: 'Pick a meal to log this against.' };
  }
  const servings = Number(input.servings);
  if (!Number.isFinite(servings) || servings <= 0 || servings > 20) {
    return { ok: false, message: 'Enter a sensible number of servings.' };
  }
  if (!input.foodItemId && !input.freeText?.trim()) {
    return { ok: false, message: 'Choose a food or describe what you ate.' };
  }

  const session = tenantSessionFor(actor);
  try {
    await withTenant(session, async (db) => {
      if (input.foodItemId) {
        const { rowCount } = await db.query(
          `insert into meal_logs
             (organization_id, user_id, logged_on, meal_slot, food_item_id, quantity_servings,
              calories_kcal, protein_g, carbs_g, fat_g, logged_via)
           select $1, $2, $3::date, $4, f.id, $5,
                  f.calories_kcal * $5, f.protein_g * $5, f.carbs_g * $5, f.fat_g * $5, 'app'
             from food_items f where f.id = $6`,
          [actor.organizationId, actor.userId, input.day, input.slot, servings, input.foodItemId],
        );
        if (!rowCount) throw new Error('That food is not in the library.');
      } else {
        // Free text carries no numbers: a description is not a measurement, and
        // pretending otherwise would put invented calories into someone's history.
        await db.query(
          `insert into meal_logs
             (organization_id, user_id, logged_on, meal_slot, free_text, quantity_servings, logged_via)
           values ($1, $2, $3::date, $4, $5, $6, 'app')`,
          [actor.organizationId, actor.userId, input.day, input.slot, input.freeText!.trim(), servings],
        );
      }
    });
    return { ok: true, message: 'Logged.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not log that meal.' };
  }
}

export async function deleteMealLog(actor: Actor, mealLogId: string): Promise<{ ok: boolean; message: string }> {
  const session = tenantSessionFor(actor);
  const removed = await withTenant(session, async (db) => {
    const result = await db.query('delete from meal_logs where id = $1 and user_id = $2', [mealLogId, actor.userId]);
    return result.rowCount ?? 0;
  });
  return removed > 0
    ? { ok: true, message: 'Removed.' }
    : { ok: false, message: 'That entry is already gone.' };
}
