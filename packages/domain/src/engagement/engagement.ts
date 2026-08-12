/**
 * Engagement: inactivity risk scoring and the rules that decide whether an
 * automated message is allowed to be sent at all.
 *
 * The automation gate is intentionally strict — quiet hours, opt-in, frequency
 * caps and dedupe are all checked before anything reaches a member.
 */
import type { NotificationChannel } from '@gymguide/types';

export interface EngagementSignals {
  daysSinceLastVisit: number | null;
  daysSinceLastWorkout: number | null;
  workoutsLast28Days: number;
  plannedLast28Days: number;
  checkInsLast8Weeks: number;
  habitLogsLast7Days: number;
  hasOverdueInvoice: boolean;
  membershipEndsInDays: number | null;
  onboardingComplete: boolean;
  daysSinceJoined: number;
}

export interface InactivityRisk {
  score: number;
  band: 'healthy' | 'watch' | 'at_risk' | 'critical';
  drivers: string[];
  recommendedAction: string;
}

/**
 * 0–100. Higher is worse. Weighted so recency of training dominates, because it
 * is the strongest churn predictor in a gym.
 */
export function scoreInactivityRisk(signals: EngagementSignals): InactivityRisk {
  let score = 0;
  const drivers: string[] = [];

  const daysSinceWorkout = signals.daysSinceLastWorkout ?? signals.daysSinceLastVisit ?? 99;
  if (daysSinceWorkout >= 28) {
    score += 45;
    drivers.push('No training logged in over four weeks');
  } else if (daysSinceWorkout >= 14) {
    score += 32;
    drivers.push('No training logged in two weeks');
  } else if (daysSinceWorkout >= 7) {
    score += 18;
    drivers.push('No training logged this week');
  } else if (daysSinceWorkout >= 4) {
    score += 6;
  }

  if (signals.plannedLast28Days > 0) {
    const ratio = signals.workoutsLast28Days / signals.plannedLast28Days;
    if (ratio < 0.25) {
      score += 20;
      drivers.push('Completed under a quarter of planned sessions');
    } else if (ratio < 0.5) {
      score += 12;
      drivers.push('Completed under half of planned sessions');
    } else if (ratio < 0.7) {
      score += 5;
    }
  }

  if (!signals.onboardingComplete && signals.daysSinceJoined >= 3) {
    score += 15;
    drivers.push('Onboarding never finished');
  }

  if (signals.checkInsLast8Weeks === 0 && signals.daysSinceJoined > 21) {
    score += 8;
    drivers.push('No check-ins submitted');
  }

  if (signals.habitLogsLast7Days === 0) score += 4;

  if (signals.hasOverdueInvoice) {
    score += 12;
    drivers.push('Payment overdue');
  }

  if (signals.membershipEndsInDays !== null && signals.membershipEndsInDays <= 14) {
    score += 10;
    drivers.push(`Membership ends in ${Math.max(0, signals.membershipEndsInDays)} days`);
  }

  // A brand-new member has not had time to look inactive.
  if (signals.daysSinceJoined <= 7) score = Math.min(score, 25);

  score = Math.max(0, Math.min(100, Math.round(score)));

  const band: InactivityRisk['band'] =
    score >= 70 ? 'critical' : score >= 45 ? 'at_risk' : score >= 25 ? 'watch' : 'healthy';

  const recommendedAction =
    band === 'critical'
      ? 'Call the member personally. Offer a shorter plan or a session with a coach.'
      : band === 'at_risk'
        ? 'Send a personal message from their coach and offer to adjust the plan.'
        : band === 'watch'
          ? 'Automated nudge is enough for now. Watch next week.'
          : 'No action needed.';

  return { score, band, drivers, recommendedAction };
}

// ---------------------------------------------------------------------------
// Automation eligibility
// ---------------------------------------------------------------------------

export interface AutomationGateInput {
  channel: NotificationChannel;
  category: 'operational' | 'coaching' | 'billing' | 'marketing' | 'safety';
  /** Local time at the member's branch, "HH:MM". */
  memberLocalTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  respectQuietHours: boolean;
  requiresOptIn: boolean;
  memberOptedIn: boolean;
  categoryEnabled: boolean;
  sentThisWeek: number;
  maxPerWeek: number;
  hoursSinceLastSameAutomation: number | null;
  cooldownHours: number;
  alreadySentDedupeKey: boolean;
  memberIsSuspended: boolean;
  automationPausedUntil: string | null;
  now: string;
}

export type AutomationDecision =
  | { allowed: true; deferUntil: null }
  | { allowed: false; reason: string; deferUntil: string | null };

