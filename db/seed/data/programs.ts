/**
 * Approved program templates.
 *
 * Programs are the only source of member workouts. Each has phases, and each
 * phase repeats its day pattern for the number of weeks declared, with the
 * progression rule applied by the coaching engine — not by free-form generation.
 */

export interface SeedWorkoutItem {
  exercise: string;
  sets: number;
  repsMin?: number;
  repsMax?: number;
  seconds?: number;
  rpe?: number;
  restSeconds?: number;
  tempo?: string;
  loadGuidance?: string;
  startingLoadKg?: number;
  memberNote?: string;
  allowSubstitution?: boolean;
}

export interface SeedWorkoutBlock {
  kind: 'warmup' | 'main' | 'superset' | 'circuit' | 'finisher' | 'cooldown';
  label: string;
  rounds?: number;
  instructions?: string;
  items: SeedWorkoutItem[];
}

export interface SeedWorkout {
  code: string;
  name: string;
  focus: string;
  estimatedMinutes: number;
  difficulty: 'first_time' | 'beginner' | 'intermediate' | 'advanced';
  effortScale: 'rpe' | 'rir' | 'simple';
  memberIntro: string;
  coachNotes?: string;
  blocks: SeedWorkoutBlock[];
}

export interface SeedProgramPhase {
  name: string;
  focus: string;
  weeks: number;
  progressionRule: 'double_progression' | 'linear_load' | 'rep_progression' | 'rpe_autoregulated' | 'none';
  deloadAtEnd?: boolean;
  memberSummary: string;
  /** dayNumber (1 = Monday) → workout code, or null for a rest day. */
  days: Record<number, string | null>;
}

export interface SeedProgram {
  code: string;
  name: string;
  summary: string;
  intent: string;
  goal: string;
  experienceLevel: 'first_time' | 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  sessionMinutes: number;
  totalWeeks: number;
  requiresEquipmentCodes: string[];
  lowImpact?: boolean;
  ramadanFriendly?: boolean;
  contraindications?: string[];
  phases: SeedProgramPhase[];
}

const WARMUP_GENERAL: SeedWorkoutBlock = {
  kind: 'warmup',
  label: 'Warm-up',
  instructions: 'Five easy minutes. The goal is warm, not tired.',
  items: [
    { exercise: 'treadmill_walk', sets: 1, seconds: 300, memberNote: 'Brisk walk, you should still be able to talk.' },
    { exercise: 'cat_cow', sets: 1, repsMin: 8, repsMax: 8 },
    { exercise: 'band_pull_apart', sets: 2, repsMin: 12, repsMax: 15 },
  ],
};

const COOLDOWN_GENERAL: SeedWorkoutBlock = {
  kind: 'cooldown',
  label: 'Cool-down',
  instructions: 'Slow your breathing down. Three minutes is enough.',
  items: [
    { exercise: 'hip_flexor_stretch', sets: 1, seconds: 60, memberNote: '30 seconds each side.' },
    { exercise: 'cat_cow', sets: 1, repsMin: 6, repsMax: 8 },
  ],
};

