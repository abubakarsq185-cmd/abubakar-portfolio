import 'server-only';
/**
 * The escalation pathway.
 *
 * When a member reports something that needs a person, this module does five
 * things in one transaction, in this order:
 *   1. write a risk flag,
 *   2. stop automatic progression for the affected movements,
 *   3. open a high-priority, health-restricted support case,
 *   4. notify the right staff role (bypassing quiet hours — safety only),
 *   5. audit the whole thing.
 *
 * The member sees calm, non-diagnostic copy. Nobody is told they are fine.
 */
import { assessScreening, assessWorkoutReport, decideSafety, triageFreeText, type DetectedRisk, type SafetyDecision } from '@gymguide/domain';
import type { Actor, MovementPattern, RiskKind } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant, withOwner, type Queryable } from '../db/pool';
import { recordAudit } from '../audit';

export interface EscalationResult {
  escalated: boolean;
  caseReference: string | null;
  memberNotice: { title: string; body: string; tone: 'info' | 'warning' | 'stop' } | null;
  progressionPaused: boolean;
  restrictedMovements: string[];
}

export async function reportMemberRisk(
  actor: Actor,
  input: {
    memberUserId: string;
    kind: RiskKind;
    detail?: string;
    movementPattern?: MovementPattern;
    discomfortLevel?: number;
    workoutSessionId?: string;
    source?: 'member_report' | 'workout_log' | 'coach';
  },
): Promise<EscalationResult> {
  const risk = assessWorkoutReport({
    kind: input.kind,
    detail: input.detail,
    movementPattern: input.movementPattern,
    discomfortLevel: input.discomfortLevel,
  });
  const decision = decideSafety([risk]);
  return applySafetyDecision(actor, input.memberUserId, decision, {
    workoutSessionId: input.workoutSessionId,
    source: input.source ?? 'workout_log',
  });
}

/** Triage a free-text message (member chat, workout note, check-in answer). */
export async function triageMessage(
  actor: Actor,
  memberUserId: string,
  text: string,
): Promise<EscalationResult> {
  const risks = triageFreeText(text, 'member_report');
  if (risks.length === 0) {
    return { escalated: false, caseReference: null, memberNotice: null, progressionPaused: false, restrictedMovements: [] };
  }
  return applySafetyDecision(actor, memberUserId, decideSafety(risks), { source: 'member_report' });
}

/** Fold onboarding screening answers into flags, holds and escalations. */
export async function applyScreening(
  actor: Actor,
  memberUserId: string,
  answers: Parameters<typeof assessScreening>[0],
): Promise<EscalationResult & { decision: SafetyDecision }> {
  const decision = decideSafety(assessScreening(answers));
  const result = await applySafetyDecision(actor, memberUserId, decision, { source: 'screening' });
  return { ...result, decision };
}

