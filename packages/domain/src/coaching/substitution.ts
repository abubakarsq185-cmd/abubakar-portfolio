/**
 * Exercise substitution.
 *
 * The engine never invents a swap. It filters the approved substitution graph
 * (exercise_substitutions) by equipment actually available at the branch, by
 * movement pattern, and by the member's active restrictions.
 */
import type { ExperienceLevel, MovementPattern } from '@gymguide/types';

export interface SubstitutionCandidate {
  exerciseId: string;
  name: string;
  movementPattern: MovementPattern;
  requiredEquipmentCodes: string[];
  difficulty: ExperienceLevel;
  isLowImpact: boolean;
  contraindications: string[];
  reason: 'equipment' | 'difficulty_down' | 'difficulty_up' | 'low_impact' | 'space' | 'injury_friendly' | 'preference';
  preferenceRank: number;
}

export interface SubstitutionRequest {
  originalExerciseId: string;
  originalMovementPattern: MovementPattern;
  reason: SubstitutionCandidate['reason'];
  availableEquipmentCodes: string[];
  restrictedMovements: MovementPattern[];
  memberConditions: string[];
  requireLowImpact: boolean;
  approvedCandidates: SubstitutionCandidate[];
}

export interface SubstitutionResult {
  allowed: SubstitutionCandidate[];
  rejected: Array<{ exerciseId: string; name: string; because: string }>;
  /** Present when nothing is safely available — the UI must offer staff help. */
  escalationHint: string | null;
}

const EQUIPMENT_ALWAYS_AVAILABLE = new Set(['bodyweight', 'floor', 'wall', 'none']);

export function hasRequiredEquipment(
  required: readonly string[],
  available: readonly string[],
): boolean {
  return required.every(
    (code) => EQUIPMENT_ALWAYS_AVAILABLE.has(code) || available.includes(code),
  );
}

export function resolveSubstitutions(request: SubstitutionRequest): SubstitutionResult {
  const allowed: SubstitutionCandidate[] = [];
  const rejected: SubstitutionResult['rejected'] = [];

  for (const candidate of request.approvedCandidates) {
    if (candidate.exerciseId === request.originalExerciseId) continue;

    if (candidate.reason !== request.reason && request.reason !== 'preference') {
      rejected.push({
        exerciseId: candidate.exerciseId,
        name: candidate.name,
        because: `Approved for "${candidate.reason}", not "${request.reason}"`,
      });
      continue;
    }

    // A swap must train the same thing, unless it is deliberately an
    // injury-friendly or low-impact alternative.
    const patternMatches = candidate.movementPattern === request.originalMovementPattern;
    const patternExemption = candidate.reason === 'injury_friendly' || candidate.reason === 'low_impact';
    if (!patternMatches && !patternExemption) {
      rejected.push({
        exerciseId: candidate.exerciseId,
        name: candidate.name,
        because: 'Different movement pattern',
      });
      continue;
    }

    if (request.restrictedMovements.includes(candidate.movementPattern)) {
      rejected.push({
        exerciseId: candidate.exerciseId,
        name: candidate.name,
        because: 'Movement pattern is restricted for this member',
      });
      continue;
    }

    if (!hasRequiredEquipment(candidate.requiredEquipmentCodes, request.availableEquipmentCodes)) {
      rejected.push({
        exerciseId: candidate.exerciseId,
        name: candidate.name,
        because: `Needs ${candidate.requiredEquipmentCodes.join(', ')}, not available at this branch`,
      });
      continue;
    }

    if (request.requireLowImpact && !candidate.isLowImpact) {
      rejected.push({
        exerciseId: candidate.exerciseId,
        name: candidate.name,
        because: 'Not a low-impact option',
      });
      continue;
    }

    const clash = candidate.contraindications.find((c) => request.memberConditions.includes(c));
    if (clash) {
      rejected.push({
        exerciseId: candidate.exerciseId,
        name: candidate.name,
        because: `Contraindicated for a condition on file (${clash})`,
      });
      continue;
    }

    allowed.push(candidate);
  }

  allowed.sort((a, b) => a.preferenceRank - b.preferenceRank);

  return {
    allowed,
    rejected,
    escalationHint:
      allowed.length === 0
        ? 'No approved alternative is available for you at this branch. Ask a coach and they will adjust your plan.'
        : null,
  };
}

/**
 * Equipment-aware filter used when a program template is assigned to a member
 * whose branch does not have every machine the template assumes.
 */
export function planNeedsEquipmentReview(
  requiredCodes: readonly string[],
  availableCodes: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = requiredCodes.filter(
    (code) => !EQUIPMENT_ALWAYS_AVAILABLE.has(code) && !availableCodes.includes(code),
  );
  return { ok: missing.length === 0, missing };
}
