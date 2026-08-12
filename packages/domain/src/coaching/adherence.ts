/**
 * Adherence, streaks and personal records.
 * Deliberately encouraging maths: we never show a negative score, and streaks
 * survive a planned rest day.
 */

export interface SessionOutcome {
  scheduledFor: string;
  state: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'expired';
  completedSets: number;
  prescribedSets: number;
  totalVolumeKg: number;
}

export interface AdherenceResult {
  adherencePercent: number;
  completionPercent: number;
  completed: number;
  planned: number;
  partial: number;
  band: 'excellent' | 'good' | 'building' | 'at_risk';
  message: string;
}

export function computeAdherence(sessions: SessionOutcome[]): AdherenceResult {
  const planned = sessions.filter((s) => s.state !== 'scheduled').length;
  const completed = sessions.filter((s) => s.state === 'completed').length;
  const partial = sessions.filter(
    (s) => s.state !== 'completed' && s.completedSets > 0 && s.completedSets < s.prescribedSets,
  ).length;

  // Partial sessions earn half credit: showing up matters.
  const credit = completed + partial * 0.5;
  const adherencePercent = planned === 0 ? 0 : Math.round((credit / planned) * 100);

  const prescribed = sessions.reduce((sum, s) => sum + s.prescribedSets, 0);
  const done = sessions.reduce((sum, s) => sum + s.completedSets, 0);
  const completionPercent = prescribed === 0 ? 0 : Math.round((done / prescribed) * 100);

  const band: AdherenceResult['band'] =
    adherencePercent >= 85 ? 'excellent' : adherencePercent >= 65 ? 'good' : adherencePercent >= 40 ? 'building' : 'at_risk';

  const message =
    band === 'excellent'
      ? 'Outstanding consistency. This is exactly how progress happens.'
      : band === 'good'
        ? 'Solid consistency. One more session a week would compound nicely.'
        : band === 'building'
          ? 'You are building the habit. Aim for one extra session this week.'
          : 'Let’s reset with a shorter plan you can actually keep. Small and steady wins.';

  return { adherencePercent, completionPercent, completed, planned, partial, band, message };
}

/**
 * Current streak in *training days*: consecutive scheduled sessions completed,
 * counting back from the most recent scheduled session. Rest days do not break
 * a streak because they were never a commitment.
 */
export function computeStreak(sessions: SessionOutcome[]): { current: number; best: number } {
  const ordered = [...sessions]
    .filter((s) => s.state === 'completed' || s.state === 'skipped' || s.state === 'expired')
    .sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1));

  let current = 0;
  for (const session of ordered) {
    if (session.state === 'completed') current += 1;
    else break;
  }

  let best = 0;
  let run = 0;
  for (const session of [...ordered].reverse()) {
    if (session.state === 'completed') {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { current, best: Math.max(best, current) };
}

export interface HabitStreakInput {
  key: string;
  label: string;
  target: number;
  unit: string;
  logs: Array<{ loggedOn: string; value: number; completed: boolean }>;
}

export function computeHabitStreak(habit: HabitStreakInput, today: string): number {
  const byDate = new Map(habit.logs.map((l) => [l.loggedOn, l]));
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < 400; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const log = byDate.get(key);
    if (log && log.completed) {
      streak += 1;
    } else if (i > 0 || !log) {
      // Today not being logged yet should not zero yesterday's streak.
      if (i === 0) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        continue;
      }
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export interface PersonalRecordCandidate {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  setLogId: string;
  achievedAt: string;
}

export interface ExistingRecord {
  exerciseId: string;
  kind: 'max_weight' | 'best_e1rm' | 'max_reps';
  value: number;
}

export interface DetectedRecord {
  exerciseId: string;
  exerciseName: string;
  kind: 'max_weight' | 'best_e1rm' | 'max_reps';
  value: number;
  previousValue: number | null;
  unit: string;
  setLogId: string;
  achievedAt: string;
}

/** Detect personal records without ever regressing an existing one. */
export function detectPersonalRecords(
  candidates: PersonalRecordCandidate[],
  existing: ExistingRecord[],
): DetectedRecord[] {
  const best = new Map<string, number>();
  for (const record of existing) best.set(`${record.exerciseId}:${record.kind}`, record.value);

  const found: DetectedRecord[] = [];
  for (const candidate of candidates) {
    if (candidate.reps <= 0) continue;

    const checks: Array<{ kind: DetectedRecord['kind']; value: number; unit: string }> = [
      { kind: 'max_weight', value: candidate.weightKg, unit: 'kg' },
      {
        kind: 'best_e1rm',
        value: candidate.reps === 1 ? candidate.weightKg : Number((candidate.weightKg * (1 + candidate.reps / 30)).toFixed(1)),
        unit: 'kg',
      },
      { kind: 'max_reps', value: candidate.reps, unit: 'reps' },
    ];

    for (const check of checks) {
      if (check.value <= 0) continue;
      const key = `${candidate.exerciseId}:${check.kind}`;
      const previous = best.get(key) ?? null;
      if (previous === null || check.value > previous) {
        // max_reps only counts as a PR when it is not a lighter-weight set.
        if (check.kind === 'max_reps' && previous !== null && candidate.weightKg <= 0) continue;
        best.set(key, check.value);
        found.push({
          exerciseId: candidate.exerciseId,
          exerciseName: candidate.exerciseName,
          kind: check.kind,
          value: check.value,
          previousValue: previous,
          unit: check.unit,
          setLogId: candidate.setLogId,
          achievedAt: candidate.achievedAt,
        });
      }
    }
  }
  return found;
}

export interface SessionTotals {
  totalVolumeKg: number;
  completedSets: number;
  prescribedSets: number;
  hardestSetRpe: number | null;
  workingReps: number;
}

export function computeSessionTotals(
  sets: Array<{
    reps: number | null;
    weightKg: number | null;
    rpe: number | null;
    isWarmup: boolean;
    skipped: boolean;
  }>,
  prescribedSets: number,
): SessionTotals {
  let volume = 0;
  let completed = 0;
  let reps = 0;
  let hardest: number | null = null;

  for (const set of sets) {
    if (set.skipped) continue;
    completed += 1;
    if (!set.isWarmup) {
      volume += (set.weightKg ?? 0) * (set.reps ?? 0);
      reps += set.reps ?? 0;
      if (set.rpe !== null) hardest = hardest === null ? set.rpe : Math.max(hardest, set.rpe);
    }
  }

  return {
    totalVolumeKg: Number(volume.toFixed(2)),
    completedSets: completed,
    prescribedSets,
    hardestSetRpe: hardest,
    workingReps: reps,
  };
}