export const WORKOUTS: SeedWorkout[] = [
  // --- Beginner induction ---------------------------------------------------
  {
    code: 'induction_a',
    name: 'Induction A — Learn the basics',
    focus: 'full_body',
    estimatedMinutes: 35,
    difficulty: 'first_time',
    effortScale: 'simple',
    memberIntro:
      'Your first session. We are learning movements, not chasing weights. If something is confusing, tap the video — and any staff member will happily show you.',
    coachNotes: 'Keep loads very light. Watch the hinge pattern especially.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main work',
        items: [
          { exercise: 'bodyweight_squat', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 60, memberNote: 'Sit back like there is a chair behind you.' },
          { exercise: 'push_up', sets: 3, repsMin: 5, repsMax: 10, restSeconds: 60, memberNote: 'Hands on a bench is a perfectly good version.' },
          { exercise: 'seated_cable_row', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 75, startingLoadKg: 15 },
          { exercise: 'glute_bridge', sets: 2, repsMin: 12, repsMax: 15, restSeconds: 45 },
          { exercise: 'dead_bug', sets: 2, repsMin: 8, repsMax: 10, restSeconds: 45, memberNote: 'Slow. Keep your lower back flat.' },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'induction_b',
    name: 'Induction B — Build the habit',
    focus: 'full_body',
    estimatedMinutes: 35,
    difficulty: 'first_time',
    effortScale: 'simple',
    memberIntro: 'Second session of the week. Same idea: smooth reps, easy weights, finish feeling like you could do more.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main work',
        items: [
          { exercise: 'goblet_squat', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 75, startingLoadKg: 8 },
          { exercise: 'dumbbell_rdl', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 75, startingLoadKg: 8, memberNote: 'Hips back, feel it behind your knees.' },
          { exercise: 'lat_pulldown', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 75, startingLoadKg: 20 },
          { exercise: 'dumbbell_shoulder_press', sets: 2, repsMin: 8, repsMax: 12, restSeconds: 60, startingLoadKg: 5 },
          { exercise: 'plank', sets: 3, seconds: 20, restSeconds: 45, memberNote: 'Stop as soon as your hips start to sag.' },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },

  // --- Fat loss -------------------------------------------------------------
  {
    code: 'fatloss_full_a',
    name: 'Full Body A',
    focus: 'full_body',
    estimatedMinutes: 45,
    difficulty: 'beginner',
    effortScale: 'rpe',
    memberIntro: 'Strength first, then a short conditioning finisher. Keeping muscle is what makes fat loss look good.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Strength',
        items: [
          { exercise: 'goblet_squat', sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 12 },
          { exercise: 'dumbbell_bench_press', sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 10 },
          { exercise: 'seated_cable_row', sets: 3, repsMin: 10, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 25 },
        ],
      },
      {
        kind: 'circuit',
        label: 'Conditioning finisher',
        rounds: 3,
        instructions: 'Three rounds, minimal rest between exercises, 60 seconds between rounds.',
        items: [
          { exercise: 'kettlebell_swing', sets: 1, repsMin: 12, repsMax: 15, startingLoadKg: 12 },
          { exercise: 'farmer_carry', sets: 1, seconds: 40, startingLoadKg: 16 },
          { exercise: 'plank', sets: 1, seconds: 30 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'fatloss_full_b',
    name: 'Full Body B',
    focus: 'full_body',
    estimatedMinutes: 45,
    difficulty: 'beginner',
    effortScale: 'rpe',
    memberIntro: 'Same structure, different movements. Aim to beat last week by one rep or a small step in weight.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Strength',
        items: [
          { exercise: 'romanian_deadlift', sets: 3, repsMin: 8, repsMax: 10, rpe: 7, restSeconds: 120, startingLoadKg: 30 },
          { exercise: 'lat_pulldown', sets: 3, repsMin: 10, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 30 },
          { exercise: 'dumbbell_shoulder_press', sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 8 },
          { exercise: 'walking_lunge', sets: 2, repsMin: 10, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 8, memberNote: 'Reps per leg.' },
        ],
      },
      {
        kind: 'finisher',
        label: 'Steady cardio',
        items: [{ exercise: 'stationary_bike', sets: 1, seconds: 600, memberNote: 'Ten easy minutes. Conversation pace.' }],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'fatloss_full_c',
    name: 'Full Body C',
    focus: 'full_body',
    estimatedMinutes: 45,
    difficulty: 'beginner',
    effortScale: 'rpe',
    memberIntro: 'The third session of your week. Slightly more upper body, plus core.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Strength',
        items: [
          { exercise: 'leg_press', sets: 3, repsMin: 10, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 60 },
          { exercise: 'push_up', sets: 3, repsMin: 8, repsMax: 15, rpe: 8, restSeconds: 75 },
          { exercise: 'dumbbell_row', sets: 3, repsMin: 10, repsMax: 12, rpe: 7, restSeconds: 75, startingLoadKg: 12 },
          { exercise: 'face_pull', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60, startingLoadKg: 10 },
          { exercise: 'pallof_press', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 60, startingLoadKg: 10, memberNote: 'Reps per side.' },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },

  // --- Hypertrophy ----------------------------------------------------------
  {
    code: 'hyper_upper_a',
    name: 'Upper Body A — Push focus',
    focus: 'upper_push',
    estimatedMinutes: 60,
    difficulty: 'intermediate',
    effortScale: 'rpe',
    memberIntro: 'Push day. Leave one or two reps in reserve on everything except the last set.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main lifts',
        items: [
          { exercise: 'bench_press', sets: 4, repsMin: 6, repsMax: 8, rpe: 8, restSeconds: 180, startingLoadKg: 50 },
          { exercise: 'overhead_press', sets: 3, repsMin: 6, repsMax: 10, rpe: 8, restSeconds: 150, startingLoadKg: 30 },
        ],
      },
      {
        kind: 'superset',
        label: 'Accessory superset',
        rounds: 3,
        instructions: 'Alternate between the two with 60 seconds rest.',
        items: [
          { exercise: 'incline_dumbbell_press', sets: 1, repsMin: 10, repsMax: 12, rpe: 8, startingLoadKg: 18 },
          { exercise: 'lateral_raise', sets: 1, repsMin: 12, repsMax: 15, rpe: 8, startingLoadKg: 6 },
        ],
      },
      {
        kind: 'main',
        label: 'Arms',
        items: [{ exercise: 'triceps_pushdown', sets: 3, repsMin: 10, repsMax: 15, rpe: 8, restSeconds: 60, startingLoadKg: 20 }],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'hyper_lower_a',
    name: 'Lower Body A — Squat focus',
    focus: 'lower',
    estimatedMinutes: 60,
    difficulty: 'intermediate',
    effortScale: 'rpe',
    memberIntro: 'Legs. Take the full rest between the heavy sets — it is part of the session, not a break from it.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main lifts',
        items: [
          { exercise: 'barbell_back_squat', sets: 4, repsMin: 5, repsMax: 8, rpe: 8, restSeconds: 180, startingLoadKg: 60 },
          { exercise: 'romanian_deadlift', sets: 3, repsMin: 8, repsMax: 10, rpe: 7, restSeconds: 150, startingLoadKg: 50 },
        ],
      },
      {
        kind: 'main',
        label: 'Accessories',
        items: [
          { exercise: 'leg_curl', sets: 3, repsMin: 10, repsMax: 12, rpe: 8, restSeconds: 75, startingLoadKg: 25 },
          { exercise: 'walking_lunge', sets: 3, repsMin: 10, repsMax: 12, rpe: 7, restSeconds: 90, startingLoadKg: 12 },
          { exercise: 'calf_raise', sets: 3, repsMin: 12, repsMax: 20, restSeconds: 45 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'hyper_upper_b',
    name: 'Upper Body B — Pull focus',
    focus: 'upper_pull',
    estimatedMinutes: 60,
    difficulty: 'intermediate',
    effortScale: 'rpe',
    memberIntro: 'Pull day. Think about the muscle doing the work rather than just moving the weight.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main lifts',
        items: [
          { exercise: 'assisted_pull_up', sets: 4, repsMin: 5, repsMax: 8, rpe: 8, restSeconds: 150 },
          { exercise: 'seated_cable_row', sets: 4, repsMin: 8, repsMax: 12, rpe: 8, restSeconds: 120, startingLoadKg: 45 },
        ],
      },
      {
        kind: 'superset',
        label: 'Accessory superset',
        rounds: 3,
        items: [
          { exercise: 'face_pull', sets: 1, repsMin: 12, repsMax: 15, startingLoadKg: 15 },
          { exercise: 'biceps_curl', sets: 1, repsMin: 10, repsMax: 12, startingLoadKg: 10 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'hyper_lower_b',
    name: 'Lower Body B — Hinge focus',
    focus: 'lower',
    estimatedMinutes: 60,
    difficulty: 'intermediate',
    effortScale: 'rpe',
    memberIntro: 'Posterior chain day. Glutes and hamstrings do most of the work.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main lifts',
        items: [
          { exercise: 'hip_thrust', sets: 4, repsMin: 8, repsMax: 12, rpe: 8, restSeconds: 120, startingLoadKg: 50 },
          { exercise: 'leg_press', sets: 4, repsMin: 10, repsMax: 12, rpe: 8, restSeconds: 120, startingLoadKg: 90 },
        ],
      },
      {
        kind: 'main',
        label: 'Accessories',
        items: [
          { exercise: 'leg_curl', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 75, startingLoadKg: 25 },
          { exercise: 'split_squat', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 75, startingLoadKg: 10 },
          { exercise: 'plank', sets: 3, seconds: 45, restSeconds: 45 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },

  // --- Strength -------------------------------------------------------------
  {
    code: 'strength_squat_day',
    name: 'Strength — Squat',
    focus: 'lower',
    estimatedMinutes: 55,
    difficulty: 'intermediate',
    effortScale: 'rpe',
    memberIntro: 'Heavy but controlled. Every rep should look the same as the first.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main lift',
        items: [{ exercise: 'barbell_back_squat', sets: 5, repsMin: 3, repsMax: 5, rpe: 8, restSeconds: 240, startingLoadKg: 80, tempo: '2-1-1' }],
      },
      {
        kind: 'main',
        label: 'Support work',
        items: [
          { exercise: 'romanian_deadlift', sets: 3, repsMin: 6, repsMax: 8, rpe: 7, restSeconds: 150, startingLoadKg: 60 },
          { exercise: 'plank', sets: 3, seconds: 45, restSeconds: 60 },
          { exercise: 'farmer_carry', sets: 3, seconds: 40, restSeconds: 90, startingLoadKg: 24 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'strength_press_day',
    name: 'Strength — Press',
    focus: 'upper_push',
    estimatedMinutes: 55,
    difficulty: 'intermediate',
    effortScale: 'rpe',
    memberIntro: 'Bench and overhead work. Use the safety arms — always.',
    blocks: [
      WARMUP_GENERAL,
      {
        kind: 'main',
        label: 'Main lift',
        items: [{ exercise: 'bench_press', sets: 5, repsMin: 3, repsMax: 5, rpe: 8, restSeconds: 240, startingLoadKg: 60 }],
      },
      {
        kind: 'main',
        label: 'Support work',
        items: [
          { exercise: 'overhead_press', sets: 3, repsMin: 5, repsMax: 8, rpe: 7, restSeconds: 150, startingLoadKg: 35 },
          { exercise: 'dumbbell_row', sets: 4, repsMin: 8, repsMax: 10, rpe: 7, restSeconds: 90, startingLoadKg: 22 },
          { exercise: 'triceps_pushdown', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60, startingLoadKg: 25 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },

  // --- Low impact / recovery -----------------------------------------------
  {
    code: 'lowimpact_full',
    name: 'Low Impact Full Body',
    focus: 'full_body',
    estimatedMinutes: 40,
    difficulty: 'beginner',
    effortScale: 'simple',
    memberIntro:
      'Joint-friendly session: seated and supported movements, no jumping or heavy spinal loading. Should feel like solid work, never sharp.',
    blocks: [
      {
        kind: 'warmup',
        label: 'Warm-up',
        items: [
          { exercise: 'stationary_bike', sets: 1, seconds: 300 },
          { exercise: 'cat_cow', sets: 1, repsMin: 8, repsMax: 10 },
        ],
      },
      {
        kind: 'main',
        label: 'Main work',
        items: [
          { exercise: 'leg_press', sets: 3, repsMin: 10, repsMax: 15, restSeconds: 90, startingLoadKg: 40 },
          { exercise: 'seated_cable_row', sets: 3, repsMin: 10, repsMax: 15, restSeconds: 75, startingLoadKg: 20 },
          { exercise: 'dumbbell_shoulder_press', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 75, startingLoadKg: 5 },
          { exercise: 'glute_bridge', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60 },
          { exercise: 'dead_bug', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 45 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'home_full_body',
    name: 'Home Full Body',
    focus: 'full_body',
    estimatedMinutes: 30,
    difficulty: 'first_time',
    effortScale: 'simple',
    memberIntro: 'No equipment needed. Perfect for the days you cannot get to the branch.',
    blocks: [
      {
        kind: 'warmup',
        label: 'Warm-up',
        items: [{ exercise: 'cat_cow', sets: 1, repsMin: 10, repsMax: 10 }],
      },
      {
        kind: 'circuit',
        label: 'Circuit',
        rounds: 3,
        instructions: 'Three rounds. Rest 60 seconds between rounds.',
        items: [
          { exercise: 'bodyweight_squat', sets: 1, repsMin: 12, repsMax: 15 },
          { exercise: 'push_up', sets: 1, repsMin: 6, repsMax: 12 },
          { exercise: 'glute_bridge', sets: 1, repsMin: 15, repsMax: 20 },
          { exercise: 'plank', sets: 1, seconds: 30 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
  {
    code: 'ramadan_maintain',
    name: 'Ramadan Maintenance',
    focus: 'full_body',
    estimatedMinutes: 35,
    difficulty: 'beginner',
    effortScale: 'simple',
    memberIntro:
      'Shorter and lighter by design. During Ramadan the aim is to keep what you have built, not to chase records. Train after iftar if you can.',
    coachNotes: 'Volume reduced ~40%. Watch hydration and do not progress load during fasting weeks.',
    blocks: [
      {
        kind: 'warmup',
        label: 'Warm-up',
        items: [{ exercise: 'stationary_bike', sets: 1, seconds: 240 }],
      },
      {
        kind: 'main',
        label: 'Main work',
        items: [
          { exercise: 'goblet_squat', sets: 2, repsMin: 8, repsMax: 10, restSeconds: 90, startingLoadKg: 10 },
          { exercise: 'dumbbell_bench_press', sets: 2, repsMin: 8, repsMax: 10, restSeconds: 90, startingLoadKg: 12 },
          { exercise: 'lat_pulldown', sets: 2, repsMin: 10, repsMax: 12, restSeconds: 90, startingLoadKg: 25 },
          { exercise: 'plank', sets: 2, seconds: 30, restSeconds: 45 },
        ],
      },
      COOLDOWN_GENERAL,
    ],
  },
];

export const PROGRAMS: SeedProgram[] = [
  {
    code: 'beginner_induction_2d',
    name: 'Gym Induction — First 4 Weeks',
    summary:
      'For members who have never trained before. Two short sessions a week that teach the basic movements and build the habit of showing up.',
    intent: 'beginner_induction',
    goal: 'beginner_confidence',
    experienceLevel: 'first_time',
    daysPerWeek: 2,
    sessionMinutes: 35,
    totalWeeks: 4,
    requiresEquipmentCodes: ['dumbbell', 'cable', 'treadmill'],
    lowImpact: true,
    ramadanFriendly: true,
    phases: [
      {
        name: 'Learn the movements',
        focus: 'technique',
        weeks: 4,
        progressionRule: 'rep_progression',
        memberSummary:
          'Four weeks to get comfortable. We add reps before we add weight, so nothing ever feels like a jump.',
        days: { 1: 'induction_a', 2: null, 3: null, 4: 'induction_b', 5: null, 6: null, 7: null },
      },
    ],
  },
  {
    code: 'fat_loss_3d',
    name: 'Fat Loss — 3 Day Full Body',
    summary:
      'Three full-body sessions a week that keep muscle while you lose fat, with a short conditioning finisher and clear nutrition guidance alongside.',
    intent: 'fat_loss',
    goal: 'fat_loss',
    experienceLevel: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
    totalWeeks: 12,
    requiresEquipmentCodes: ['dumbbell', 'cable', 'barbell', 'kettlebell', 'bike'],
    ramadanFriendly: false,
    phases: [
      {
        name: 'Base',
        focus: 'build the habit',
        weeks: 4,
        progressionRule: 'double_progression',
        memberSummary: 'Learn the lifts and get consistent. Add a rep whenever the last set felt easy.',
        days: { 1: 'fatloss_full_a', 2: null, 3: 'fatloss_full_b', 4: null, 5: 'fatloss_full_c', 6: null, 7: null },
      },
      {
        name: 'Build',
        focus: 'add work capacity',
        weeks: 6,
        progressionRule: 'double_progression',
        deloadAtEnd: true,
        memberSummary: 'Same sessions, more weight on the bar. The finisher gets slightly longer.',
        days: { 1: 'fatloss_full_a', 2: null, 3: 'fatloss_full_b', 4: null, 5: 'fatloss_full_c', 6: null, 7: null },
      },
      {
        name: 'Consolidate',
        focus: 'lock in the results',
        weeks: 2,
        progressionRule: 'none',
        memberSummary: 'A lighter fortnight to let your body catch up before the next block.',
        days: { 1: 'fatloss_full_a', 2: null, 3: null, 4: 'fatloss_full_c', 5: null, 6: null, 7: null },
      },
    ],
  },
  {
    code: 'hypertrophy_4d',
    name: 'Muscle Gain — 4 Day Upper/Lower',
    summary:
      'A classic upper/lower split for members who have trained before and want visible size. Four sessions a week, around an hour each.',
    intent: 'hypertrophy',
    goal: 'muscle_gain',
    experienceLevel: 'intermediate',
    daysPerWeek: 4,
    sessionMinutes: 60,
    totalWeeks: 12,
    requiresEquipmentCodes: ['barbell', 'rack', 'bench', 'dumbbell', 'cable', 'leg_curl'],
    contraindications: ['heart_condition'],
    phases: [
      {
        name: 'Accumulation',
        focus: 'volume',
        weeks: 6,
        progressionRule: 'double_progression',
        memberSummary: 'Build the volume up. Beat last week by a rep or a small step in weight.',
        days: { 1: 'hyper_upper_a', 2: 'hyper_lower_a', 3: null, 4: 'hyper_upper_b', 5: 'hyper_lower_b', 6: null, 7: null },
      },
      {
        name: 'Intensification',
        focus: 'heavier work',
        weeks: 5,
        progressionRule: 'rpe_autoregulated',
        deloadAtEnd: true,
        memberSummary: 'Slightly fewer reps, slightly heavier. Effort is capped at RPE 8 on purpose.',
        days: { 1: 'hyper_upper_a', 2: 'hyper_lower_a', 3: null, 4: 'hyper_upper_b', 5: 'hyper_lower_b', 6: null, 7: null },
      },
      {
        name: 'Deload',
        focus: 'recover',
        weeks: 1,
        progressionRule: 'none',
        memberSummary: 'One easy week. This is where the growth actually shows up.',
        days: { 1: 'hyper_upper_a', 2: null, 3: 'hyper_lower_a', 4: null, 5: null, 6: null, 7: null },
      },
    ],
  },
  {
    code: 'strength_3d',
    name: 'Strength — 3 Day Barbell',
    summary: 'Squat, bench and press focused programming for members who want to get measurably stronger.',
    intent: 'strength',
    goal: 'strength',
    experienceLevel: 'intermediate',
    daysPerWeek: 3,
    sessionMinutes: 55,
    totalWeeks: 8,
    requiresEquipmentCodes: ['barbell', 'rack', 'bench', 'dumbbell'],
    contraindications: ['back_problem', 'heart_condition'],
    phases: [
      {
        name: 'Base strength',
        focus: 'heavy triples and fives',
        weeks: 8,
        progressionRule: 'linear_load',
        deloadAtEnd: true,
        memberSummary: 'Add a small amount of weight each week for as long as the reps stay clean.',
        days: { 1: 'strength_squat_day', 2: null, 3: 'strength_press_day', 4: null, 5: 'strength_squat_day', 6: null, 7: null },
      },
    ],
  },
  {
    code: 'low_impact_3d',
    name: 'Low Impact Strength',
    summary:
      'Joint-friendly strength work for members returning from injury, managing a condition, or starting later in life. Nothing jumps, nothing loads the spine heavily.',
    intent: 'low_impact',
    goal: 'general_fitness',
    experienceLevel: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 40,
    totalWeeks: 8,
    requiresEquipmentCodes: ['leg_press', 'cable', 'dumbbell', 'bike'],
    lowImpact: true,
    ramadanFriendly: true,
    phases: [
      {
        name: 'Rebuild',
        focus: 'controlled strength',
        weeks: 8,
        progressionRule: 'rep_progression',
        memberSummary: 'Steady, controlled work. We add reps first and only then a little weight.',
        days: { 1: 'lowimpact_full', 2: null, 3: 'lowimpact_full', 4: null, 5: 'lowimpact_full', 6: null, 7: null },
      },
    ],
  },
  {
    code: 'home_hybrid_3d',
    name: 'Home & Gym Hybrid',
    summary: 'Two gym sessions and one home session a week, for members with an unpredictable schedule.',
    intent: 'hybrid',
    goal: 'general_fitness',
    experienceLevel: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 40,
    totalWeeks: 8,
    requiresEquipmentCodes: ['dumbbell', 'cable'],
    ramadanFriendly: true,
    phases: [
      {
        name: 'Consistency',
        focus: 'never miss twice',
        weeks: 8,
        progressionRule: 'double_progression',
        memberSummary: 'Two gym days, one home day. The home session means a busy week is not a lost week.',
        days: { 1: 'fatloss_full_a', 2: null, 3: 'home_full_body', 4: null, 5: 'fatloss_full_c', 6: null, 7: null },
      },
    ],
  },
  {
    code: 'ramadan_maintain_2d',
    name: 'Ramadan Maintenance',
    summary:
      'Two shorter sessions a week during Ramadan, scheduled after iftar, with reduced volume and no load progression while fasting.',
    intent: 'ramadan',
    goal: 'maintenance',
    experienceLevel: 'beginner',
    daysPerWeek: 2,
    sessionMinutes: 35,
    totalWeeks: 5,
    requiresEquipmentCodes: ['dumbbell', 'cable', 'bike'],
    lowImpact: true,
    ramadanFriendly: true,
    phases: [
      {
        name: 'Maintain',
        focus: 'hold your strength',
        weeks: 5,
        progressionRule: 'none',
        memberSummary:
          'Keep what you built. No records this month — turning up twice a week is the win.',
        days: { 1: 'ramadan_maintain', 2: null, 3: null, 4: 'ramadan_maintain', 5: null, 6: null, 7: null },
      },
    ],
  },
];
