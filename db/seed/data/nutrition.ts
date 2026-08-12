/**
 * Pakistani-first food catalogue, swaps and recipes.
 * Per-serving values are rounded, typical home-cooked figures — good enough for
 * guidance, and deliberately not presented as clinical precision.
 */

export interface SeedFood {
  code: string;
  name: string;
  nameUr?: string;
  nameUrRm?: string;
  category: string;
  servingLabel: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  isVegetarian?: boolean;
  isLocalStaple?: boolean;
  costBand?: 'low' | 'medium' | 'high';
  allergens?: string[];
}

export const FOODS: SeedFood[] = [
  { code: 'roti', name: 'Roti (whole wheat)', nameUr: 'روٹی', nameUrRm: 'Roti', category: 'roti_bread', servingLabel: '1 medium roti', servingGrams: 60, calories: 150, protein: 5, carbs: 30, fat: 1, fibre: 4, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['gluten'] },
  { code: 'naan', name: 'Naan', nameUr: 'نان', category: 'roti_bread', servingLabel: '1 naan', servingGrams: 100, calories: 290, protein: 9, carbs: 52, fat: 5, fibre: 2, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['gluten'] },
  { code: 'boiled_rice', name: 'Boiled rice', nameUr: 'ابلے چاول', nameUrRm: 'Uble chawal', category: 'grain', servingLabel: '1 cup cooked', servingGrams: 160, calories: 205, protein: 4, carbs: 45, fat: 0.4, fibre: 1, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'chicken_biryani', name: 'Chicken biryani', nameUr: 'چکن بریانی', category: 'composite', servingLabel: '1 plate', servingGrams: 350, calories: 620, protein: 28, carbs: 72, fat: 24, fibre: 3, isLocalStaple: true, costBand: 'medium' },
  { code: 'chicken_karahi', name: 'Chicken karahi', nameUr: 'چکن کڑاہی', category: 'poultry', servingLabel: '1 serving', servingGrams: 250, calories: 420, protein: 35, carbs: 8, fat: 28, isLocalStaple: true, costBand: 'medium' },
  { code: 'grilled_chicken', name: 'Grilled chicken breast', nameUrRm: 'Grilled chicken', category: 'poultry', servingLabel: '1 breast (150 g)', servingGrams: 150, calories: 250, protein: 46, carbs: 0, fat: 6, costBand: 'medium' },
  { code: 'chicken_tikka', name: 'Chicken tikka (boti)', nameUr: 'چکن تکہ', category: 'poultry', servingLabel: '4 pieces', servingGrams: 180, calories: 330, protein: 40, carbs: 3, fat: 17, isLocalStaple: true, costBand: 'medium' },
  { code: 'beef_nihari', name: 'Beef nihari', nameUr: 'نہاری', category: 'meat', servingLabel: '1 bowl', servingGrams: 300, calories: 540, protein: 34, carbs: 12, fat: 39, isLocalStaple: true, costBand: 'high' },
  { code: 'beef_mince', name: 'Beef keema (lean)', nameUr: 'قیمہ', nameUrRm: 'Keema', category: 'meat', servingLabel: '1 serving', servingGrams: 150, calories: 290, protein: 30, carbs: 4, fat: 17, isLocalStaple: true, costBand: 'medium' },
  { code: 'daal_chana', name: 'Chana daal', nameUr: 'چنا دال', category: 'lentil', servingLabel: '1 bowl', servingGrams: 200, calories: 230, protein: 13, carbs: 34, fat: 5, fibre: 9, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'daal_masoor', name: 'Masoor daal', nameUr: 'مسور دال', category: 'lentil', servingLabel: '1 bowl', servingGrams: 200, calories: 210, protein: 14, carbs: 32, fat: 3, fibre: 8, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'chana_chaat', name: 'Chana chaat', nameUr: 'چنا چاٹ', category: 'lentil', servingLabel: '1 bowl', servingGrams: 200, calories: 260, protein: 12, carbs: 40, fat: 6, fibre: 10, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'egg_boiled', name: 'Boiled egg', nameUr: 'ابلا انڈا', nameUrRm: 'Ubla anda', category: 'egg', servingLabel: '1 large egg', servingGrams: 55, calories: 78, protein: 6.5, carbs: 0.6, fat: 5.3, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['egg'] },
  { code: 'omelette', name: 'Omelette (2 eggs)', nameUr: 'آملیٹ', category: 'egg', servingLabel: '2 eggs', servingGrams: 120, calories: 220, protein: 14, carbs: 2, fat: 17, isVegetarian: true, costBand: 'low', allergens: ['egg'] },
  { code: 'dahi', name: 'Dahi (plain yoghurt)', nameUr: 'دہی', nameUrRm: 'Dahi', category: 'dairy', servingLabel: '1 cup', servingGrams: 200, calories: 120, protein: 10, carbs: 12, fat: 4, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['dairy'] },
  { code: 'milk', name: 'Milk (full fat)', nameUr: 'دودھ', category: 'dairy', servingLabel: '1 glass', servingGrams: 250, calories: 160, protein: 8, carbs: 12, fat: 8, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['dairy'] },
  { code: 'paneer', name: 'Paneer', nameUr: 'پنیر', category: 'dairy', servingLabel: '100 g', servingGrams: 100, calories: 265, protein: 18, carbs: 3, fat: 20, isVegetarian: true, costBand: 'medium', allergens: ['dairy'] },
  { code: 'whey_free_lassi', name: 'Salted lassi', nameUr: 'نمکین لسی', category: 'beverage', servingLabel: '1 glass', servingGrams: 300, calories: 110, protein: 7, carbs: 10, fat: 4, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['dairy'] },
  { code: 'fish_rahu', name: 'Rahu fish (grilled)', nameUr: 'رہو مچھلی', category: 'fish', servingLabel: '1 fillet', servingGrams: 150, calories: 210, protein: 32, carbs: 0, fat: 9, costBand: 'medium', allergens: ['fish'] },
  { code: 'aloo_gosht', name: 'Aloo gosht', nameUr: 'آلو گوشت', category: 'composite', servingLabel: '1 serving', servingGrams: 300, calories: 430, protein: 26, carbs: 25, fat: 25, isLocalStaple: true, costBand: 'medium' },
  { code: 'sabzi_mixed', name: 'Mixed sabzi', nameUr: 'مکس سبزی', category: 'vegetable', servingLabel: '1 bowl', servingGrams: 200, calories: 150, protein: 4, carbs: 18, fat: 7, fibre: 6, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'palak', name: 'Palak (spinach)', nameUr: 'پالک', category: 'vegetable', servingLabel: '1 bowl', servingGrams: 200, calories: 90, protein: 5, carbs: 8, fat: 4, fibre: 5, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'salad_kachumber', name: 'Kachumber salad', nameUr: 'کچومر سلاد', category: 'vegetable', servingLabel: '1 bowl', servingGrams: 150, calories: 45, protein: 2, carbs: 9, fat: 0.5, fibre: 3, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'banana', name: 'Banana', nameUr: 'کیلا', nameUrRm: 'Kela', category: 'fruit', servingLabel: '1 medium', servingGrams: 120, calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fibre: 3, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'apple', name: 'Apple', nameUr: 'سیب', category: 'fruit', servingLabel: '1 medium', servingGrams: 180, calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fibre: 4, isVegetarian: true, costBand: 'low' },
  { code: 'dates', name: 'Dates', nameUr: 'کھجور', nameUrRm: 'Khajoor', category: 'fruit', servingLabel: '3 dates', servingGrams: 60, calories: 160, protein: 1.4, carbs: 43, fat: 0.2, fibre: 4, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'almonds', name: 'Almonds', nameUr: 'بادام', category: 'nut_seed', servingLabel: '15 almonds', servingGrams: 20, calories: 116, protein: 4, carbs: 4, fat: 10, fibre: 2.5, isVegetarian: true, costBand: 'high', allergens: ['nuts'] },
  { code: 'peanut_butter', name: 'Peanut butter', category: 'nut_seed', servingLabel: '1 tbsp', servingGrams: 16, calories: 95, protein: 4, carbs: 3, fat: 8, isVegetarian: true, costBand: 'medium', allergens: ['peanut'] },
  { code: 'oats', name: 'Oats', nameUr: 'جئی', category: 'grain', servingLabel: '½ cup dry', servingGrams: 40, calories: 150, protein: 5, carbs: 27, fat: 3, fibre: 4, isVegetarian: true, costBand: 'low', allergens: ['gluten'] },
  { code: 'cooking_oil', name: 'Cooking oil', nameUr: 'تیل', category: 'oil_fat', servingLabel: '1 tbsp', servingGrams: 14, calories: 120, protein: 0, carbs: 0, fat: 14, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'ghee', name: 'Desi ghee', nameUr: 'دیسی گھی', category: 'oil_fat', servingLabel: '1 tsp', servingGrams: 5, calories: 45, protein: 0, carbs: 0, fat: 5, isVegetarian: true, isLocalStaple: true, costBand: 'medium', allergens: ['dairy'] },
  { code: 'samosa', name: 'Samosa', nameUr: 'سموسہ', category: 'snack', servingLabel: '1 samosa', servingGrams: 80, calories: 260, protein: 5, carbs: 28, fat: 14, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['gluten'] },
  { code: 'jalebi', name: 'Jalebi', nameUr: 'جلیبی', category: 'sweet', servingLabel: '2 pieces', servingGrams: 60, calories: 290, protein: 2, carbs: 55, fat: 8, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
  { code: 'chai_with_sugar', name: 'Doodh patti chai (2 tsp sugar)', nameUr: 'دودھ پتی چائے', category: 'beverage', servingLabel: '1 cup', servingGrams: 200, calories: 140, protein: 4, carbs: 18, fat: 6, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['dairy'] },
  { code: 'chai_no_sugar', name: 'Chai without sugar', category: 'beverage', servingLabel: '1 cup', servingGrams: 200, calories: 70, protein: 4, carbs: 6, fat: 4, isVegetarian: true, isLocalStaple: true, costBand: 'low', allergens: ['dairy'] },
  { code: 'water', name: 'Water', nameUr: 'پانی', category: 'beverage', servingLabel: '1 glass (250 ml)', servingGrams: 250, calories: 0, protein: 0, carbs: 0, fat: 0, isVegetarian: true, isLocalStaple: true, costBand: 'low' },
];

/** Swaps a member can actually make in a Pakistani kitchen. */
export const FOOD_SWAPS: Array<{ from: string; to: string; reason: string; note: string }> = [
  { from: 'chicken_biryani', to: 'chicken_karahi', reason: 'preference', note: 'Same protein, far less rice — pair with one roti instead.' },
  { from: 'beef_nihari', to: 'chicken_karahi', reason: 'preference', note: 'About 120 fewer calories with similar protein.' },
  { from: 'beef_mince', to: 'daal_chana', reason: 'budget', note: 'Daal is a fraction of the price and still gets you protein and fibre.' },
  { from: 'beef_mince', to: 'grilled_chicken', reason: 'higher_protein', note: 'More protein per rupee and much less fat.' },
  { from: 'naan', to: 'roti', reason: 'preference', note: 'Roti has roughly half the calories of a naan.' },
  { from: 'samosa', to: 'chana_chaat', reason: 'preference', note: 'Same street-food satisfaction, more protein and fibre.' },
  { from: 'chai_with_sugar', to: 'chai_no_sugar', reason: 'preference', note: 'Two cups a day with sugar adds up to about 140 kcal.' },
  { from: 'paneer', to: 'dahi', reason: 'budget', note: 'Cheaper daily protein for vegetarians.' },
  { from: 'almonds', to: 'peanut_butter', reason: 'budget', note: 'Similar fats at a lower cost per gram.' },
  { from: 'ghee', to: 'cooking_oil', reason: 'availability', note: 'Either is fine; measure with a spoon rather than pouring.' },
  { from: 'fish_rahu', to: 'grilled_chicken', reason: 'allergen', note: 'For members avoiding fish.' },
];

export interface SeedRecipe {
  code: string;
  name: string;
  nameUr?: string;
  description: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  mealSlot: string;
  isVegetarian?: boolean;
  costBand: 'low' | 'medium' | 'high';
  methodSteps: string[];
  items: Array<{ food: string; servings: number }>;
}

export const RECIPES: SeedRecipe[] = [
  {
    code: 'high_protein_sehri',
    name: 'High-protein sehri bowl',
    nameUr: 'ہائی پروٹین سحری',
    description: 'Keeps you full through the fasting day: slow carbs, protein and enough fat.',
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 10,
    mealSlot: 'sehri',
    isVegetarian: true,
    costBand: 'low',
    methodSteps: [
      'Cook the oats in milk on a low flame.',
      'Stir in the peanut butter and top with sliced banana.',
      'Have the yoghurt alongside, and finish a full glass of water.',
    ],
    items: [
      { food: 'oats', servings: 1 },
      { food: 'milk', servings: 1 },
      { food: 'peanut_butter', servings: 1 },
      { food: 'banana', servings: 1 },
      { food: 'dahi', servings: 0.5 },
    ],
  },
  {
    code: 'balanced_iftar',
    name: 'Balanced iftar plate',
    nameUr: 'متوازن افطار',
    description: 'Break the fast gently, then eat a proper balanced plate rather than a fried one.',
    servings: 1,
    prepMinutes: 10,
    cookMinutes: 20,
    mealSlot: 'iftar',
    costBand: 'medium',
    methodSteps: [
      'Break your fast with dates and water, then pray before eating the main plate.',
      'Grill the chicken with your usual masala.',
      'Serve with one roti, a bowl of sabzi and kachumber salad.',
      'Keep drinking water through the evening.',
    ],
    items: [
      { food: 'dates', servings: 1 },
      { food: 'grilled_chicken', servings: 1 },
      { food: 'roti', servings: 1 },
      { food: 'sabzi_mixed', servings: 1 },
      { food: 'salad_kachumber', servings: 1 },
    ],
  },
  {
    code: 'budget_protein_plate',
    name: 'Budget protein plate',
    description: 'Around 30 g of protein without meat — the cheapest reliable way to hit your target.',
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 25,
    mealSlot: 'lunch',
    isVegetarian: true,
    costBand: 'low',
    methodSteps: [
      'Cook the daal with garlic, tomato and your usual spices.',
      'Serve with one roti and a bowl of dahi.',
      'Add salad to fill the plate without adding much.',
    ],
    items: [
      { food: 'daal_masoor', servings: 1 },
      { food: 'roti', servings: 1 },
      { food: 'dahi', servings: 1 },
      { food: 'salad_kachumber', servings: 1 },
    ],
  },
  {
    code: 'post_workout_desi',
    name: 'Post-workout desi plate',
    description: 'What to eat after training when you want to build muscle.',
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 15,
    mealSlot: 'post_workout',
    costBand: 'medium',
    methodSteps: [
      'Grill or pan-cook the chicken tikka pieces.',
      'Serve with rice and salad.',
      'Have a glass of lassi if you struggle to eat enough.',
    ],
    items: [
      { food: 'chicken_tikka', servings: 1 },
      { food: 'boiled_rice', servings: 1 },
      { food: 'salad_kachumber', servings: 1 },
      { food: 'whey_free_lassi', servings: 1 },
    ],
  },
  {
    code: 'fat_loss_dinner',
    name: 'Fat-loss friendly dinner',
    description: 'Big volume, high protein, low calories. You will not feel like you are dieting.',
    servings: 1,
    prepMinutes: 10,
    cookMinutes: 20,
    mealSlot: 'dinner',
    costBand: 'medium',
    methodSteps: [
      'Cook the karahi with a measured tablespoon of oil rather than a free pour.',
      'Fill half the plate with sabzi and salad first.',
      'Add one roti — not two.',
    ],
    items: [
      { food: 'chicken_karahi', servings: 0.7 },
      { food: 'sabzi_mixed', servings: 1 },
      { food: 'salad_kachumber', servings: 1 },
      { food: 'roti', servings: 1 },
    ],
  },
  {
    code: 'weight_gain_breakfast',
    name: 'Weight-gain breakfast',
    description: 'For members who struggle to eat enough. Calorie-dense but not junk.',
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 10,
    mealSlot: 'breakfast',
    isVegetarian: true,
    costBand: 'medium',
    methodSteps: [
      'Make a two-egg omelette with a little oil.',
      'Serve with two rotis and a glass of full-fat milk.',
      'Add a banana if you can manage it.',
    ],
    items: [
      { food: 'omelette', servings: 1 },
      { food: 'roti', servings: 2 },
      { food: 'milk', servings: 1 },
      { food: 'banana', servings: 1 },
    ],
  },
];
