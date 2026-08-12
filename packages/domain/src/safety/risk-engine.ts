/**
 * The risk and escalation engine.
 *
 * Three jobs:
 *   1. Turn screening answers and member reports into structured risk flags.
 *   2. Decide what the product must STOP doing (progression, automated plan
 *      changes, nutrition targets).
 *   3. Produce calm, non-diagnostic member copy plus a staff escalation.
 *
 * It never diagnoses, never says a member is "fine", and never clears anyone to
 * train. Those are human decisions.
 */
import type { MovementPattern, RiskKind, RiskSeverity } from '@gymguide/types';

export interface ScreeningAnswers {
  redFlags: {
    chestPain: boolean;
    fainting: boolean;
    severeDizziness: boolean;
    breathingDifficulty: boolean;
    currentSharpPain: boolean;
    recentSurgery: boolean;
    pregnancyOrPostpartum: boolean;
    doctorAdvisedAgainstExercise: boolean;
    disorderedEatingConcern: boolean;
  };
  conditions: string[];
  painAreas: string[];
  medications: boolean;
  detail?: string | undefined;
}

export interface DetectedRisk {
  kind: RiskKind;
  severity: RiskSeverity;
  source: 'screening' | 'member_report' | 'workout_log' | 'coach' | 'ai_triage';
  detail: string;
  affectedMovements: MovementPattern[];
  blocksProgression: boolean;
  requiresHumanReview: boolean;
  /** Immediate escalation = high-priority case, staff notified now. */
  immediateEscalation: boolean;
}

export interface SafetyDecision {
  risks: DetectedRisk[];
  highestSeverity: RiskSeverity;
  /** Non-null value goes into member_profiles.progression_hold_reason. */
  progressionHoldReason: string | null;
  restrictedMovements: MovementPattern[];
  requiresClearance: boolean;
  requiresHumanAssignment: boolean;
  blockAutomatedPlanChanges: boolean;
  blockNutritionTargets: boolean;
  /** Calm, non-diagnostic copy for the member. */
  memberNotice: { title: string; body: string; tone: 'info' | 'warning' | 'stop' } | null;
  /** What staff see in the escalation queue. */
  staffEscalation: {
    priority: 'low' | 'normal' | 'high' | 'urgent';
    subject: string;
    detail: string;
    assignedRole: 'branch_manager' | 'coach' | 'nutrition_professional';
    slaHours: number;
  } | null;
}

const SEVERITY_ORDER: RiskSeverity[] = ['info', 'low', 'moderate', 'high', 'critical'];

function maxSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/** Which movement patterns a reported pain area makes unsafe to load. */
export const PAIN_AREA_MOVEMENTS: Record<string, MovementPattern[]> = {
  neck: ['vertical_push', 'vertical_pull', 'shoulder_isolation'],
  shoulder: ['vertical_push', 'horizontal_push', 'shoulder_isolation', 'elbow_extension'],
  elbow: ['elbow_extension', 'elbow_flexion', 'horizontal_push'],
  wrist: ['carry', 'horizontal_push', 'elbow_flexion'],
  lower_back: ['hinge', 'squat', 'anti_extension', 'carry'],
  hip: ['hinge', 'squat', 'lunge', 'hip_isolation'],
  knee: ['squat', 'lunge', 'knee_isolation'],
  ankle: ['squat', 'lunge', 'calf'],
};

/**
 * Red flags that always mean: stop, tell a human, and do not let the automation
 * touch this member's plan. Ordered from most to least urgent.
 */
const RED_FLAG_RULES: Array<{
  key: keyof ScreeningAnswers['redFlags'];
  kind: RiskKind;
  severity: RiskSeverity;
  label: string;
  movements?: MovementPattern[];
}> = [
  { key: 'chestPain', kind: 'chest_pain', severity: 'critical', label: 'chest pain or pressure' },
  { key: 'fainting', kind: 'fainting', severity: 'critical', label: 'fainting or blackouts' },
  { key: 'breathingDifficulty', kind: 'breathing_difficulty', severity: 'critical', label: 'difficulty breathing' },
  { key: 'severeDizziness', kind: 'severe_dizziness', severity: 'high', label: 'severe dizziness' },
  {
    key: 'doctorAdvisedAgainstExercise',
    kind: 'medical_condition_clearance',
    severity: 'high',
    label: 'a doctor advised against exercise',
  },
  { key: 'currentSharpPain', kind: 'sharp_or_worsening_pain', severity: 'high', label: 'current sharp pain' },
  { key: 'recentSurgery', kind: 'surgery_recovery', severity: 'high', label: 'surgery in the last 12 months' },
  {
    key: 'pregnancyOrPostpartum',
    kind: 'pregnancy_postpartum',
    severity: 'high',
    label: 'pregnancy or postpartum',
    movements: ['anti_extension', 'hinge'],
  },
  {
    key: 'disorderedEatingConcern',
    kind: 'eating_disorder_concern',
    severity: 'high',
    label: 'a concern about eating patterns',
  },
];

