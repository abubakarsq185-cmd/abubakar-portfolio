/**
 * The AI coach contract.
 *
 * GymGuide Coach is not a free-form chatbot. It can only act through the six
 * tools below, and every response is checked twice: the request is classified
 * before the model is called, and the model's output is validated before a
 * member ever sees it.
 *
 * Hard rules encoded here:
 *   • no diagnosis, no treatment, no medication or supplement advice
 *   • never claims a member is medically safe or "fine"
 *   • never invents a workout outside approved templates
 *   • never modifies a high-risk member's plan
 *   • never reveals another member's data
 *   • every output is labelled AI-assisted and logged with full provenance
 */
import type { AiSafetyResult } from '@gymguide/types';

export const AI_TOOLS = [
  'explain_exercise',
  'get_current_plan',
  'get_approved_substitutions',
  'create_support_case',
  'summarize_checkin_for_staff',
  'suggest_program_change_for_review',
] as const;
export type AiToolName = (typeof AI_TOOLS)[number];

export interface AiToolDefinition {
  name: AiToolName;
  description: string;
  /** Which permission the *calling actor* must hold. */
  requiredPermission: 'member.self' | 'checkins.review' | 'programs.assign';
  /** Whether the tool may run for a member currently flagged as high risk. */
  allowedWhenHighRisk: boolean;
  inputKeys: string[];
}

export const AI_TOOL_DEFINITIONS: Record<AiToolName, AiToolDefinition> = {
  explain_exercise: {
    name: 'explain_exercise',
    description:
      'Return approved technique content for one exercise: setup, steps, cues, common mistakes, safety notes. Content is quoted from the exercise library, never generated.',
    requiredPermission: 'member.self',
    allowedWhenHighRisk: true,
    inputKeys: ['exerciseId'],
  },
  get_current_plan: {
    name: 'get_current_plan',
    description:
      "Return the member's assigned program, current week, and the sessions scheduled for it. Read-only.",
    requiredPermission: 'member.self',
    allowedWhenHighRisk: true,
    inputKeys: [],
  },
  get_approved_substitutions: {
    name: 'get_approved_substitutions',
    description:
      'Return approved alternatives for one exercise, already filtered by branch equipment and member restrictions.',
    requiredPermission: 'member.self',
    allowedWhenHighRisk: true,
    inputKeys: ['exerciseId', 'reason'],
  },
  create_support_case: {
    name: 'create_support_case',
    description:
      'Hand the conversation to a human. Creates a support case, sets priority, and tells the member a person will follow up.',
    requiredPermission: 'member.self',
    allowedWhenHighRisk: true,
    inputKeys: ['category', 'subject', 'detail', 'priority'],
  },
  summarize_checkin_for_staff: {
    name: 'summarize_checkin_for_staff',
    description:
      "Summarise a member's weekly check-in for their coach. Staff-facing only; never shown to the member.",
    requiredPermission: 'checkins.review',
    allowedWhenHighRisk: true,
    inputKeys: ['checkInId'],
  },
  suggest_program_change_for_review: {
    name: 'suggest_program_change_for_review',
    description:
      'Draft a program change as a PROPOSAL for a qualified staff member to approve or reject. Never applied automatically.',
    requiredPermission: 'programs.assign',
    allowedWhenHighRisk: false,
    inputKeys: ['userId', 'rationale', 'proposedProgramId'],
  },
};

// ---------------------------------------------------------------------------
// Request classification
// ---------------------------------------------------------------------------

export type AiIntent =
  | 'explain_exercise'
  | 'explain_plan'
  | 'explain_plan_change'
  | 'request_substitution'
  | 'motivation'
  | 'nutrition_general'
  | 'gym_policy'
  | 'medical'
  | 'injury'
  | 'mental_health'
  | 'supplement_or_drug'
  | 'extreme_diet'
  | 'other_member_data'
  | 'off_topic'
  | 'unknown';