function minutesOf(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

export function isWithinQuietHours(localTime: string, start: string, end: string): boolean {
  const t = minutesOf(localTime);
  const s = minutesOf(start);
  const e = minutesOf(end);
  // Quiet hours normally wrap midnight (21:30 → 07:30).
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

/**
 * The single gate every automated message passes through.
 * Safety messages bypass quiet hours and frequency caps — and only those.
 */
export function evaluateAutomationGate(input: AutomationGateInput): AutomationDecision {
  if (input.alreadySentDedupeKey) {
    return { allowed: false, reason: 'Already sent for this trigger occurrence', deferUntil: null };
  }
  if (input.memberIsSuspended) {
    return { allowed: false, reason: 'Member account is suspended', deferUntil: null };
  }

  if (input.category === 'safety') {
    return { allowed: true, deferUntil: null };
  }

  if (input.automationPausedUntil && input.automationPausedUntil > input.now) {
    return {
      allowed: false,
      reason: 'Automated messages are paused for this member',
      deferUntil: input.automationPausedUntil,
    };
  }
  if (!input.categoryEnabled) {
    return { allowed: false, reason: `Member disabled ${input.category} messages on ${input.channel}`, deferUntil: null };
  }
  if (input.requiresOptIn && !input.memberOptedIn) {
    return { allowed: false, reason: `No opt-in recorded for ${input.channel}`, deferUntil: null };
  }
  if (input.category === 'marketing' && !input.memberOptedIn) {
    return { allowed: false, reason: 'Marketing requires explicit opt-in', deferUntil: null };
  }
  if (input.sentThisWeek >= input.maxPerWeek) {
    return { allowed: false, reason: `Weekly cap of ${input.maxPerWeek} reached`, deferUntil: null };
  }
  if (
    input.hoursSinceLastSameAutomation !== null &&
    input.hoursSinceLastSameAutomation < input.cooldownHours
  ) {
    return {
      allowed: false,
      reason: `Cooldown: ${input.cooldownHours}h between sends`,
      deferUntil: null,
    };
  }
  if (
    input.respectQuietHours &&
    isWithinQuietHours(input.memberLocalTime, input.quietHoursStart, input.quietHoursEnd)
  ) {
    return {
      allowed: false,
      reason: `Quiet hours (${input.quietHoursStart}–${input.quietHoursEnd})`,
      deferUntil: nextSendWindow(input.now, input.quietHoursEnd),
    };
  }
  return { allowed: true, deferUntil: null };
}

/** The next moment quiet hours end, as an ISO timestamp. */
export function nextSendWindow(nowIso: string, quietHoursEnd: string): string {
  const now = new Date(nowIso);
  const [h = '7', m = '30'] = quietHoursEnd.split(':');
  const candidate = new Date(now);
  candidate.setUTCHours(Number(h), Number(m), 0, 0);
  if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate.toISOString();
}

export interface MilestoneCheck {
  completedWorkouts: number;
  currentStreak: number;
  totalVolumeKg: number;
  daysSinceJoined: number;
}

export interface Milestone {
  key: string;
  label: string;
  celebration: string;
}

const WORKOUT_MILESTONES = [1, 5, 10, 25, 50, 100, 200, 365];

/** Milestones worth telling a member about. Restrained on purpose. */
export function detectMilestones(check: MilestoneCheck): Milestone[] {
  const found: Milestone[] = [];
  if (WORKOUT_MILESTONES.includes(check.completedWorkouts)) {
    found.push({
      key: `workouts_${check.completedWorkouts}`,
      label:
        check.completedWorkouts === 1
          ? 'First session done'
          : `${check.completedWorkouts} sessions completed`,
      celebration:
        check.completedWorkouts === 1
          ? 'The hardest one is behind you. Well done for starting.'
          : `${check.completedWorkouts} sessions is real, compounding work. Keep going.`,
    });
  }
  if ([7, 14, 30, 60, 100].includes(check.currentStreak)) {
    found.push({
      key: `streak_${check.currentStreak}`,
      label: `${check.currentStreak}-session streak`,
      celebration: 'Consistency like this is what changes bodies.',
    });
  }
  const volumeTonnes = Math.floor(check.totalVolumeKg / 1000);
  if (volumeTonnes > 0 && [1, 5, 10, 25, 50, 100].includes(volumeTonnes)) {
    found.push({
      key: `volume_${volumeTonnes}t`,
      label: `${volumeTonnes} tonne${volumeTonnes === 1 ? '' : 's'} lifted`,
      celebration: `That is ${volumeTonnes} thousand kilograms moved. Quietly impressive.`,
    });
  }
  return found;
}
