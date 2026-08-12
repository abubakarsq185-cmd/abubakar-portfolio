/**
 * The demo cast: staff, members and the gym's own membership plans.
 * Kept separate from the seeder so both seed.ts and operations.ts can use it.
 */
export interface StaffSpec {
  key: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  branch: 'gulberg' | 'dha' | null;
  jobTitle: string;
  locale?: 'en' | 'ur' | 'ur_rm';
}

export const STAFF: StaffSpec[] = [
  { key: 'owner', name: 'Imran Sheikh', email: 'owner@apexfitness.pk', phone: '+923004567890', role: 'gym_owner', branch: null, jobTitle: 'Founder & Owner' },
  { key: 'manager_gulberg', name: 'Sadia Rehman', email: 'manager.gulberg@apexfitness.pk', phone: '+923004567891', role: 'branch_manager', branch: 'gulberg', jobTitle: 'Branch Manager' },
  { key: 'manager_dha', name: 'Faisal Qureshi', email: 'manager.dha@apexfitness.pk', phone: '+923004567892', role: 'branch_manager', branch: 'dha', jobTitle: 'Branch Manager' },
  { key: 'coach_hassan', name: 'Hassan Ali', email: 'coach@apexfitness.pk', phone: '+923004567893', role: 'coach', branch: 'gulberg', jobTitle: 'Head Coach' },
  { key: 'coach_ayesha', name: 'Ayesha Farooq', email: 'coach.ayesha@apexfitness.pk', phone: '+923004567894', role: 'coach', branch: 'gulberg', jobTitle: 'Strength Coach' },
  { key: 'coach_bilal', name: 'Bilal Nadeem', email: 'coach.dha@apexfitness.pk', phone: '+923004567895', role: 'coach', branch: 'dha', jobTitle: 'Coach' },
  { key: 'front_desk_zoya', name: 'Zoya Ahmed', email: 'frontdesk@apexfitness.pk', phone: '+923004567896', role: 'front_desk', branch: 'gulberg', jobTitle: 'Front Desk' },
  { key: 'front_desk_umar', name: 'Umar Farooq', email: 'frontdesk.dha@apexfitness.pk', phone: '+923004567897', role: 'front_desk', branch: 'dha', jobTitle: 'Front Desk' },
  { key: 'nutritionist', name: 'Mahnoor Siddiqui', email: 'nutrition@apexfitness.pk', phone: '+923004567898', role: 'nutrition_professional', branch: null, jobTitle: 'Registered Nutritionist' },
];

export interface MemberSpec {
  key: string;
  name: string;
  email: string;
  phone: string;
  gender: 'male' | 'female';
  dob: string;
  branch: 'gulberg' | 'dha';
  goal: string;
  experience: 'first_time' | 'beginner' | 'intermediate' | 'advanced';
  coach: string;
  program: string | null;
  planCode: string;
  joinedDaysAgo: number;
  /** 0–1, drives how much of the plan actually got done. */
  adherence: number;
  lifecycle: string;
  heightCm: number;
  startWeightKg: number;
  currentWeightKg: number;
  locale: 'en' | 'ur' | 'ur_rm';
  ramadanMode?: boolean;
  onboardingComplete?: boolean;
  conditions?: string[];
  painAreas?: string[];
  redFlag?: 'pregnancy_postpartum' | 'sharp_or_worsening_pain' | null;
  membershipState?: string;
  overdue?: boolean;
  guardian?: string;
  notes?: string;
}

