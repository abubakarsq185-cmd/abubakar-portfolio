import 'server-only';
/**
 * GymGuide Coach: the tool runtime.
 *
 * Flow for every turn:
 *   classify → run only the permitted tools → call the model with tool output
 *   only → validate the draft → persist the interaction with full provenance →
 *   escalate to a human when the classifier says so.
 *
 * The model never touches the database. It only ever sees the JSON these tools
 * return, all of which is scoped to the asking member by RLS.
 */
import { classifyRequest, computeAdherence, type AiToolName } from '@gymguide/domain';
import type { Actor, AiCoachMessage } from '@gymguide/types';
import { serverEnv } from '@gymguide/config/env';
import { tenantSessionFor } from '../auth/session';
import { withTenant, type Queryable } from '../db/pool';
import { aiAdapter, type ToolResult } from '../adapters/ai';
import { recordAudit } from '../audit';
import { triageMessage } from './safety';

export interface CoachTurnResult {
  reply: AiCoachMessage;
  escalatedCaseReference: string | null;
  safetyNotice: { title: string; body: string; tone: string } | null;
}

export async function askCoach(actor: Actor, message: string): Promise<CoachTurnResult> {
  const env = serverEnv();
  const session = tenantSessionFor(actor);

  const flags = await withTenant(session, async (db) => {
    const [risk, eating, aiFlag] = await Promise.all([
      db.query<{ count: string }>(
        `select count(*) as count from risk_flags
          where user_id = $1 and resolved_at is null and severity in ('high','critical')`,
        [actor.userId],
      ),
      db.query<{ count: string }>(
        `select count(*) as count from risk_flags
          where user_id = $1 and kind = 'eating_disorder_concern' and resolved_at is null`,
        [actor.userId],
      ),
      db.query<{ enabled: boolean }>(
        `select coalesce(off.enabled, f.default_enabled) as enabled
           from feature_flags f
           left join organization_feature_flags off
             on off.feature_flag_id = f.id and off.organization_id = $1
          where f.key = 'ai_coach'`,
        [actor.organizationId],
      ),
    ]);
    return {
      highRisk: Number(risk.rows[0]?.count ?? 0) > 0,
      eatingConcern: Number(eating.rows[0]?.count ?? 0) > 0,
      aiEnabled: aiFlag.rows[0]?.enabled ?? true,
    };
  });

  const classification = classifyRequest(message, {
    memberIsHighRisk: flags.highRisk,
    eatingConcernOnFile: flags.eatingConcern,
    aiCoachEnabled: env.AI_COACH_ENABLED && flags.aiEnabled,
    actorIsStaff: false,
  });

  // A message can contain a red flag regardless of what the member asked about.
  const triage = await triageMessage(actor, actor.userId, message);

  const toolResults: ToolResult[] = [];
  for (const tool of classification.allowedTools) {
    const result = await runTool(actor, tool, message);
    if (result) toolResults.push(result);
  }

  let replyText: string;
  let safetyResult = classification.safety;
  let safetyReasons = classification.reasons;
  let model = 'none';
  let driver = 'policy';
  let latencyMs = 0;

  if (classification.cannedResponse) {
    replyText = classification.cannedResponse;
  } else {
    const adapter = aiAdapter();
    const output = await adapter.respond({
      memberName: actor.fullName,
      message,
      classification,
      toolResults,
      locale: 'en',
    });
    replyText = output.text;
    safetyResult = output.safetyResult;
    safetyReasons = output.safetyReasons;
    model = output.model;
    driver = output.driver;
    latencyMs = output.latencyMs;
  }

  let caseReference = triage.caseReference;
  if (classification.escalate && !caseReference) {
    caseReference = await openSupportCase(actor, message, classification.intent);
  }

  const interactionId = await withTenant(session, async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into ai_interactions
         (organization_id, user_id, subject_user_id, surface, driver, model, prompt_version,
          user_input, tool_calls, approved_sources, output_text, safety_result, safety_reasons, latency_ms)
       values ($1,$2,$2,'member_coach',$3,$4,$5,$6,$7,$8,$9,$10::ai_safety_result,$11,$12)
       returning id`,
      [
        actor.organizationId, actor.userId, driver, model, env.AI_PROMPT_VERSION, message,
        JSON.stringify(toolResults.map((r) => ({ name: r.name, summary: r.summary }))),
        JSON.stringify(toolResults.map((r) => ({ kind: r.name, label: r.summary }))),
        replyText, safetyResult, safetyReasons, latencyMs,
      ],
    );
    return rows[0]!.id;
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'ai_output',
    entityType: 'ai_interaction',
    entityId: interactionId,
    subjectUserId: actor.userId,
    summary: `GymGuide Coach responded (${safetyResult})`,
    after: { intent: classification.intent, tools: toolResults.map((t) => t.name) },
  });

  return {
    reply: {
      id: interactionId,
      role: 'coach_ai',
      body: replyText,
      isAiAssisted: true,
      createdAt: new Date().toISOString(),
      safetyResult,
      sources: toolResults.map((r) => ({ kind: r.name, label: r.summary, id: null })),
      escalatedCaseReference: caseReference,
    },
    escalatedCaseReference: caseReference,
    safetyNotice: triage.memberNotice,
  };
}

async function runTool(actor: Actor, tool: AiToolName, message: string): Promise<ToolResult | null> {
  const session = tenantSessionFor(actor);

  switch (tool) {
    case 'get_current_plan':
      return withTenant(session, async (db) => {
        const plan = await db.query<{ name: string; current_week: number }>(
          `select p.name, pa.current_week from program_assignments pa
             join programs p on p.id = pa.program_id
            where pa.user_id = $1 and pa.state = 'active' limit 1`,
          [actor.userId],
        );
        if (!plan.rows[0]) return { name: tool, summary: 'No active plan', data: null };

        const [today, sessions, change] = await Promise.all([
          db.query<{ title: string }>(
            `select title from workout_sessions where user_id = $1 and scheduled_for = current_date limit 1`,
            [actor.userId],
          ),
          db.query<{ state: string; completed_sets: number; prescribed_sets: number; scheduled_for: string; total_volume_kg: string }>(
            `select state, completed_sets, prescribed_sets, scheduled_for, total_volume_kg
               from workout_sessions where user_id = $1 and scheduled_for >= current_date - 28`,
            [actor.userId],
          ),
          db.query<{ rationale: string }>(
            `select rationale from coaching_recommendations
              where user_id = $1 and state in ('auto_applied','approved')
              order by created_at desc limit 1`,
            [actor.userId],
          ),
        ]);

        const adherence = computeAdherence(
          sessions.rows.map((row) => ({
            scheduledFor: row.scheduled_for,
            state: row.state as 'completed',
            completedSets: row.completed_sets,
            prescribedSets: row.prescribed_sets,
            totalVolumeKg: Number(row.total_volume_kg),
          })),
        );

        return {
          name: tool,
          summary: `${plan.rows[0].name}, week ${plan.rows[0].current_week}`,
          data: {
            programName: plan.rows[0].name,
            weekNumber: plan.rows[0].current_week,
            todayTitle: today.rows[0]?.title ?? null,
            nextSessionOn: null,
            adherencePercent: adherence.adherencePercent,
            recentChange: change.rows[0]?.rationale ?? null,
          },
        };
      });

    case 'explain_exercise':
      return withTenant(session, async (db) => {
        // Match the question against exercises in the member's own plan first,
        // so "how do I do the squat" means their squat.
        const { rows } = await db.query<Record<string, unknown>>(
          `select distinct e.name, e.setup_instructions, e.execution_steps, e.form_cues,
                  e.common_mistakes, e.safety_notes
             from exercises e
             join workout_items wi on wi.exercise_id = e.id
             join workout_blocks wb on wb.id = wi.workout_block_id
             join workouts w on w.id = wb.workout_id
             join program_days pd on pd.workout_id = w.id
             join program_phases ph on ph.id = pd.program_phase_id
             join program_versions pv on pv.id = ph.program_version_id
             join program_assignments pa on pa.program_version_id = pv.id
            where pa.user_id = $1 and pa.state = 'active'
              and lower($2) like '%' || lower(e.name) || '%'
            limit 1`,
          [actor.userId, message],
        );
        const found = rows[0];
        if (!found) return { name: tool, summary: 'No matching approved exercise', data: null };
        return {
          name: tool,
          summary: `Approved technique content for ${found.name}`,
          data: {
            name: found.name,
            setupInstructions: found.setup_instructions,
            executionSteps: found.execution_steps,
            formCues: found.form_cues,
            commonMistakes: found.common_mistakes,
            safetyNotes: found.safety_notes,
          },
        };
      });

    case 'get_approved_substitutions':
      return withTenant(session, async (db) => {
        const { rows } = await db.query<{ name: string; reason: string }>(
          `select alt.name, es.reason
             from exercise_substitutions es
             join exercises alt on alt.id = es.alternative_exercise_id
             join exercises orig on orig.id = es.exercise_id
             left join branch_equipment be on true
            where lower($1) like '%' || lower(orig.name) || '%'
            order by es.preference_rank limit 5`,
          [message],
        );
        return {
          name: tool,
          summary: `${rows.length} approved alternative(s)`,
          data: rows,
        };
      });

    case 'create_support_case':
      return { name: tool, summary: 'Handed to gym staff', data: null };

    default:
      return null;
  }
}

async function openSupportCase(actor: Actor, message: string, intent: string): Promise<string> {
  const session = tenantSessionFor(actor);
  return withTenant(session, async (db) => {
    const reference = await nextCaseReference(db);
    await db.query(
      `insert into support_cases
         (organization_id, branch_id, reference, member_user_id, raised_by_ai, category, priority,
          state, subject, detail, contains_health_data, assigned_role, sla_due_at)
       select $1, mp.branch_id, $2, $3, true, $4, 'normal', 'open', $5, $6, false, 'coach',
              now() + interval '24 hours'
         from member_profiles mp where mp.user_id = $3`,
      [
        actor.organizationId,
        reference,
        actor.userId,
        intent === 'nutrition_general' || intent === 'extreme_diet' ? 'nutrition' : 'coaching',
        `Member asked GymGuide Coach for help (${intent.replace(/_/g, ' ')})`,
        `The AI coach could not safely answer this and handed it to a person.\n\nMember wrote: "${message.slice(0, 500)}"`,
      ],
    );
    return reference;
  });
}

async function nextCaseReference(db: Queryable): Promise<string> {
  const { rows } = await db.query<{ reference: string | null }>(
    `select max(reference) as reference from support_cases where reference like 'APX-C-%'`,
  );
  const last = rows[0]?.reference;
  return `APX-C-${last ? Number(last.split('-').pop()) + 1 : 1001}`;
}

/** Conversation history for the member's Support tab. */
export async function loadCoachThread(actor: Actor): Promise<AiCoachMessage[]> {
  return withTenant(tenantSessionFor(actor), async (db) => {
    const { rows } = await db.query<{
      id: string; user_input: string | null; output_text: string | null;
      safety_result: string; created_at: string; approved_sources: unknown;
    }>(
      `select id, user_input, output_text, safety_result, created_at, approved_sources
         from ai_interactions
        where user_id = $1 and surface = 'member_coach'
        order by created_at asc limit 40`,
      [actor.userId],
    );

    const messages: AiCoachMessage[] = [];
    for (const row of rows) {
      if (row.user_input) {
        messages.push({
          id: `${row.id}-in`,
          role: 'member',
          body: row.user_input,
          isAiAssisted: false,
          createdAt: row.created_at,
        });
      }
      if (row.output_text) {
        messages.push({
          id: row.id,
          role: 'coach_ai',
          body: row.output_text,
          isAiAssisted: true,
          createdAt: row.created_at,
          safetyResult: row.safety_result as 'allowed',
          sources: ((row.approved_sources as Array<{ kind: string; label: string }>) ?? []).map((source) => ({
            ...source,
            id: null,
          })),
        });
      }
    }
    return messages;
  });
}