async function applySafetyDecision(
  actor: Actor,
  memberUserId: string,
  decision: SafetyDecision,
  context: { workoutSessionId?: string | undefined; source: DetectedRisk['source'] },
): Promise<EscalationResult> {
  if (decision.risks.length === 0) {
    return { escalated: false, caseReference: null, memberNotice: null, progressionPaused: false, restrictedMovements: [] };
  }

  const session = tenantSessionFor(actor);

  const outcome = await withTenant(session, async (db) => {
    const member = await db.query<{ full_name: string; branch_id: string; organization_id: string }>(
      `select u.full_name, mp.branch_id, mp.organization_id
         from users u join member_profiles mp on mp.user_id = u.id
        where u.id = $1`,
      [memberUserId],
    );
    const memberRow = member.rows[0];
    if (!memberRow) throw new Error('Member not found.');

    let caseId: string | null = null;
    let caseReference: string | null = null;

    if (decision.staffEscalation) {
      // The member's organization, not the actor's: the case belongs to the gym
      // the member is in, and that is the same value the insert below uses.
      caseReference = await nextCaseReference(db, memberRow.organization_id);
      const { rows } = await db.query<{ id: string }>(
        `insert into support_cases
           (organization_id, branch_id, reference, member_user_id, raised_by_user_id, raised_by_ai,
            category, priority, state, subject, detail, contains_health_data, assigned_role, sla_due_at)
         values ($1,$2,$3,$4,$5,false,'health_escalation',$6::case_priority,'open',$7,$8,true,$9::role_code,
                 now() + ($10 || ' hours')::interval)
         returning id`,
        [
          memberRow.organization_id, memberRow.branch_id, caseReference, memberUserId,
          actor.userId === memberUserId ? memberUserId : actor.userId,
          decision.staffEscalation.priority, decision.staffEscalation.subject,
          decision.staffEscalation.detail, decision.staffEscalation.assignedRole,
          String(decision.staffEscalation.slaHours),
        ],
      );
      caseId = rows[0]!.id;
    }

    for (const risk of decision.risks) {
      await db.query(
        `insert into risk_flags
           (organization_id, branch_id, user_id, kind, severity, source, detail, affected_movements,
            blocks_progression, requires_human_review, support_case_id, raised_by)
         values ($1,$2,$3,$4::risk_kind,$5::risk_severity,$6,$7,$8,$9,$10,$11,$12)`,
        [
          memberRow.organization_id, memberRow.branch_id, memberUserId, risk.kind, risk.severity,
          context.source, risk.detail, risk.affectedMovements, risk.blocksProgression,
          risk.requiresHumanReview, caseId, actor.userId,
        ],
      );
    }

    if (decision.progressionHoldReason) {
      await db.query('update member_profiles set progression_hold_reason = $1 where user_id = $2', [
        decision.progressionHoldReason,
        memberUserId,
      ]);
      await db.query(
        `update program_assignments
            set progression_locked = true, progression_lock_reason = $1
          where user_id = $2 and state = 'active'`,
        [decision.progressionHoldReason, memberUserId],
      );
    }

    if (context.workoutSessionId) {
      await db.query('update workout_sessions set discomfort_reported = true where id = $1', [context.workoutSessionId]);
    }

    // Member-facing notice. Safety category, so the automation gate lets it
    // through quiet hours.
    if (decision.memberNotice) {
      await db.query(
        `insert into notifications
           (organization_id, branch_id, user_id, channel, category, title, body, state, sent_at, cta_label, cta_path)
         values ($1,$2,$3,'in_app','safety',$4,$5,'sent',now(),'Talk to gym staff','/app/support')`,
        [memberRow.organization_id, memberRow.branch_id, memberUserId, decision.memberNotice.title, decision.memberNotice.body],
      );
    }

    return { caseId, caseReference, memberName: memberRow.full_name, branchId: memberRow.branch_id, organizationId: memberRow.organization_id };
  });

  // Staff alerting uses the owner connection: the member who raised the flag has
  // no permission to write into staff members' notification rows, but the
  // escalation must reach them regardless.
  if (decision.staffEscalation && outcome.caseId) {
    await notifyStaffRole(
      outcome.organizationId,
      outcome.branchId,
      decision.staffEscalation.assignedRole,
      `Health escalation: ${outcome.memberName}`,
      `${decision.staffEscalation.subject}. Automatic plan changes are paused. Case ${outcome.caseReference}.`,
    );
  }

  await recordAudit({
    organizationId: actor.organizationId,
    branchId: outcome.branchId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'escalation',
    entityType: 'risk_flag',
    entityId: outcome.caseId,
    subjectUserId: memberUserId,
    summary: `${decision.highestSeverity} risk raised for ${outcome.memberName}: ${decision.risks.map((r) => r.kind).join(', ')}`,
    after: {
      severity: decision.highestSeverity,
      progressionHold: decision.progressionHoldReason,
      restrictedMovements: decision.restrictedMovements,
      caseReference: outcome.caseReference,
    },
  });

  return {
    escalated: Boolean(decision.staffEscalation),
    caseReference: outcome.caseReference,
    memberNotice: decision.memberNotice,
    progressionPaused: Boolean(decision.progressionHoldReason),
    restrictedMovements: decision.restrictedMovements,
  };
}

