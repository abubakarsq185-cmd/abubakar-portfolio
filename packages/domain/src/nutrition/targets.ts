/**
 * Nutrition guidance — deliberately conservative and non-medical.
 *
 * Guard rails, all enforced here and again by CHECK constraints in
 * db/migrations/0006_nutrition.sql:
 *   • never below 1200 kcal, and never below 85% of estimated BMR
 *   • deficit and surplus capped at ±20% of maintenance
 *   • weekly weight change capped at ±0.75 kg
 *   • no targets at all when an eating-disorder concern is on file
 *   • no medical nutrition therapy, supplements or medication advice
 */
import type { NutritionApproach, TrainingGoal } from '@gymguide/types';

export interface TargetInputs {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: 'male' | 'female' | 'unspecified';
  activityLevel: 'desk' | 'mixed' | 'on_feet' | 'physical';
  trainingDaysPerWeek: number;
  goal: TrainingGoal;
  approach: NutritionApproach;
  /** From the safety engine. When true we refuse to emit numeric targets. */
  eatingDisorderConcern: boolean;
  pregnancyOrPostpartum: boolean;
  ramadanSchedule: boolean;
}

export interface PlateGuidance {
  proteinPalms: number;
  carbCuppedHands: number;
  vegFists: number;
  fatThumbs: number;
  explanation: string[];
}

export interface NutritionTargetResult {
  approach: NutritionApproach;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
  waterMl: number;
  weeklyChangeKg: number | null;
  plate: PlateGuidance;
  guardRailNotes: string[];
  requiresProfessionalReview: boolean;
  /** Copy shown above the numbers. Sets expectations honestly. */
  disclaimer: string;
}

const ACTIVITY_FACTOR: Record<TargetInputs['activityLevel'], number> = {
  desk: 1.25,
  mixed: 1.375,
  on_feet: 1.5,
  physical: 1.65,
};

/** Mifflin-St Jeor. Uses the average of both formulas when sex is unspecified. */
export function estimateBmr(input: Pick<TargetInputs, 'weightKg' | 'heightCm' | 'ageYears' | 'sex'>): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  if (input.sex === 'male') return Math.round(base + 5);
  if (input.sex === 'female') return Math.round(base - 161);
  return Math.round(base - 78);
}

export function estimateMaintenance(input: TargetInputs): number {
  const bmr = estimateBmr(input);
  const activity = ACTIVITY_FACTOR[input.activityLevel];
  // Training adds a small amount on top of general activity.
  const trainingBump = 1 + Math.min(input.trainingDaysPerWeek, 6) * 0.012;
  return Math.round(bmr * activity * trainingBump);
}

const GOAL_ADJUSTMENT: Record<TrainingGoal, number> = {
  fat_loss: -0.18,
  recomposition: -0.08,
  maintenance: 0,
  general_fitness: 0,
  endurance: 0.03,
  beginner_confidence: 0,
  strength: 0.06,
  muscle_gain: 0.1,
  weight_gain: 0.15,
  bulking: 0.15,
};

const MIN_CALORIES = 1200;
const MAX_ADJUSTMENT = 0.2;
const MAX_WEEKLY_CHANGE_KG = 0.75;

export function computeNutritionTargets(input: TargetInputs): NutritionTargetResult {
  const notes: string[] = [];
  const plate = plateGuidance(input);

  if (input.eatingDisorderConcern) {
    return {
      approach: 'plate',
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fibreG: null,
      waterMl: 2500,
      weeklyChangeKg: null,
      plate: {
        ...plate,
        explanation: [
          'We are showing balanced-plate guidance instead of numbers.',
          'A qualified professional from the team will talk this through with you.',
        ],
      },
      guardRailNotes: ['Numeric calorie and macro targets are disabled because of a disclosed concern about eating patterns.'],
      requiresProfessionalReview: true,
      disclaimer:
        'This is general healthy-eating guidance, not treatment. A qualified professional will support you personally.',
    };
  }

  const maintenance = estimateMaintenance(input);
  const bmr = estimateBmr(input);

  let adjustment = GOAL_ADJUSTMENT[input.goal] ?? 0;
  if (Math.abs(adjustment) > MAX_ADJUSTMENT) {
    adjustment = Math.sign(adjustment) * MAX_ADJUSTMENT;
    notes.push(`Calorie adjustment capped at ${MAX_ADJUSTMENT * 100}% of maintenance.`);
  }

  let calories = Math.round(maintenance * (1 + adjustment));

  const bmrFloor = Math.round(bmr * 0.85);
  if (calories < bmrFloor) {
    calories = bmrFloor;
    notes.push('Raised to stay at or above 85% of estimated resting energy needs.');
  }
  if (calories < MIN_CALORIES) {
    calories = MIN_CALORIES;
    notes.push(`Raised to the ${MIN_CALORIES} kcal minimum this product will ever recommend.`);
  }

  if (input.pregnancyOrPostpartum) {
    notes.push('Pregnancy and postpartum nutrition needs a qualified professional; targets are indicative only and flagged for review.');
  }

  // Protein: 1.6–2.2 g/kg depending on goal, capped for very heavy members.
  const proteinPerKg = input.goal === 'fat_loss' || input.goal === 'recomposition' ? 2.0 : 1.7;
  const proteinG = Math.min(Math.round(input.weightKg * proteinPerKg), 250);
  const fatG = Math.max(Math.round((calories * 0.27) / 9), Math.round(input.weightKg * 0.6));
  const remaining = calories - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(50, Math.round(remaining / 4));
  const fibreG = Math.min(40, Math.max(22, Math.round(calories / 1000 * 14)));

  const weeklyChangeKg = clampWeeklyChange(
    (calories - maintenance) / 1100,
  );

  if (input.ramadanSchedule) {
    notes.push('Ramadan schedule on: the same daily totals are split across sehri and iftar rather than three meals.');
  }

  return {
    approach: input.approach,
    caloriesKcal: input.approach === 'plate' ? null : calories,
    proteinG: input.approach === 'macros' ? proteinG : input.approach === 'calories_only' ? proteinG : null,
    carbsG: input.approach === 'macros' ? carbsG : null,
    fatG: input.approach === 'macros' ? fatG : null,
    fibreG: input.approach === 'macros' ? fibreG : null,
    waterMl: recommendedWaterMl(input.weightKg, input.trainingDaysPerWeek),
    weeklyChangeKg,
    plate,
    guardRailNotes: notes,
    requiresProfessionalReview: input.pregnancyOrPostpartum,
    disclaimer:
      'General nutrition guidance to support your training. Not medical or dietetic advice. If you have a medical condition, please speak to your doctor or a registered dietitian.',
  };
}