export interface Classification {
  intent: AiIntent;
  safety: AiSafetyResult;
  /** Tools the model may use for this turn. Empty means: do not call the model. */
  allowedTools: AiToolName[];
  /** Fixed reply used when we refuse to involve the model at all. */
  cannedResponse: string | null;
  escalate: boolean;
  reasons: string[];
}

const PATTERNS: Array<{ intent: AiIntent; pattern: RegExp }> = [
  { intent: 'medical', pattern: /\b(diagnos|is it (a )?(tear|sprain|fracture|hernia)|do i have|what.?s wrong with my|torn|mri|x[- ]?ray|blood test|infection|tumou?r)\b/i },
  { intent: 'injury', pattern: /\b(pain|hurts?|injur|swollen|sprain|strain|ache|stiff|dard|درد)\b/i },
  { intent: 'supplement_or_drug', pattern: /\b(steroid|anabolic|sarm|testosterone|creatine|protein powder|pre[- ]?workout|fat burner|ozempic|metformin|winstrol|supplement|tablet|medicine|dawa|دوا)\b/i },
  { intent: 'extreme_diet', pattern: /\b(500 ?cal|800 ?cal|water fast|keto for|starv|crash diet|no carbs at all|only eat once|lose 10 ?kg in)\b/i },
  { intent: 'mental_health', pattern: /\b(depress|anxiet|suicid|self[- ]harm|hate my body|eating disorder|bulimi|anorexi|purge)\b/i },
  { intent: 'other_member_data', pattern: /\b(another member|other member|who else|someone else'?s|his plan|her plan|member number \d+)\b/i },
  { intent: 'request_substitution', pattern: /\b(swap|substitut|alternative|replace|machine is (busy|taken|broken)|no (bench|rack|dumbbell))\b/i },
  { intent: 'explain_plan_change', pattern: /\b(why (did|has) my (plan|program|workout) chang|why is it (easier|harder)|why less|why more)\b/i },
  { intent: 'explain_exercise', pattern: /\b(how do i|how to|form|technique|am i doing .* right|which muscle|what does .* work|kaise|کیسے)\b/i },
  { intent: 'explain_plan', pattern: /\b(my (plan|program|workout)|what (am i|do i) (doing|training) (today|tomorrow)|this week|next session)\b/i },
  { intent: 'nutrition_general', pattern: /\b(eat|diet|calorie|protein|meal|food|roti|chawal|khana|کھانا|sehri|iftar)\b/i },
  { intent: 'gym_policy', pattern: /\b(timing|open|clos|fee|price|membership|freeze|cancel|locker|parking|class booking)\b/i },
  { intent: 'motivation', pattern: /\b(motivat|lazy|give up|can'?t do this|demotivat|himmat)\b/i },
];

const REFUSAL_DIAGNOSIS =
  'I am not able to tell you what an injury or symptom is — that needs a qualified person who can actually examine you. I have let the gym team know so someone can talk to you, and I would encourage you to see a doctor or physiotherapist. In the meantime, please do not train through pain.';

const REFUSAL_DRUGS =
  'I cannot give advice about supplements or medication. Please speak to a doctor or a registered dietitian about anything you plan to take. I can help with your training plan and exercise technique.';

const REFUSAL_EXTREME =
  'I will not help set up a very low calorie or crash diet — they tend to backfire and can be genuinely unsafe. I can explain the balanced approach in your plan, and I have asked a qualified member of the team to talk it through with you.';

const REFUSAL_MENTAL_HEALTH =
  'Thank you for telling me. This deserves a person, not an app. I have asked a member of the gym team to reach out to you privately, and if you are struggling right now please contact a doctor or a local support service.';

const REFUSAL_OTHER_MEMBER =
  'I can only ever see your own information — nobody else’s. If you need something about another member, gym staff can help you directly.';

const REFUSAL_OFF_TOPIC =
  'I can help with your workouts, exercise technique, your plan and general healthy-eating guidance from your gym. For anything else, "Talk to gym staff" will get you to a person.';

export interface ClassifyOptions {
  /** True when an unresolved high/critical risk flag exists for the member. */
  memberIsHighRisk: boolean;
  /** True when the member has an eating-disorder concern on file. */
  eatingConcernOnFile: boolean;
  aiCoachEnabled: boolean;
  actorIsStaff: boolean;
}

export function classifyRequest(text: string, options: ClassifyOptions): Classification {
  const reasons: string[] = [];

  if (!options.aiCoachEnabled) {
    return {
      intent: 'unknown',
      safety: 'blocked_out_of_scope',
      allowedTools: [],
      cannedResponse:
        'The AI coach is turned off for this gym. Use "Talk to gym staff" and a person will help you.',
      escalate: false,
      reasons: ['ai_coach feature flag disabled'],
    };
  }

  const matched = PATTERNS.find((entry) => entry.pattern.test(text));
  const intent: AiIntent = matched?.intent ?? (text.trim().length < 4 ? 'unknown' : 'off_topic');

  switch (intent) {
    case 'medical':
      return {
        intent,
        safety: 'redirected_to_staff',
        allowedTools: ['create_support_case'],
        cannedResponse: REFUSAL_DIAGNOSIS,
        escalate: true,
        reasons: ['Diagnosis request — outside scope, escalated to staff'],
      };
    case 'injury':
      return {
        intent,
        safety: 'redirected_to_staff',
        allowedTools: ['create_support_case', 'get_approved_substitutions'],
        cannedResponse: null,
        escalate: true,
        reasons: ['Pain or injury mentioned — human review required'],
      };
    case 'supplement_or_drug':
      return {
        intent,
        safety: 'blocked_unsafe',
        allowedTools: [],
        cannedResponse: REFUSAL_DRUGS,
        escalate: false,
        reasons: ['Supplement or medication advice is out of scope'],
      };
    case 'extreme_diet':
      return {
        intent,
        safety: 'blocked_unsafe',
        allowedTools: ['create_support_case'],
        cannedResponse: REFUSAL_EXTREME,
        escalate: true,
        reasons: ['Extreme calorie restriction request'],
      };
    case 'mental_health':
      return {
        intent,
        safety: 'redirected_to_staff',
        allowedTools: ['create_support_case'],
        cannedResponse: REFUSAL_MENTAL_HEALTH,
        escalate: true,
        reasons: ['Mental health or disordered eating concern'],
      };
    case 'other_member_data':
      return {
        intent,
        safety: 'blocked_out_of_scope',
        allowedTools: [],
        cannedResponse: REFUSAL_OTHER_MEMBER,
        escalate: false,
        reasons: ['Attempt to access another member’s data'],
      };
    case 'off_topic':
      return {
        intent,
        safety: 'blocked_out_of_scope',
        allowedTools: [],
        cannedResponse: REFUSAL_OFF_TOPIC,
        escalate: false,
        reasons: ['Outside the coaching scope'],
      };
    default:
      break;
  }

  if (intent === 'nutrition_general' && options.eatingConcernOnFile) {
    return {
      intent,
      safety: 'redirected_to_staff',
      allowedTools: ['create_support_case'],
      cannedResponse:
        'For anything about food and eating I would rather a qualified person from the team spoke with you directly. I have asked them to get in touch.',
      escalate: true,
      reasons: ['Eating-disorder concern on file: nutrition questions go to a professional'],
    };
  }

  const allowedTools: AiToolName[] = [];
  if (intent === 'explain_exercise') allowedTools.push('explain_exercise', 'get_current_plan');
  if (intent === 'explain_plan' || intent === 'explain_plan_change') allowedTools.push('get_current_plan');
  if (intent === 'request_substitution') allowedTools.push('get_approved_substitutions', 'get_current_plan');
  if (intent === 'nutrition_general' || intent === 'motivation' || intent === 'gym_policy') {
    allowedTools.push('get_current_plan');
  }
  allowedTools.push('create_support_case');

  if (options.memberIsHighRisk) {
    reasons.push('Member has an open high-risk flag: plan changes are not permitted this turn');
  }

  return {
    intent,
    safety: 'allowed',
    allowedTools: allowedTools.filter(
      (tool) => !options.memberIsHighRisk || AI_TOOL_DEFINITIONS[tool].allowedWhenHighRisk,
    ),
    cannedResponse: null,
    escalate: false,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Output validation
// ---------------------------------------------------------------------------

const FORBIDDEN_OUTPUT: Array<{ pattern: RegExp; because: string }> = [
  { pattern: /\byou (are|'re) (medically )?(fine|safe|healthy|okay to train)\b/i, because: 'Claims medical safety' },
  { pattern: /\b(you (probably )?have|this is|sounds like) (a |an )?(tear|sprain|fracture|hernia|tendinitis|arthritis)\b/i, because: 'Diagnoses a condition' },
  { pattern: /\b(take|try|use) (creatine|whey|steroids?|testosterone|sarms?|a fat burner|painkillers?|ibuprofen|panadol)\b/i, because: 'Recommends a supplement or medication' },
  { pattern: /\b(no need to see|don'?t need (to see )?a? ?(doctor|physio|dietitian))\b/i, because: 'Discourages professional care' },
  { pattern: /\b(\d{3,4}) ?(kcal|calories) (a day|daily|per day)\b/i, because: 'States a calorie target outside the approved nutrition module' },
  { pattern: /\bpush through the pain\b/i, because: 'Encourages training through pain' },
  { pattern: /\b(guarantee|guaranteed|you will lose \d+ ?kg (in|within))\b/i, because: 'Makes an outcome promise' },
];

export interface ValidationResult {
  ok: boolean;
  safety: AiSafetyResult;
  violations: string[];
  /** Safe replacement when the draft is rejected. */
  replacement: string | null;
}

export function validateAiOutput(draft: string, usedTools: AiToolName[]): ValidationResult {
  const violations: string[] = [];
  for (const rule of FORBIDDEN_OUTPUT) {
    if (rule.pattern.test(draft)) violations.push(rule.because);
  }

  // A technique explanation must have come from approved content.
  if (/\b(setup|form cue|step 1|grip the bar)\b/i.test(draft) && !usedTools.includes('explain_exercise')) {
    violations.push('Technique detail without an explain_exercise tool call');
  }

  if (violations.length === 0) {
    return { ok: true, safety: 'allowed', violations, replacement: null };
  }

  return {
    ok: false,
    safety: 'blocked_unsafe',
    violations,
    replacement:
      'I am not able to answer that one safely. I have asked a member of the gym team to help you — they will be in touch. If this is about pain or a symptom, please stop training and speak to a doctor.',
  };
}

export const AI_DISCLOSURE_LABEL = 'AI-assisted';

export const AI_SYSTEM_CONTRACT = `You are GymGuide Coach, a digital fitness coach inside a gym's own app.

You may:
- Explain the member's assigned workout and why it changed, using get_current_plan.
- Explain exercise technique using ONLY the content returned by explain_exercise. Quote it; do not embellish.
- Offer alternatives ONLY from get_approved_substitutions.
- Encourage the member warmly and specifically, referring to their real logged progress.
- Answer gym policy questions from the provided policy text.
- Call create_support_case whenever a person is needed.

You must never:
- Diagnose, name a condition, or interpret a symptom.
- Say or imply a member is medically safe, fine, or cleared to train.
- Recommend or comment on supplements, medication or extreme diets.
- Invent exercises, sets, reps or programs not present in tool output.
- Change a plan. You may only propose changes via suggest_program_change_for_review.
- Mention or infer anything about any other member.
- Promise a body-composition outcome or a timeline.

Style: calm, warm, plain language, short sentences. Never judgemental about missed sessions.
Always end a safety-relevant reply by offering "Talk to gym staff".`;