export const MEMBERS: MemberSpec[] = [
  {
    key: 'ayesha', name: 'Ayesha Khan', email: 'ayesha.khan@example.com', phone: '+923214567001', gender: 'female', dob: '1994-03-18',
    branch: 'gulberg', goal: 'fat_loss', experience: 'beginner', coach: 'coach_ayesha', program: 'fat_loss_3d', planCode: 'gold_monthly',
    joinedDaysAgo: 128, adherence: 0.86, lifecycle: 'active', heightCm: 163, startWeightKg: 78.4, currentWeightKg: 72.1, locale: 'en',
    notes: 'Wants to feel strong at her sister’s wedding in December. Very consistent.',
  },
  {
    key: 'bilal', name: 'Bilal Ahmed', email: 'bilal.ahmed@example.com', phone: '+923214567002', gender: 'male', dob: '1997-11-02',
    branch: 'gulberg', goal: 'muscle_gain', experience: 'intermediate', coach: 'coach_hassan', program: 'hypertrophy_4d', planCode: 'platinum_monthly',
    joinedDaysAgo: 210, adherence: 0.92, lifecycle: 'active', heightCm: 178, startWeightKg: 68.0, currentWeightKg: 74.6, locale: 'en',
    notes: 'Training four years. Wants to bench bodyweight × 1.2 by year end.',
  },
  {
    key: 'fatima', name: 'Fatima Sheikh', email: 'fatima.sheikh@example.com', phone: '+923214567003', gender: 'female', dob: '2001-06-27',
    branch: 'gulberg', goal: 'beginner_confidence', experience: 'first_time', coach: 'coach_ayesha', program: 'beginner_induction_2d', planCode: 'silver_monthly',
    joinedDaysAgo: 9, adherence: 0.6, lifecycle: 'active', heightCm: 158, startWeightKg: 61.2, currentWeightKg: 61.0, locale: 'ur_rm',
    notes: 'First time in a gym. Nervous about the weights area — pair with an induction session.',
  },
  {
    key: 'usman', name: 'Usman Tariq', email: 'usman.tariq@example.com', phone: '+923214567004', gender: 'male', dob: '1991-01-14',
    branch: 'gulberg', goal: 'strength', experience: 'advanced', coach: 'coach_hassan', program: 'strength_3d', planCode: 'platinum_monthly',
    joinedDaysAgo: 320, adherence: 0.88, lifecycle: 'active', heightCm: 182, startWeightKg: 86.0, currentWeightKg: 88.4, locale: 'en',
    notes: 'Competes in local powerlifting meets. Knows what he is doing.',
  },
  {
    key: 'zainab', name: 'Zainab Malik', email: 'zainab.malik@example.com', phone: '+923214567005', gender: 'female', dob: '1993-09-05',
    branch: 'gulberg', goal: 'general_fitness', experience: 'beginner', coach: 'coach_ayesha', program: 'low_impact_3d', planCode: 'gold_monthly',
    joinedDaysAgo: 46, adherence: 0.74, lifecycle: 'active', heightCm: 166, startWeightKg: 70.5, currentWeightKg: 69.2, locale: 'en',
    redFlag: 'pregnancy_postpartum',
    notes: 'Five months postpartum, cleared by her doctor for light training. Low impact only.',
  },
  {
    key: 'hamza', name: 'Hamza Raza', email: 'hamza.raza@example.com', phone: '+923214567006', gender: 'male', dob: '1989-07-30',
    branch: 'gulberg', goal: 'fat_loss', experience: 'beginner', coach: 'coach_hassan', program: 'fat_loss_3d', planCode: 'silver_monthly',
    joinedDaysAgo: 96, adherence: 0.18, lifecycle: 'active', heightCm: 175, startWeightKg: 94.8, currentWeightKg: 94.1, locale: 'ur_rm',
    notes: 'Started well then stopped coming. Works long shifts. Needs a shorter plan, not a lecture.',
  },
  {
    key: 'sana', name: 'Sana Iqbal', email: 'sana.iqbal@example.com', phone: '+923214567007', gender: 'female', dob: '1996-12-11',
    branch: 'gulberg', goal: 'recomposition', experience: 'intermediate', coach: 'coach_ayesha', program: 'hypertrophy_4d', planCode: 'gold_monthly',
    joinedDaysAgo: 175, adherence: 0.79, lifecycle: 'active', heightCm: 169, startWeightKg: 64.0, currentWeightKg: 63.2, locale: 'en',
  },
  {
    key: 'ali', name: 'Ali Hassan', email: 'ali.hassan@example.com', phone: '+923214567008', gender: 'male', dob: '2002-02-19',
    branch: 'gulberg', goal: 'weight_gain', experience: 'beginner', coach: 'coach_hassan', program: 'hypertrophy_4d', planCode: 'gold_monthly',
    joinedDaysAgo: 63, adherence: 0.71, lifecycle: 'active', heightCm: 174, startWeightKg: 56.5, currentWeightKg: 59.8, locale: 'ur_rm',
    notes: 'Struggles to eat enough. Nutrition referral made.',
  },
  {
    key: 'maryam', name: 'Maryam Javed', email: 'maryam.javed@example.com', phone: '+923214567009', gender: 'female', dob: '1988-04-22',
    branch: 'gulberg', goal: 'general_fitness', experience: 'beginner', coach: 'coach_ayesha', program: 'home_hybrid_3d', planCode: 'silver_monthly',
    joinedDaysAgo: 140, adherence: 0.66, lifecycle: 'active', heightCm: 160, startWeightKg: 67.0, currentWeightKg: 65.4, locale: 'ur',
    ramadanMode: true,
    notes: 'Prefers Urdu. Uses the home sessions when the children are unwell.',
  },
  {
    key: 'ahmed', name: 'Ahmed Nawaz', email: 'ahmed.nawaz@example.com', phone: '+923214567010', gender: 'male', dob: '1995-08-08',
    branch: 'gulberg', goal: 'muscle_gain', experience: 'intermediate', coach: 'coach_hassan', program: 'hypertrophy_4d', planCode: 'platinum_monthly',
    joinedDaysAgo: 155, adherence: 0.81, lifecycle: 'active', heightCm: 180, startWeightKg: 79.0, currentWeightKg: 82.3, locale: 'en',
    painAreas: ['knee'], redFlag: 'sharp_or_worsening_pain',
    notes: 'Reported sharp knee pain on squats during Tuesday’s session.',
  },
  {
    key: 'nida', name: 'Nida Aslam', email: 'nida.aslam@example.com', phone: '+923214567011', gender: 'female', dob: '1999-05-16',
    branch: 'gulberg', goal: 'fat_loss', experience: 'first_time', coach: 'coach_ayesha', program: null, planCode: 'trial_week',
    joinedDaysAgo: 4, adherence: 0.5, lifecycle: 'trial', heightCm: 161, startWeightKg: 73.0, currentWeightKg: 73.0, locale: 'en',
    onboardingComplete: false, membershipState: 'trial',
  },
  {
    key: 'kamran', name: 'Kamran Butt', email: 'kamran.butt@example.com', phone: '+923214567012', gender: 'male', dob: '1986-10-03',
    branch: 'gulberg', goal: 'strength', experience: 'intermediate', coach: 'coach_hassan', program: 'strength_3d', planCode: 'gold_monthly',
    joinedDaysAgo: 240, adherence: 0.63, lifecycle: 'active', heightCm: 177, startWeightKg: 90.0, currentWeightKg: 87.5, locale: 'en',
    overdue: true,
    notes: 'Card payment failed twice this month. Usually pays cash at the desk.',
  },
  {
    key: 'hira', name: 'Hira Shah', email: 'hira.shah@example.com', phone: '+923214567013', gender: 'female', dob: '1998-01-25',
    branch: 'dha', goal: 'endurance', experience: 'beginner', coach: 'coach_bilal', program: 'fat_loss_3d', planCode: 'gold_monthly',
    joinedDaysAgo: 88, adherence: 0.83, lifecycle: 'active', heightCm: 165, startWeightKg: 60.5, currentWeightKg: 59.1, locale: 'en',
  },
  {
    key: 'junaid', name: 'Junaid Akram', email: 'junaid.akram@example.com', phone: '+923214567014', gender: 'male', dob: '1979-06-12',
    branch: 'dha', goal: 'fat_loss', experience: 'beginner', coach: 'coach_bilal', program: 'low_impact_3d', planCode: 'gold_monthly',
    joinedDaysAgo: 71, adherence: 0.69, lifecycle: 'active', heightCm: 172, startWeightKg: 98.2, currentWeightKg: 94.6, locale: 'ur_rm',
    conditions: ['high_blood_pressure'],
    notes: 'On blood pressure medication. Doctor happy with light-to-moderate training.',
  },
  {
    key: 'rabia', name: 'Rabia Noor', email: 'rabia.noor@example.com', phone: '+923214567015', gender: 'female', dob: '2008-09-14',
    branch: 'dha', goal: 'general_fitness', experience: 'first_time', coach: 'coach_bilal', program: 'beginner_induction_2d', planCode: 'student_monthly',
    joinedDaysAgo: 25, adherence: 0.75, lifecycle: 'active', heightCm: 157, startWeightKg: 52.0, currentWeightKg: 52.8, locale: 'en',
    guardian: 'guardian_tariq',
    notes: '17 years old. Father manages the membership and payments.',
  },
  {
    key: 'saad', name: 'Saad Mehmood', email: 'saad.mehmood@example.com', phone: '+923214567016', gender: 'male', dob: '1990-11-29',
    branch: 'dha', goal: 'maintenance', experience: 'advanced', coach: 'coach_bilal', program: null, planCode: 'platinum_monthly',
    joinedDaysAgo: 400, adherence: 0.4, lifecycle: 'frozen', heightCm: 181, startWeightKg: 82.0, currentWeightKg: 83.5, locale: 'en',
    membershipState: 'frozen',
    notes: 'Travelling for work until September. Membership frozen with approval.',
  },
];

