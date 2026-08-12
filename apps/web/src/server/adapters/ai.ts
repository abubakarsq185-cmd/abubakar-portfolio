import 'server-only';
/**
 * AI provider abstraction + the tool runtime.
 *
 * The important part of this file is not the model call — it is the fact that
 * the model can only reach the member's data through six typed tools, that its
 * request is classified before the call and its output validated after it, and
 * that every turn is written to ai_interactions with full provenance.
 *
 * The default `scripted` driver is deterministic and needs no network. It
 * answers from the same approved content a live model would receive, which
 * makes the demo honest and the tests reliable.
 */
import { serverEnv } from '@gymguide/config/env';
import {
  AI_DISCLOSURE_LABEL,
  AI_SYSTEM_CONTRACT,
  classifyRequest,
  validateAiOutput,
  type AiToolName,
  type Classification,
} from '@gymguide/domain';
import type { AiSafetyResult } from '@gymguide/types';

export interface ToolCall {
  name: AiToolName;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: AiToolName;
  summary: string;
  data: unknown;
}

export interface CoachTurnInput {
  memberName: string;
  message: string;
  classification: Classification;
  /** Results of the tools the runtime already executed for this turn. */
  toolResults: ToolResult[];
  locale: 'en' | 'ur' | 'ur_rm';
}

