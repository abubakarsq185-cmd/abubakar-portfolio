/**
 * Program assignment.
 *
 * Members are matched to an *approved template*, never to a generated plan.
 * Scoring is transparent so the staff UI can explain "why this program" and a
 * coach can override with one click.
 */
import type { ExperienceLevel, ProgramIntent, TrainingGoal } from '@gymguide/types';

export interface ProgramCandidate {
  programId: string;
  code: string;
  name: string;
  summary: string;
  intent: ProgramIntent;
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  totalWeeks: number;
  requiresEquipmentCodes: string[];
  lowImpact: boolean;
  ramadanFriendly: boolean;
  contraindications: string[];
  scope: 'platform' | 'organization' | 'branch' | 'member';
}

export interface MatchProfile {
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  availableEquipmentCodes: string[];
  needsLowImpact: boolean;
  ramadanMode: boolean;
  trainsAtHome: boolean;
  conditions: string[];
  /** Set when the safety engine flagged the member. Forces low-impact + review. */
  requiresHumanReview: boolean;
}

export interface MatchExplanation {
  program: ProgramCandidate;
  score: number;
  reasons: string[];
  warnings: string[];
  requiresCoachApproval: boolean;
}

const GOAL_AFFINITY: Record<TrainingGoal, ProgramIntent[]> = {
  fat_loss: ['fat_loss', 'general_fitness', 'hybrid'],
  weight_gain: ['weight_gain', 'hypertrophy'],
  muscle_gain: ['hypertrophy', 'weight_gain', 'strength'],
  bulking: ['hypertrophy', 'weight_gain'],
  recomposition: ['hypertrophy', 'fat_loss', 'general_fitness'],
  strength: ['strength', 'hypertrophy'],
  general_fitness: ['general_fitness', 'hybrid', 'fat_loss'],
  endurance: ['general_fitness', 'hybrid'],
  beginner_confidence: ['beginner_induction', 'general_fitness'],
  maintenance: ['general_fitness', 'hybrid'],
};

const EXPERIENCE_ORDER: ExperienceLevel[] = ['first_time', 'beginner', 'intermediate', 'advanced'];

const ALWAYS_AVAILABLE = new Set(['bodyweight', 'floor', 'wall', 'none']);

export function scoreProgram(profile: MatchProfile, program: ProgramCandidate): MatchExplanation {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // Goal / intent fit is the dominant term.
  if (program.goal === profile.goal) {
    score += 40;
    reasons.push('Built for this exact goal');
  } else if (GOAL_AFFINITY[profile.goal]?.includes(program.intent)) {
    score += 26;
    reasons.push('Supports this goal');
  }

  // First-timers always get the induction program if one exists.
  if (profile.experienceLevel === 'first_time' && program.intent === 'beginner_induction') {
    score += 35;
    reasons.push('Gym induction for a first-time member');
  }

  const profileIdx = EXPERIENCE_ORDER.indexOf(profile.experienceLevel);
  const programIdx = EXPERIENCE_ORDER.indexOf(program.experienceLevel);
  const experienceGap = Math.abs(profileIdx - programIdx);
  if (experienceGap === 0) {
    score += 20;
    reasons.push('Matches training experience');
  } else if (experienceGap === 1) {
    score += 10;
  } else {
    score -= 12;
    warnings.push('Experience level is a stretch');
  }
  if (programIdx > profileIdx + 1) {
    warnings.push('Program is more advanced than the member’s stated experience');
  }

  // Schedule fit.
  const dayGap = Math.abs(program.daysPerWeek - profile.daysPerWeek);
  score += Math.max(0, 15 - dayGap * 6);
  if (dayGap === 0) reasons.push(`${program.daysPerWeek} days a week, exactly as requested`);
  if (program.daysPerWeek > profile.daysPerWeek) {
    warnings.push(`Needs ${program.daysPerWeek} sessions a week; member offered ${profile.daysPerWeek}`);
  }

  const minuteGap = Math.abs(program.sessionMinutes - profile.sessionMinutes);
  score += Math.max(0, 10 - Math.floor(minuteGap / 10) * 4);
  if (minuteGap <= 10) reasons.push(`About ${program.sessionMinutes} minutes per session`);

  // Equipment availability. A program the branch cannot actually deliver is
  // near-disqualified rather than merely penalised — members should never be
  // handed a plan they cannot perform.
  const missing = program.requiresEquipmentCodes.filter(
    (code) => !ALWAYS_AVAILABLE.has(code) && !profile.availableEquipmentCodes.includes(code),
  );
  if (missing.length === 0) {
    score += 15;
    reasons.push('Every exercise is available at this branch');
  } else {
    score -= 60 + missing.length * 10;
    warnings.push(`Branch is missing: ${missing.join(', ')}`);
  }

  // Safety and context. Low impact is a safety requirement, not a preference,
  // so a non-low-impact program is effectively removed from the running.
  if (profile.needsLowImpact) {
    if (program.lowImpact) {
      score += 30;
      reasons.push('Low-impact programming');
    } else {
      score -= 120;
      warnings.push('Not a low-impact program, but this member needs low impact');
    }
  }
  if (profile.ramadanMode) {
    if (program.ramadanFriendly) {
      score += 12;
      reasons.push('Ramadan-adjusted schedule');
    } else {
      warnings.push('Not adjusted for Ramadan timings');
    }
  }
  if (profile.trainsAtHome && (program.intent === 'home' || program.intent === 'hybrid')) {
    score += 8;
    reasons.push('Works at home as well as the gym');
  }

  const contraindicated = program.contraindications.filter((c) => profile.conditions.includes(c));
  if (contraindicated.length > 0) {
    score -= 200;
    warnings.push(`Contraindicated for: ${contraindicated.join(', ')}`);
  }

  // Prefer content the gym itself approved over the platform library.
  if (program.scope === 'organization') score += 6;
  if (program.scope === 'branch') score += 8;

  return {
    program,
    score,
    reasons,
    warnings,
    requiresCoachApproval:
      profile.requiresHumanReview ||
      contraindicated.length > 0 ||
      missing.length > 0 ||
      (profile.needsLowImpact && !program.lowImpact),
  };
}

export interface MatchOutcome {
  best: MatchExplanation | null;
  ranked: MatchExplanation[];
  /** True when no template is safe to auto-assign and a human must choose. */
  needsHumanAssignment: boolean;
  note: string;
}

export function matchProgram(profile: MatchProfile, candidates: ProgramCandidate[]): MatchOutcome {
  const ranked = candidates
    .map((candidate) => scoreProgram(profile, candidate))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] ?? null;

  if (!best) {
    return {
      best: null,
      ranked,
      needsHumanAssignment: true,
      note: 'No approved program templates are available for this branch yet.',
    };
  }

  if (profile.requiresHumanReview) {
    return {
      best,
      ranked,
      needsHumanAssignment: true,
      note: 'Health screening flagged this member, so a qualified staff member must approve the plan before it starts.',
    };
  }

  if (best.warnings.length > 0 && best.score < 60) {
    return {
      best,
      ranked,
      needsHumanAssignment: true,
      note: 'The closest template still has warnings. A coach should confirm or pick a different plan.',
    };
  }

  return {
    best,
    ranked,
    needsHumanAssignment: false,
    note: `Matched "${best.program.name}" (score ${best.score}).`,
  };
}