async function notifyStaffRole(
  organizationId: string,
  branchId: string,
  roleCode: string,
  title: string,
  body: string,
): Promise<void> {
  await withOwner(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `select distinct u.id
         from users u
         join user_roles ur on ur.user_id = u.id and ur.revoked_at is null
         join roles r on r.id = ur.role_id
         left join staff_assignments sa on sa.user_id = u.id
        where u.organization_id = $1 and r.code = $2::role_code
          and (sa.branch_id is null or sa.branch_id = $3)`,
      [organizationId, roleCode, branchId],
    );
    for (const staff of rows) {
      await db.query(
        `insert into notifications
           (organization_id, branch_id, user_id, channel, category, title, body, state, sent_at, cta_label, cta_path)
         values ($1,$2,$3,'in_app','safety',$4,$5,'sent',now(),'Open the escalation queue','/dashboard/escalations')`,
        [organizationId, branchId, staff.id, title, body],
      );
      await db.query(
        `insert into tasks
           (organization_id, branch_id, title, detail, category, priority, assignee_user_id, member_user_id, due_at)
         values ($1,$2,$3,$4,'health_escalation','urgent',$5,null, now() + interval '4 hours')`,
        [organizationId, branchId, title, body, staff.id],
      );
    }
  });
}

/**
 * Case references come from the atomic allocator, for the same two reasons the
 * invoice and member numbers do (migrations 0014 and 0015): `max(reference)`
 * reads through row-level security, so a branch-scoped user computes a number
 * already issued elsewhere, and two escalations raised at the same moment
 * compute the same one. This one was missed when the others were fixed.
 */
async function nextCaseReference(db: Queryable, organizationId: string): Promise<string> {
  const { rows } = await db.query<{ reference: string }>(
    `select app.next_document_number($1, 'support_case', 'APX-C') as reference`,
    [organizationId],
  );
  return rows[0]!.reference;
}

/** The escalation queue for staff with health.read. */
export async function loadEscalationQueue(actor: Actor) {
  return withTenant(tenantSessionFor(actor), async (db) => {
    const { rows } = await db.query<Record<string, unknown>>(
      `select * from escalation_queue
        order by case severity when 'critical' then 0 when 'high' then 1 when 'moderate' then 2 else 3 end,
                 raised_at asc`,
    );
    return rows.map((row) => ({
      riskFlagId: String(row.risk_flag_id),
      userId: String(row.user_id),
      memberName: String(row.member_name),
      kind: String(row.kind),
      severity: String(row.severity),
      source: String(row.source),
      detail: (row.detail as string | null) ?? null,
      blocksProgression: Boolean(row.blocks_progression),
      raisedAt: String(row.raised_at),
      hoursOpen: Number(row.hours_open),
      caseReference: (row.case_reference as string | null) ?? null,
      caseState: (row.case_state as string | null) ?? null,
    }));
  });
}

/** Resolve a flag. Only staff with health.write; always audited, never silent. */
export async function resolveRiskFlag(
  actor: Actor,
  riskFlagId: string,
  resolution: string,
  liftProgressionHold: boolean,
): Promise<{ ok: boolean; message: string }> {
  const session = tenantSessionFor(actor);
  try {
    const memberUserId = await withTenant(session, async (db) => {
      const { rows } = await db.query<{ user_id: string; support_case_id: string | null }>(
        `update risk_flags
            set resolved_by = $1, resolved_at = now(), resolution_note = $2
          where id = $3 and resolved_at is null
          returning user_id, support_case_id`,
        [actor.userId, resolution, riskFlagId],
      );
      const row = rows[0];
      if (!row) throw new Error('That flag is already resolved or not visible to you.');

      if (row.support_case_id) {
        await db.query(
          `update support_cases set state = 'resolved', resolved_at = now(), resolution_note = $1 where id = $2`,
          [resolution, row.support_case_id],
        );
      }

      if (liftProgressionHold) {
        const { rows: remaining } = await db.query<{ count: string }>(
          `select count(*) as count from risk_flags
            where user_id = $1 and resolved_at is null and blocks_progression`,
          [row.user_id],
        );
        if (Number(remaining[0]?.count ?? 0) === 0) {
          await db.query('update member_profiles set progression_hold_reason = null where user_id = $1', [row.user_id]);
          await db.query(
            `update program_assignments set progression_locked = false, progression_lock_reason = null
              where user_id = $1 and state = 'active'`,
            [row.user_id],
          );
        }
      }
      return row.user_id;
    });

    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'escalation',
      entityType: 'risk_flag',
      entityId: riskFlagId,
      subjectUserId: memberUserId,
      summary: 'Resolved a health escalation',
      reason: resolution,
      after: { liftProgressionHold },
    });

    return { ok: true, message: 'Escalation resolved.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not resolve that flag.' };
  }
}