export interface CoachTurnOutput {
  text: string;
  safetyResult: AiSafetyResult;
  safetyReasons: string[];
  model: string;
  driver: string;
  promptVersion: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiAdapter {
  key: string;
  model: string;
  respond(input: CoachTurnInput): Promise<CoachTurnOutput>;
}

// ---------------------------------------------------------------------------
// Scripted driver
// ---------------------------------------------------------------------------

interface ExerciseContent {
  name: string;
  setupInstructions: string;
  executionSteps: string[];
  formCues: string[];
  commonMistakes: string[];
  safetyNotes: string[];
}

interface PlanContent {
  programName: string;
  weekNumber: number;
  todayTitle: string | null;
  nextSessionOn: string | null;
  adherencePercent: number;
  recentChange: string | null;
}

const scriptedAdapter: AiAdapter = {
  key: 'scripted',
  model: 'gymguide-scripted-v1',
  async respond(input) {
    const started = Date.now();
    const paragraphs: string[] = [];

    const plan = input.toolResults.find((r) => r.name === 'get_current_plan')?.data as PlanContent | undefined;
    const exercise = input.toolResults.find((r) => r.name === 'explain_exercise')?.data as ExerciseContent | undefined;
    const substitutions = input.toolResults.find((r) => r.name === 'get_approved_substitutions')?.data as
      | Array<{ name: string; reason: string }>
      | undefined;

    switch (input.classification.intent) {
      case 'explain_exercise': {
        if (exercise) {
          paragraphs.push(`**${exercise.name}** — here is exactly how to do it.`);
          paragraphs.push(`Setup: ${exercise.setupInstructions}`);
          paragraphs.push(exercise.executionSteps.map((stepText, index) => `${index + 1}. ${stepText}`).join('\n'));
          if (exercise.formCues.length) paragraphs.push(`Keep in mind: ${exercise.formCues.join(' · ')}`);
          if (exercise.commonMistakes.length) paragraphs.push(`Common mistakes: ${exercise.commonMistakes.join(' · ')}`);
          if (exercise.safetyNotes.length) paragraphs.push(`Safety: ${exercise.safetyNotes.join(' ')}`);
        } else {
          paragraphs.push(
            'I could not find that exercise in your gym’s approved library, so I will not guess at the technique. A coach can show you properly.',
          );
        }
        break;
      }
      case 'explain_plan': {
        if (plan) {
          paragraphs.push(
            `You are on **${plan.programName}**, week ${plan.weekNumber}.${
              plan.todayTitle ? ` Today is ${plan.todayTitle}.` : ' Today is a rest day — walking and sleep count.'
            }`,
          );
          paragraphs.push(
            `Your adherence over the last four weeks is ${plan.adherencePercent}%. ${
              plan.adherencePercent >= 70
                ? 'That is the number that actually drives results, and yours is good.'
                : 'If that feels low, a shorter week is a better plan than a perfect one you skip.'
            }`,
          );
        } else {
          paragraphs.push('You do not have an active plan yet. A coach will assign one — ask at the front desk and they will sort it today.');
        }
        break;
      }
      case 'explain_plan_change': {
        paragraphs.push(
          plan?.recentChange
            ? `Your plan changed because of this: ${plan.recentChange} Every automatic change is recorded with the rule that made it, and a coach can override it.`
            : 'Nothing has changed in your plan recently. When something does change, you will see the reason here.',
        );
        break;
      }
      case 'request_substitution': {
        if (substitutions?.length) {
          paragraphs.push('Here are the approved alternatives available at your branch right now:');
          paragraphs.push(substitutions.map((s) => `• ${s.name} — ${s.reason.replace(/_/g, ' ')}`).join('\n'));
          paragraphs.push('Pick one in the workout player and it will be logged against the same slot.');
        } else {
          paragraphs.push(
            'There is no approved alternative for that exercise at your branch today. Ask a coach and they will adjust your plan properly rather than improvising.',
          );
        }
        break;
      }
      case 'motivation': {
        paragraphs.push(
          plan && plan.adherencePercent >= 60
            ? `You have kept ${plan.adherencePercent}% of your sessions. That is genuinely good, and it is why your numbers are moving.`
            : 'Starting again is the whole skill. Do one short session this week — that is the entire goal.',
        );
        paragraphs.push('If the plan feels too big right now, I can ask a coach to shorten it for you.');
        break;
      }
      case 'nutrition_general': {
        paragraphs.push(
          'Your nutrition guidance sits in the Nutrition tab, set by your gym’s nutrition professional. The short version: protein at every meal, half your plate vegetables, and enough water.',
        );
        paragraphs.push('For anything specific to a medical condition, please speak to a doctor or registered dietitian.');
        break;
      }
      case 'gym_policy': {
        paragraphs.push('I can only answer from your gym’s published policies. For timings, fees or freezing your membership, the front desk will give you a definite answer.');
        break;
      }
      default: {
        paragraphs.push('I can help with your workouts, exercise technique, your plan, and general healthy-eating guidance from your gym.');
      }
    }

    const draft = paragraphs.join('\n\n');
    const validation = validateAiOutput(draft, input.toolResults.map((r) => r.name));

    return {
      text: validation.ok ? draft : validation.replacement!,
      safetyResult: validation.ok ? input.classification.safety : validation.safety,
      safetyReasons: validation.ok ? input.classification.reasons : validation.violations,
      model: scriptedAdapter.model,
      driver: 'scripted',
      promptVersion: serverEnv().AI_PROMPT_VERSION,
      latencyMs: Date.now() - started,
      inputTokens: null,
      outputTokens: null,
    };
  },
};

// ---------------------------------------------------------------------------
// Anthropic driver
// ---------------------------------------------------------------------------

const anthropicAdapter: AiAdapter = {
  key: 'anthropic',
  // Read lazily: touching the environment at module load would make importing
  // this file fail during a build that has no secrets configured.
  get model() {
    return serverEnv().AI_MODEL;
  },
  async respond(input) {
    const env = serverEnv();
    const started = Date.now();
    if (!env.ANTHROPIC_API_KEY) return scriptedAdapter.respond(input);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        max_tokens: 700,
        system: AI_SYSTEM_CONTRACT,
        messages: [
          {
            role: 'user',
            content: [
              `Member: ${input.memberName}`,
              `Question: ${input.message}`,
              '',
              'Approved tool output you may use (and nothing else):',
              JSON.stringify(input.toolResults, null, 2),
            ].join('\n'),
          },
        ],
      }),
    });

    if (!response.ok) {
      // A provider outage must never break the member's app.
      return scriptedAdapter.respond(input);
    }

    const body = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const draft = body.content.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n').trim();
    const validation = validateAiOutput(draft, input.toolResults.map((r) => r.name));

    return {
      text: validation.ok ? draft : validation.replacement!,
      safetyResult: validation.ok ? input.classification.safety : validation.safety,
      safetyReasons: validation.ok ? input.classification.reasons : validation.violations,
      model: env.AI_MODEL,
      driver: 'anthropic',
      promptVersion: env.AI_PROMPT_VERSION,
      latencyMs: Date.now() - started,
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
    };
  },
};

export function aiAdapter(): AiAdapter {
  const driver = serverEnv().AI_DRIVER;
  if (driver === 'anthropic') return anthropicAdapter;
  return scriptedAdapter;
}

export { AI_DISCLOSURE_LABEL, classifyRequest };