function clampWeeklyChange(value: number): number {
  const clamped = Math.max(-MAX_WEEKLY_CHANGE_KG, Math.min(MAX_WEEKLY_CHANGE_KG, value));
  return Number(clamped.toFixed(2));
}

export function recommendedWaterMl(weightKg: number, trainingDays: number): number {
  const base = Math.round(weightKg * 33);
  const training = trainingDays >= 4 ? 500 : 250;
  return Math.min(5000, Math.max(1800, Math.round((base + training) / 100) * 100));
}

/**
 * Hand-portion guidance for members who do not want to count anything.
 * One palm of protein, one cupped hand of carbs, one fist of vegetables and one
 * thumb of fat per meal, scaled by goal.
 */
export function plateGuidance(input: Pick<TargetInputs, 'goal' | 'weightKg' | 'trainingDaysPerWeek'>): PlateGuidance {
  const meals = 3;
  const bigger = input.goal === 'muscle_gain' || input.goal === 'weight_gain' || input.goal === 'bulking';
  const leaner = input.goal === 'fat_loss' || input.goal === 'recomposition';

  const proteinPalms = meals * (bigger ? 1.5 : 1);
  const carbCuppedHands = meals * (bigger ? 2 : leaner ? 1 : 1.5);
  const vegFists = meals * (leaner ? 2 : 1.5);
  const fatThumbs = meals * (leaner ? 1 : 1.5);

  return {
    proteinPalms,
    carbCuppedHands,
    vegFists,
    fatThumbs,
    explanation: [
      `Protein: about ${proteinPalms} palm-sized portions across the day (chicken, beef, fish, eggs, daal, paneer, yoghurt).`,
      `Carbs: about ${carbCuppedHands} cupped handfuls (roti, rice, potato, oats).`,
      `Vegetables: at least ${vegFists} fist-sized portions — sabzi counts.`,
      `Fats: about ${fatThumbs} thumb-sized portions (oil for cooking, nuts, seeds).`,
      leaner
        ? 'Fill half the plate with vegetables first; it keeps you full without counting.'
        : bigger
          ? 'If you struggle to eat enough, add a glass of milk or a banana with peanut butter between meals.'
          : 'Keep portions steady and consistent day to day.',
    ],
  };
}

export interface MealLogTotals {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function sumMealLogs(
  logs: Array<{ caloriesKcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; quantityServings: number }>,
): MealLogTotals {
  return logs.reduce<MealLogTotals>(
    (acc, log) => ({
      caloriesKcal: acc.caloriesKcal + (log.caloriesKcal ?? 0),
      proteinG: acc.proteinG + (log.proteinG ?? 0),
      carbsG: acc.carbsG + (log.carbsG ?? 0),
      fatG: acc.fatG + (log.fatG ?? 0),
    }),
    { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function nutritionAdherenceBand(consumedKcal: number, targetKcal: number | null): {
  band: 'on_track' | 'slightly_under' | 'slightly_over' | 'well_under' | 'well_over' | 'unknown';
  message: string;
} {
  if (!targetKcal || consumedKcal <= 0) {
    return { band: 'unknown', message: 'Log a couple of meals and we can give you feedback.' };
  }
  const ratio = consumedKcal / targetKcal;
  if (ratio >= 0.9 && ratio <= 1.1) return { band: 'on_track', message: 'Right where you want to be today.' };
  if (ratio > 1.1 && ratio <= 1.25) return { band: 'slightly_over', message: 'A little above target — nothing to worry about.' };
  if (ratio > 1.25) return { band: 'well_over', message: 'Above target today. Tomorrow is a fresh start; no need to compensate.' };
  if (ratio >= 0.75) return { band: 'slightly_under', message: 'Slightly under. Adding protein to your next meal would help.' };
  return {
    band: 'well_under',
    message: 'Well under target. Eating too little slows progress — please add a proper meal.',
  };
}

/** Ramadan meal schedule: same totals, two eating windows. */
export function ramadanSchedule(sehriTime: string, iftarTime: string): Array<{ slot: 'sehri' | 'iftar' | 'post_workout'; time: string; guidance: string }> {
  return [
    {
      slot: 'sehri',
      time: sehriTime,
      guidance: 'Slow-release carbs plus protein: dahi, eggs or paneer with roti or oats, and plenty of water.',
    },
    {
      slot: 'iftar',
      time: iftarTime,
      guidance: 'Break the fast with dates and water, then a balanced plate. Avoid making the whole meal fried.',
    },
    {
      slot: 'post_workout',
      time: 'after taraweeh',
      guidance: 'If you train after iftar, have a protein-rich snack and finish your water for the day before sehri.',
    },
  ];
}