const CONDITION_RULES: Record<string, { kind: RiskKind; severity: RiskSeverity; requiresClearance: boolean }> = {
  heart_condition: { kind: 'medical_condition_clearance', severity: 'critical', requiresClearance: true },
  high_blood_pressure: { kind: 'blood_pressure', severity: 'moderate', requiresClearance: false },
  diabetes: { kind: 'diabetes', severity: 'moderate', requiresClearance: false },
  asthma: { kind: 'breathing_difficulty', severity: 'moderate', requiresClearance: false },
  thyroid: { kind: 'medical_condition_clearance', severity: 'low', requiresClearance: false },
  pcos: { kind: 'medical_condition_clearance', severity: 'low', requiresClearance: false },
  joint_problem: { kind: 'joint_limitation', severity: 'moderate', requiresClearance: false },
  back_problem: { kind: 'joint_limitation', severity: 'moderate', requiresClearance: false },
  other: { kind: 'other', severity: 'low', requiresClearance: false },
};

/** Free-text triage. Used on member messages and workout notes. */
// Note: `\b` is an ASCII-only word boundary in JavaScript, so Urdu-script
// phrases are matched without it rather than silently never matching.
const URGENT_PHRASES: Array<{ pattern: RegExp; kind: RiskKind; severity: RiskSeverity }> = [
  { pattern: /\b(chest (pain|pressure|tight)|seenay? me?i?n dard)\b/i, kind: 'chest_pain', severity: 'critical' },
  { pattern: /(سینے میں درد|سینے میں تکلیف|چھاتی میں درد)/, kind: 'chest_pain', severity: 'critical' },
  { pattern: /\b(faint(ed|ing)?|passed out|black(ed)? out|ghash)\b/i, kind: 'fainting', severity: 'critical' },
  { pattern: /(غش|بےہوش|بے ہوش)/, kind: 'fainting', severity: 'critical' },
  { pattern: /\b(can'?t breathe|cannot breathe|shortness of breath|saans .*(nahi|mushkil))\b/i, kind: 'breathing_difficulty', severity: 'critical' },
  { pattern: /(سانس لینے میں|سانس نہیں)/, kind: 'breathing_difficulty', severity: 'critical' },
  { pattern: /\b(very dizzy|severe(ly)? dizz|chakkar)\b/i, kind: 'severe_dizziness', severity: 'high' },
  { pattern: /(چکر آ|چکر آرہے)/, kind: 'severe_dizziness', severity: 'high' },
  { pattern: /\b(sharp pain|shooting pain|pain (is )?getting worse|tez dard)\b/i, kind: 'sharp_or_worsening_pain', severity: 'high' },
  { pattern: /(تیز درد|شدید درد)/, kind: 'sharp_or_worsening_pain', severity: 'high' },
  { pattern: /\b(numb(ness)?|tingling down)\b/i, kind: 'sharp_or_worsening_pain', severity: 'high' },
  { pattern: /\b(pregnan|expecting|postpartum|حاملہ)\b/i, kind: 'pregnancy_postpartum', severity: 'high' },
  { pattern: /\b(surgery|operation|post[- ]?op)\b/i, kind: 'surgery_recovery', severity: 'high' },
  { pattern: /\b(not eating|starv(e|ing)|purge|purging|binge|laxative)\b/i, kind: 'eating_disorder_concern', severity: 'high' },
  { pattern: /\b(torn|tore|snapped|pop(ped)? in my)\b/i, kind: 'new_injury', severity: 'high' },
];

export function triageFreeText(
  text: string,
  source: DetectedRisk['source'] = 'member_report',
): DetectedRisk[] {
  const found: DetectedRisk[] = [];
  const seen = new Set<RiskKind>();
  for (const rule of URGENT_PHRASES) {
    if (!rule.pattern.test(text)) continue;
    if (seen.has(rule.kind)) continue;
    seen.add(rule.kind);
    found.push({
      kind: rule.kind,
      severity: rule.severity,
      source,
      detail: `Member wrote: "${truncate(text, 300)}"`,
      affectedMovements: [],
      blocksProgression: true,
      requiresHumanReview: true,
      immediateEscalation: rule.severity === 'critical' || rule.severity === 'high',
    });
  }
  return found;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function assessScreening(answers: ScreeningAnswers): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  for (const rule of RED_FLAG_RULES) {
    if (!answers.redFlags[rule.key]) continue;
    risks.push({
      kind: rule.kind,
      severity: rule.severity,
      source: 'screening',
      detail: `Health screening: member reported ${rule.label}.${answers.detail ? ` Member note: "${truncate(answers.detail, 240)}"` : ''}`,
      affectedMovements: rule.movements ?? [],
      blocksProgression: true,
      requiresHumanReview: true,
      immediateEscalation: rule.severity === 'critical' || rule.severity === 'high',
    });
  }

  for (const condition of answers.conditions) {
    const rule = CONDITION_RULES[condition];
    if (!rule) continue;
    risks.push({
      kind: rule.kind,
      severity: rule.severity,
      source: 'screening',
      detail: `Health screening: declared condition "${condition.replace(/_/g, ' ')}".`,
      affectedMovements: [],
      blocksProgression: rule.severity === 'critical' || rule.severity === 'high',
      requiresHumanReview: rule.requiresClearance || rule.severity !== 'low',
      immediateEscalation: rule.severity === 'critical',
    });
  }

  for (const area of answers.painAreas) {
    const movements = PAIN_AREA_MOVEMENTS[area] ?? [];
    risks.push({
      kind: 'joint_limitation',
      severity: 'moderate',
      source: 'screening',
      detail: `Health screening: ongoing discomfort in the ${area.replace(/_/g, ' ')}.`,
      affectedMovements: movements,
      blocksProgression: false,
      requiresHumanReview: true,
      immediateEscalation: false,
    });
  }

  if (answers.medications) {
    risks.push({
      kind: 'medical_condition_clearance',
      severity: 'low',
      source: 'screening',
      detail: 'Health screening: member takes regular medication. Noted for staff awareness only.',
      affectedMovements: [],
      blocksProgression: false,
      requiresHumanReview: false,
      immediateEscalation: false,
    });
  }

  return risks;
}

/** A member reporting discomfort inside the workout player. */
export function assessWorkoutReport(input: {
  kind: RiskKind;
  detail?: string | undefined;
  movementPattern?: MovementPattern | undefined;
  discomfortLevel?: number | undefined;
}): DetectedRisk {
  const critical: RiskKind[] = ['chest_pain', 'fainting', 'breathing_difficulty'];
  const high: RiskKind[] = ['severe_dizziness', 'sharp_or_worsening_pain', 'new_injury', 'surgery_recovery', 'pregnancy_postpartum', 'eating_disorder_concern'];

  const severity: RiskSeverity = critical.includes(input.kind)
    ? 'critical'
    : high.includes(input.kind)
      ? 'high'
      : (input.discomfortLevel ?? 0) >= 7
        ? 'high'
        : 'moderate';

  return {
    kind: input.kind,
    severity,
    source: 'workout_log',
    detail: `Reported during a workout${input.movementPattern ? ` on a ${input.movementPattern.replace(/_/g, ' ')} movement` : ''}.${
      input.detail ? ` Member note: "${truncate(input.detail, 240)}"` : ''
    }`,
    affectedMovements: input.movementPattern ? [input.movementPattern] : [],
    blocksProgression: true,
    requiresHumanReview: true,
    immediateEscalation: severity === 'critical' || severity === 'high',
  };
}

const STOP_COPY: Partial<Record<RiskKind, string>> = {
  chest_pain:
    'You mentioned chest pain. Please stop exercising now. If it is happening right now, or comes with sweating, nausea or breathlessness, get emergency medical help immediately.',
  fainting:
    'You mentioned fainting or blacking out. Please stop training and speak to a doctor before your next session.',
  breathing_difficulty:
    'You mentioned trouble breathing. Please stop training for now and get this checked by a doctor.',
  severe_dizziness:
    'Severe dizziness needs looking at before you train again. Please sit down, hydrate, and speak to gym staff.',
  sharp_or_worsening_pain:
    'Sharp or worsening pain is a signal to stop, not to push through. We have paused changes to your plan.',
  new_injury: 'We have paused progression on the affected movements until a coach has spoken with you.',
  surgery_recovery:
    'Because you are recovering from surgery, a qualified person needs to shape your plan before it changes.',
  pregnancy_postpartum:
    'Pregnancy and postpartum training needs a qualified person, not an automated plan. A coach will get in touch.',
  eating_disorder_concern:
    'Thank you for telling us. We have turned off calorie and macro targets for now, and a qualified member of the team will reach out privately.',
  medical_condition_clearance:
    'Because of what you shared, we would like written clearance from your doctor before increasing your training.',
};

/**
 * Fold a set of risks into one decision. This is the function the API calls
 * after screening, after a workout report and after a triaged message.
 */
export function decideSafety(risks: DetectedRisk[]): SafetyDecision {
  if (risks.length === 0) {
    return {
      risks,
      highestSeverity: 'info',
      progressionHoldReason: null,
      restrictedMovements: [],
      requiresClearance: false,
      requiresHumanAssignment: false,
      blockAutomatedPlanChanges: false,
      blockNutritionTargets: false,
      memberNotice: null,
      staffEscalation: null,
    };
  }

  const highestSeverity = risks.reduce<RiskSeverity>((acc, r) => maxSeverity(acc, r.severity), 'info');
  const restricted = [...new Set(risks.flatMap((r) => r.affectedMovements))];
  const blocking = risks.filter((r) => r.blocksProgression);
  const escalating = risks.filter((r) => r.immediateEscalation);
  const worst = [...risks].sort(
    (a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity),
  )[0]!;

  const requiresClearance = risks.some(
    (r) => r.kind === 'medical_condition_clearance' || r.severity === 'critical',
  );
  const blockNutritionTargets = risks.some((r) => r.kind === 'eating_disorder_concern');

  const memberNotice =
    escalating.length > 0
      ? {
          title:
            worst.severity === 'critical'
              ? 'Please stop and get medical advice'
              : 'Let’s pause and get a person involved',
          body:
            STOP_COPY[worst.kind] ??
            'Thanks for telling us. We have paused automatic changes to your plan and asked the gym team to contact you.',
          tone: (worst.severity === 'critical' ? 'stop' : 'warning') as 'stop' | 'warning',
        }
      : blocking.length > 0
        ? {
            title: 'We have paused automatic progression',
            body:
              'Based on what you shared, your plan will stay where it is until a coach has reviewed it. Nothing is wrong with taking a steady week.',
            tone: 'info' as const,
          }
        : null;

  const staffEscalation =
    escalating.length > 0 || blocking.length > 0
      ? {
          priority: (worst.severity === 'critical'
            ? 'urgent'
            : worst.severity === 'high'
              ? 'high'
              : 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          subject: escalationSubject(worst),
          detail: risks.map((r) => `• [${r.severity}] ${r.kind}: ${r.detail}`).join('\n'),
          assignedRole: (worst.kind === 'eating_disorder_concern'
            ? 'nutrition_professional'
            : worst.severity === 'critical'
              ? 'branch_manager'
              : 'coach') as 'branch_manager' | 'coach' | 'nutrition_professional',
          slaHours: worst.severity === 'critical' ? 1 : worst.severity === 'high' ? 4 : 24,
        }
      : null;

  return {
    risks,
    highestSeverity,
    progressionHoldReason:
      blocking.length > 0 ? `${worst.kind} reported (${worst.source}) — awaiting staff review` : null,
    restrictedMovements: restricted,
    requiresClearance,
    requiresHumanAssignment: risks.some((r) => r.requiresHumanReview),
    blockAutomatedPlanChanges: blocking.length > 0,
    blockNutritionTargets,
    memberNotice,
    staffEscalation,
  };
}

function escalationSubject(risk: DetectedRisk): string {
  const label = risk.kind.replace(/_/g, ' ');
  if (risk.severity === 'critical') return `URGENT: member reported ${label}`;
  return `Health review needed: ${label}`;
}

/** Does this decision permit the automation engine to touch the plan at all? */
export function automationAllowed(decision: Pick<SafetyDecision, 'blockAutomatedPlanChanges'>): boolean {
  return !decision.blockAutomatedPlanChanges;
}