export const PLANS = [
  { code: 'silver_monthly', name: 'Silver Monthly', kind: 'membership', price: 4500, joining: 2000, interval: 'monthly', classCredits: 4, freezeDays: 14, access: 'home', description: 'Full gym access at your home branch, plus 4 class credits a month.' },
  { code: 'gold_monthly', name: 'Gold Monthly', kind: 'membership', price: 7500, joining: 2000, interval: 'monthly', classCredits: 12, freezeDays: 30, access: 'home', description: 'Everything in Silver plus 12 class credits, a coach-assigned program and weekly check-ins.' },
  { code: 'platinum_monthly', name: 'Platinum Monthly', kind: 'membership', price: 12500, joining: 0, interval: 'monthly', classCredits: 999, freezeDays: 45, access: 'all', description: 'Unlimited classes, both branches, priority coaching and a monthly progress review.' },
  { code: 'gold_annual', name: 'Gold Annual', kind: 'membership', price: 75000, joining: 0, interval: 'annual', classCredits: 999, freezeDays: 60, access: 'home', description: 'Twelve months of Gold for the price of ten.' },
  { code: 'student_monthly', name: 'Student Monthly', kind: 'membership', price: 3500, joining: 1000, interval: 'monthly', classCredits: 4, freezeDays: 14, access: 'home', description: 'Discounted membership for students with valid ID.' },
  { code: 'trial_week', name: '7-Day Trial', kind: 'day_pass', price: 1000, joining: 0, interval: 'one_time', classCredits: 2, freezeDays: 0, access: 'home', description: 'One week to try everything, including a coach-led induction.' },
  { code: 'pt_10', name: 'Personal Training — 10 Sessions', kind: 'pt_package', price: 35000, joining: 0, interval: 'one_time', classCredits: 0, freezeDays: 0, access: 'home', description: 'Ten one-to-one sessions with a qualified coach.' },
  { code: 'class_pack_10', name: 'Class Pack — 10 Classes', kind: 'class_pack', price: 8000, joining: 0, interval: 'one_time', classCredits: 10, freezeDays: 0, access: 'home', description: 'Ten group class credits, valid for three months.' },
];


export function targetWeightFor(member: MemberSpec): number {
  if (member.goal === 'weight_gain' || member.goal === 'muscle_gain' || member.goal === 'bulking') {
    return Math.round((member.startWeightKg + 8) * 10) / 10;
  }
  if (member.goal === 'fat_loss') return Math.round((member.startWeightKg - 12) * 10) / 10;
  if (member.goal === 'recomposition') return Math.round(member.startWeightKg * 10) / 10;
  return Math.round(member.currentWeightKg * 10) / 10;
}

export function goalHeadline(member: MemberSpec): string {
  switch (member.goal) {
    case 'fat_loss':
      return `Lose fat steadily and keep strength — target ${targetWeightFor(member)} kg`;
    case 'muscle_gain':
      return 'Build visible muscle over the next twelve weeks';
    case 'weight_gain':
      return `Gain healthy weight — target ${targetWeightFor(member)} kg`;
    case 'strength':
      return 'Add weight to squat, bench and press';
    case 'beginner_confidence':
      return 'Feel completely comfortable training alone';
    case 'recomposition':
      return 'Same weight, visibly different shape';
    case 'endurance':
      return 'Run 5 km without stopping';
    default:
      return 'Stay fit, strong and consistent';
  }
}
