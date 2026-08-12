import 'server-only';
/**
 * Member records: search, the member profile screen, and enrolment.
 *
 * Enrolment is the front desk's most important flow and runs as one
 * transaction: user → profile → consent → waiver → emergency contact →
 * membership → first invoice → ledger → app invite. Either all of it happens or
 * none of it does; a half-enrolled member is worse than no member.
 */
import {
  computeInvoice,
  computePeriod,
  deriveInvoiceState,
  postInvoiceIssued,
  assessScreening,
  decideSafety,
  matchProgram,
  type DraftLine,
  type MatchProfile,
  type ProgramCandidate,
} from '@gymguide/domain';
import { can, type Actor, type EnrolMemberInput, type MemberListRow } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant, type Queryable } from '../db/pool';
import { recordAudit, recordSensitiveRead } from '../audit';
import { generateToken, hashToken } from '../auth/password';

export interface MemberFilters {
  search?: string;
  branchId?: string;
  lifecycleStage?: string;
  coachId?: string;
  risk?: 'at_risk' | 'unpaid' | 'no_waiver' | 'escalation';
  page?: number;
  pageSize?: number;
}

export async function listMembers(
  actor: Actor,
  filters: MemberFilters = {},
): Promise<{ rows: MemberListRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, filters.pageSize ?? 25);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(full_name ilike $${params.length} or member_number ilike $${params.length} or coalesce(email,'') ilike $${params.length} or coalesce(phone,'') ilike $${params.length})`,
    );
  }
  if (filters.branchId) {
    params.push(filters.branchId);
    conditions.push(`branch_id = $${params.length}`);
  }
  if (filters.lifecycleStage) {
    params.push(filters.lifecycleStage);
    conditions.push(`lifecycle_stage = $${params.length}::lifecycle_stage`);
  }
  if (filters.coachId) {
    params.push(filters.coachId);
    conditions.push(`assigned_coach_id = $${params.length}`);
  }
  if (filters.risk === 'at_risk') conditions.push('inactivity_risk_score >= 45');
  if (filters.risk === 'unpaid') conditions.push('balance_due_minor > 0');
  if (filters.risk === 'escalation') conditions.push('open_high_risk_count > 0');

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  params.push(pageSize, (page - 1) * pageSize);

  return withTenant(tenantSessionFor(actor), async (db) => {
    const [rows, total] = await Promise.all([
      db.query<Record<string, string | number | null>>(
        `select * from member_overview ${where}
          order by full_name asc
          limit $${params.length - 1} offset $${params.length}`,
        params,
      ),
      db.query<{ count: string }>(
        `select count(*) as count from member_overview ${where}`,
        params.slice(0, params.length - 2),
      ),
    ]);

    return {
      rows: rows.rows.map(toMemberListRow),
      total: Number(total.rows[0]?.count ?? 0),
      page,
      pageSize,
    };
  });
}

function toMemberListRow(row: Record<string, unknown>): MemberListRow {
  return {
    memberProfileId: String(row.member_profile_id),
    userId: String(row.user_id),
    memberNumber: String(row.member_number),
    fullName: String(row.full_name),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    branchId: String(row.branch_id),
    branchName: String(row.branch_name),
    lifecycleStage: row.lifecycle_stage as MemberListRow['lifecycleStage'],
    primaryGoal: (row.primary_goal as MemberListRow['primaryGoal']) ?? null,
    experienceLevel: (row.experience_level as MemberListRow['experienceLevel']) ?? null,
    coachName: (row.coach_name as string | null) ?? null,
    membershipState: (row.membership_state as MemberListRow['membershipState']) ?? null,
    planName: (row.plan_name as string | null) ?? null,
    membershipPeriodEnd: (row.membership_period_end as string | null) ?? null,
    balanceDueMinor: Number(row.balance_due_minor ?? 0),
    currency: (row.currency as string) ?? 'PKR',
    lastVisitAt: (row.last_visit_at as string | null) ?? null,
    lastWorkoutAt: (row.last_workout_at as string | null) ?? null,
    inactivityRiskScore: Number(row.inactivity_risk_score ?? 0),
    openHighRiskCount: Number(row.open_high_risk_count ?? 0),
    onboardingCompletedAt: (row.onboarding_completed_at as string | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Member detail
// ---------------------------------------------------------------------------

export interface MemberDetail {
  member: MemberListRow;
  profile: {
    dateOfBirth: string | null;
    joinedOn: string | null;
    heightCm: number | null;
    startingWeightKg: number | null;
    targetWeightKg: number | null;
    trainingDaysPerWeek: number | null;
    ramadanMode: boolean;
    notesSummary: string | null;
    progressionHoldReason: string | null;
    guardianName: string | null;
  };
  program: { name: string; week: number; state: string; startsOn: string } | null;
  adherence: { completed: number; planned: number; percent: number };
  recentSessions: Array<{ id: string; title: string; scheduledFor: string; state: string; volumeKg: number; sets: number }>;
  /** Only present with finance.read. */
  billing: {
    invoices: Array<{ id: string; number: string; state: string; totalMinor: number; balanceMinor: number; dueAt: string }>;
    payments: Array<{ id: string; reference: string; method: string; amountMinor: number; receivedAt: string; receiptNumber: string | null }>;
    balanceMinor: number;
  } | null;
  /** Only present with health.read. Reading it writes an audit record. */
  health: {
    screening: {
      completedAt: string;
      conditions: string[];
      painAreas: string[];
      requiresClearance: boolean;
      pregnancyStatus: string | null;
    } | null;
    riskFlags: Array<{ id: string; kind: string; severity: string; detail: string | null; raisedAt: string; resolvedAt: string | null }>;
  } | null;
  notes: Array<{ id: string; body: string; visibility: string; authorName: string | null; createdAt: string }>;
  consents: Array<{ kind: string; granted: boolean; grantedAt: string | null; version: string }>;
  timeline: Array<{ at: string; kind: string; summary: string }>;
}

export async function getMemberDetail(actor: Actor, userId: string): Promise<MemberDetail | null> {
  const session = tenantSessionFor(actor);
  const showsMoney = can(actor, 'finance.read');
  const showsHealth = can(actor, 'health.read');

  const detail = await withTenant(session, async (db) => {
    const overview = await db.query<Record<string, unknown>>(
      'select * from member_overview where user_id = $1',
      [userId],
    );
    const base = overview.rows[0];
    if (!base) return null;

    const [profile, program, adherence, sessions, notes, consents, invoices, payments, health, risks, audit] =
      await Promise.all([
        db.query<Record<string, unknown>>(
          `select mp.date_of_birth, mp.joined_on, mp.height_cm, mp.starting_weight_kg, mp.target_weight_kg,
                  mp.training_days_per_week, mp.ramadan_mode, mp.notes_summary, mp.progression_hold_reason,
                  g.full_name as guardian_name
             from member_profiles mp
             left join users g on g.id = mp.guardian_user_id
            where mp.user_id = $1`,
          [userId],
        ),
        db.query<{ name: string; current_week: number; state: string; starts_on: string }>(
          `select p.name, pa.current_week, pa.state, pa.starts_on
             from program_assignments pa join programs p on p.id = pa.program_id
            where pa.user_id = $1 and pa.state = 'active' limit 1`,
          [userId],
        ),
        db.query<{ completed: string; planned: string }>(
          `select count(*) filter (where state = 'completed') as completed,
                  count(*) as planned
             from workout_sessions
            where user_id = $1 and scheduled_for >= current_date - 28`,
          [userId],
        ),
        db.query<{ id: string; title: string; scheduled_for: string; state: string; total_volume_kg: string; completed_sets: number }>(
          `select id, title, scheduled_for, state, total_volume_kg, completed_sets
             from workout_sessions where user_id = $1
            order by scheduled_for desc limit 10`,
          [userId],
        ),
        db.query<{ id: string; body: string; visibility: string; author_name: string | null; created_at: string }>(
          `select n.id, n.body, n.visibility, u.full_name as author_name, n.created_at
             from notes n left join users u on u.id = n.author_user_id
            where n.entity_type = 'member' and n.entity_id = $1 and n.deleted_at is null
            order by n.is_pinned desc, n.created_at desc limit 20`,
          [userId],
        ),
        db.query<{ kind: string; granted: boolean; granted_at: string | null; version: string }>(
          `select distinct on (kind) kind, granted, granted_at, version
             from consents where user_id = $1 order by kind, created_at desc`,
          [userId],
        ),
        showsMoney
          ? db.query<{ id: string; number: string; state: string; total_minor: string; balance_minor: string; due_at: string }>(
              `select id, number, state, total_minor, (total_minor - amount_paid_minor) as balance_minor, due_at
                 from invoices where user_id = $1 order by issued_at desc limit 12`,
              [userId],
            )
          : Promise.resolve({ rows: [], rowCount: 0 }),
        showsMoney
          ? db.query<{ id: string; reference: string; method: string; amount_minor: string; received_at: string; receipt_number: string | null }>(
              `select id, reference, method, amount_minor, received_at, receipt_number
                 from payments where user_id = $1 and state = 'succeeded'
                order by received_at desc limit 12`,
              [userId],
            )
          : Promise.resolve({ rows: [], rowCount: 0 }),
        showsHealth
          ? db.query<Record<string, unknown>>(
              `select completed_at, reported_conditions, pain_areas, requires_clearance, pregnancy_status
                 from health_screenings where user_id = $1 order by completed_at desc limit 1`,
              [userId],
            )
          : Promise.resolve({ rows: [], rowCount: 0 }),
        showsHealth
          ? db.query<{ id: string; kind: string; severity: string; detail: string | null; raised_at: string; resolved_at: string | null }>(
              `select id, kind, severity, detail, raised_at, resolved_at from risk_flags
                where user_id = $1 order by raised_at desc limit 10`,
              [userId],
            )
          : Promise.resolve({ rows: [], rowCount: 0 }),
        db.query<{ occurred_at: string; action: string; summary: string }>(
          `select occurred_at, action::text as action, summary from audit_logs
            where subject_user_id = $1 order by occurred_at desc limit 15`,
          [userId],
        ),
      ]);

    const profileRow = profile.rows[0] ?? {};
    const adherenceRow = adherence.rows[0]!;
    const completed = Number(adherenceRow.completed);
    const planned = Number(adherenceRow.planned);

    return {
      member: toMemberListRow(base),
      profile: {
        dateOfBirth: (profileRow.date_of_birth as string | null) ?? null,
        joinedOn: (profileRow.joined_on as string | null) ?? null,
        heightCm: profileRow.height_cm ? Number(profileRow.height_cm) : null,
        startingWeightKg: profileRow.starting_weight_kg ? Number(profileRow.starting_weight_kg) : null,
        targetWeightKg: profileRow.target_weight_kg ? Number(profileRow.target_weight_kg) : null,
        trainingDaysPerWeek: profileRow.training_days_per_week ? Number(profileRow.training_days_per_week) : null,
        ramadanMode: Boolean(profileRow.ramadan_mode),
        notesSummary: (profileRow.notes_summary as string | null) ?? null,
        progressionHoldReason: (profileRow.progression_hold_reason as string | null) ?? null,
        guardianName: (profileRow.guardian_name as string | null) ?? null,
      },
      program: program.rows[0]
        ? {
            name: program.rows[0].name,
            week: program.rows[0].current_week,
            state: program.rows[0].state,
            startsOn: program.rows[0].starts_on,
          }
        : null,
      adherence: { completed, planned, percent: planned ? Math.round((completed / planned) * 100) : 0 },
      recentSessions: sessions.rows.map((row) => ({
        id: row.id,
        title: row.title,
        scheduledFor: row.scheduled_for,
        state: row.state,
        volumeKg: Number(row.total_volume_kg),
        sets: row.completed_sets,
      })),
      billing: showsMoney
        ? {
            invoices: invoices.rows.map((row) => ({
              id: row.id,
              number: row.number,
              state: row.state,
              totalMinor: Number(row.total_minor),
              balanceMinor: Number(row.balance_minor),
              dueAt: row.due_at,
            })),
            payments: payments.rows.map((row) => ({
              id: row.id,
              reference: row.reference,
              method: row.method,
              amountMinor: Number(row.amount_minor),
              receivedAt: row.received_at,
              receiptNumber: row.receipt_number,
            })),
            balanceMinor: invoices.rows.reduce((sum, row) => sum + Number(row.balance_minor), 0),
          }
        : null,
      health: showsHealth
        ? {
            screening: health.rows[0]
              ? {
                  completedAt: String(health.rows[0].completed_at),
                  conditions: (health.rows[0].reported_conditions as string[]) ?? [],
                  painAreas: (health.rows[0].pain_areas as string[]) ?? [],
                  requiresClearance: Boolean(health.rows[0].requires_clearance),
                  pregnancyStatus: (health.rows[0].pregnancy_status as string | null) ?? null,
                }
              : null,
            riskFlags: risks.rows.map((row) => ({
              id: row.id,
              kind: row.kind,
              severity: row.severity,
              detail: row.detail,
              raisedAt: row.raised_at,
              resolvedAt: row.resolved_at,
            })),
          }
        : null,
      notes: notes.rows.map((row) => ({
        id: row.id,
        body: row.body,
        visibility: row.visibility,
        authorName: row.author_name,
        createdAt: row.created_at,
      })),
      consents: consents.rows.map((row) => ({
        kind: row.kind,
        granted: row.granted,
        grantedAt: row.granted_at,
        version: row.version,
      })),
      timeline: audit.rows.map((row) => ({ at: row.occurred_at, kind: row.action, summary: row.summary })),
    } satisfies MemberDetail;
  });

  // Opening a member's health tab is itself an auditable event.
  if (detail?.health?.screening) {
    await recordSensitiveRead({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      entityType: 'health_screening',
      entityId: userId,
      subjectUserId: userId,
      summary: `Viewed health screening for ${detail.member.fullName}`,
    });
  }

  return detail;
}

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

export interface EnrolResult {
  ok: boolean;
  userId?: string;
  memberNumber?: string;
  invoiceId?: string;
  inviteToken?: string | null;
  programAssigned?: string | null;
  needsCoachAssignment?: boolean;
  safetyNotice?: string | null;
  error?: string;
}

export async function enrolMember(actor: Actor, input: EnrolMemberInput): Promise<EnrolResult> {
  if (!can(actor, 'members.write')) return { ok: false, error: 'You do not have permission to enrol members.' };
  if (!can(actor, 'consent.collect')) return { ok: false, error: 'You cannot collect consent on a member’s behalf.' };
  if (!actor.organizationId) return { ok: false, error: 'No organization in context.' };

  const session = tenantSessionFor(actor);

  try {
    const result = await withTenant(session, async (db) => {
      // 1. Member number, sequential per organization.
      const { rows: numberRows } = await db.query<{ next: string }>(
        `select coalesce(max(substring(member_number from '[0-9]+$')::int), 1000) + 1 as next
           from member_profiles`,
      );
      const memberNumber = `APX-${numberRows[0]?.next ?? 1001}`;

      // 2. User + role.
      const { rows: userRows } = await db.query<{ id: string }>(
        `insert into users (organization_id, email, phone, full_name, status, locale, timezone)
         values ($1, $2, $3, $4, 'invited', $5, 'Asia/Karachi')
         returning id`,
        [actor.organizationId, input.email ?? null, input.phone, input.fullName, input.locale],
      );
      const userId = userRows[0]!.id;
      await db.query(
        `insert into user_roles (user_id, role_id, organization_id)
         select $1, r.id, $2 from roles r where r.code = 'member'`,
        [userId, actor.organizationId],
      );

      // 3. Profile.
      await db.query(
        `insert into member_profiles
           (organization_id, branch_id, user_id, member_number, date_of_birth, gender, lifecycle_stage,
            joined_on, primary_goal, experience_level, assigned_coach_id, onboarding_step)
         values ($1,$2,$3,$4,$5,$6,'active',current_date,$7,$8,$9,'invited')`,
        [
          actor.organizationId,
          input.branchId,
          userId,
          memberNumber,
          input.dateOfBirth ?? null,
          input.gender,
          input.primaryGoal,
          input.experienceLevel,
          input.assignedCoachId ?? null,
        ],
      );

      // 4. Consent evidence — one immutable row per decision.
      const consentPairs: Array<[string, boolean]> = [
        ['terms', input.consents.terms],
        ['privacy', input.consents.privacy],
        ['health_data', input.consents.healthData],
        ['progress_photos', input.consents.progressPhotos],
        ['ai_coaching', input.consents.aiCoaching],
        ['marketing_email', input.consents.marketingEmail],
        ['marketing_sms', input.consents.marketingSms],
        ['marketing_whatsapp', input.consents.marketingWhatsapp],
      ];
      for (const [kind, granted] of consentPairs) {
        await db.query(
          `insert into consents (organization_id, user_id, kind, granted, version, collected_by, collected_channel, granted_at)
           values ($1,$2,$3::consent_kind,$4,'2026.1',$5,'front_desk',case when $4 then now() else null end)`,
          [actor.organizationId, userId, kind, granted, actor.userId],
        );
      }

      // 5. Waiver.
      await db.query(
        `insert into waivers (organization_id, branch_id, user_id, template_code, template_version, body_snapshot,
                              signature_name, signed_at, witnessed_by)
         values ($1,$2,$3,'liability_waiver','2026.1',$4,$5,now(),$6)`,
        [
          actor.organizationId,
          input.branchId,
          userId,
          'I confirm that I am participating in physical exercise at my own risk, that I have disclosed relevant health conditions, and that I will stop and inform staff if I feel unwell.',
          input.waiverSignatureName,
          actor.userId,
        ],
      );

      // 6. Emergency contact.
      await db.query(
        `insert into emergency_contacts (organization_id, user_id, full_name, relationship, phone, is_primary)
         values ($1,$2,$3,$4,$5,true)`,
        [
          actor.organizationId,
          userId,
          input.emergencyContact.fullName,
          input.emergencyContact.relationship,
          input.emergencyContact.phone,
        ],
      );

      // 7. Membership + first invoice.
      const { rows: planRows } = await db.query<{
        id: string; name: string; price_minor: string; joining_fee_minor: string;
        billing_interval: string; tax_rate_bps: number; class_credits: number | null; currency: string;
      }>(
        `select id, name, price_minor, joining_fee_minor, billing_interval, tax_rate_bps, class_credits, currency
           from membership_plans where id = $1 and is_active`,
        [input.membershipPlanId],
      );
      const plan = planRows[0];
      if (!plan) throw new Error('That membership plan is not available.');

      const period = computePeriod(input.membershipStartsOn, plan.billing_interval as 'monthly');
      const { rows: membershipRows } = await db.query<{ id: string }>(
        `insert into member_memberships
           (organization_id, branch_id, user_id, membership_plan_id, state, starts_on,
            current_period_start, current_period_end, next_invoice_on, price_minor, currency,
            credits_remaining, sold_by_user_id)
         values ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9,$10,$11,$12)
         returning id`,
        [
          actor.organizationId, input.branchId, userId, plan.id, input.membershipStartsOn,
          period.start, period.end, period.nextInvoiceOn, plan.price_minor, plan.currency,
          plan.class_credits && plan.class_credits < 100 ? plan.class_credits : null, actor.userId,
        ],
      );
      const membershipId = membershipRows[0]!.id;

      const lines: DraftLine[] = [
        {
          description: `${plan.name} (${period.start} → ${period.end})`,
          lineKind: 'membership',
          membershipPlanId: plan.id,
          quantity: 1,
          unitPriceMinor: Number(plan.price_minor),
          taxRateBps: plan.tax_rate_bps,
          periodStart: period.start,
          periodEnd: period.end,
        },
      ];
      if (input.chargeJoiningFee && Number(plan.joining_fee_minor) > 0) {
        lines.push({
          description: 'One-time joining fee',
          lineKind: 'joining_fee',
          quantity: 1,
          unitPriceMinor: Number(plan.joining_fee_minor),
          taxRateBps: plan.tax_rate_bps,
        });
      }

      const computed = computeInvoice(lines, plan.currency);
      const number = await nextInvoiceNumber(db);

      const { rows: invoiceRows } = await db.query<{ id: string }>(
        `insert into invoices
           (organization_id, branch_id, user_id, member_membership_id, number, state, currency,
            subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, tax_rate_bps,
            due_at, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,now() + interval '7 days',$13)
         returning id`,
        [
          actor.organizationId, input.branchId, userId, membershipId, number,
          deriveInvoiceState({ totalMinor: computed.totalMinor, amountPaidMinor: 0, amountRefundedMinor: 0, voided: false }),
          plan.currency, computed.subtotalMinor, computed.discountMinor, computed.taxMinor,
          computed.totalMinor, plan.tax_rate_bps, actor.userId,
        ],
      );
      const invoiceId = invoiceRows[0]!.id;

      let sortOrder = 0;
      for (const line of computed.lines) {
        await db.query(
          `insert into invoice_lines
             (organization_id, invoice_id, membership_plan_id, description, line_kind, quantity,
              unit_price_minor, discount_minor, tax_rate_bps, tax_minor, total_minor, period_start, period_end, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            actor.organizationId, invoiceId, line.membershipPlanId ?? null, line.description, line.lineKind,
            line.quantity, line.unitPriceMinor, line.discountMinor, line.taxRateBps, line.taxMinor,
            line.totalMinor, line.periodStart ?? null, line.periodEnd ?? null, sortOrder++,
          ],
        );
      }

      // 8. Ledger.
      const ledger = postInvoiceIssued({
        currency: plan.currency,
        invoiceNumber: number,
        lines: computed.lines.map((l) => ({
          lineKind: l.lineKind,
          netMinor: l.netMinor,
          discountMinor: l.discountMinor,
          taxMinor: l.taxMinor,
          description: l.description,
        })),
      });
      const entryGroup = crypto.randomUUID();
      for (const posting of ledger.postings) {
        await db.query(
          `insert into ledger_entries
             (organization_id, branch_id, entry_group, account, direction, amount_minor, currency,
              user_id, invoice_id, memo, created_by)
           values ($1,$2,$3,$4::ledger_account,$5::ledger_direction,$6,$7,$8,$9,$10,$11)`,
          [
            actor.organizationId, input.branchId, entryGroup, posting.account, posting.direction,
            posting.amountMinor, plan.currency, userId, invoiceId, posting.memo, actor.userId,
          ],
        );
      }

      // 9. Notification preferences (opt-in defaults reflect the consent given).
      for (const channel of ['in_app', 'push', 'email', 'sms', 'whatsapp']) {
        await db.query(
          `insert into notification_preferences
             (organization_id, user_id, channel, operational_enabled, coaching_enabled, billing_enabled,
              marketing_enabled, opted_in_at)
           values ($1,$2,$3::notification_channel,true,true,true,$4,$5)`,
          [
            actor.organizationId,
            userId,
            channel,
            channel === 'email' ? input.consents.marketingEmail
              : channel === 'sms' ? input.consents.marketingSms
              : channel === 'whatsapp' ? input.consents.marketingWhatsapp
              : false,
            channel === 'whatsapp' && !input.consents.marketingWhatsapp ? null : new Date(),
          ],
        );
      }

      // 10. Check-in credential.
      const credentialToken = generateToken(24);
      await db.query(
        `insert into access_credentials (organization_id, branch_id, user_id, kind, token_hash, display_hint)
         values ($1,$2,$3,'qr',$4,$5)`,
        [actor.organizationId, input.branchId, userId, hashToken(credentialToken), memberNumber],
      );

      // 11. App invite.
      let inviteToken: string | null = null;
      if (input.sendAppInvite) {
        inviteToken = generateToken(32);
        await db.query(
          `update users set invite_token_hash = $1, invite_expires_at = now() + interval '14 days' where id = $2`,
          [hashToken(inviteToken), userId],
        );
        await db.query(
          `insert into notifications
             (organization_id, branch_id, user_id, channel, category, title, body, cta_label, cta_path, state, sent_at)
           values ($1,$2,$3,'in_app','operational',$4,$5,'Set up my app','/invite','sent',now())`,
          [
            actor.organizationId,
            input.branchId,
            userId,
            'Welcome to the gym',
            `Hi ${input.fullName.split(' ')[0]} — your membership is active and your plan is waiting in the app.`,
          ],
        );
      }

      if (input.notes) {
        await db.query(
          `insert into notes (organization_id, branch_id, entity_type, entity_id, author_user_id, body, visibility)
           values ($1,$2,'member',$3,$4,$5,'staff')`,
          [actor.organizationId, input.branchId, userId, actor.userId, input.notes],
        );
      }

      // 12. Match an approved program (the engine proposes, a coach can change).
      const assignment = await assignBestProgram(db, {
        organizationId: actor.organizationId!,
        branchId: input.branchId,
        userId,
        goal: input.primaryGoal,
        experienceLevel: input.experienceLevel,
        assignedBy: actor.userId,
      });

      return {
        userId,
        memberNumber,
        invoiceId,
        inviteToken,
        programAssigned: assignment.programName,
        needsCoachAssignment: assignment.needsHuman,
      };
    });

    await recordAudit({
      organizationId: actor.organizationId,
      branchId: input.branchId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'create',
      entityType: 'member',
      entityId: result.userId,
      subjectUserId: result.userId,
      summary: `Enrolled ${input.fullName} (${result.memberNumber}) on ${input.membershipPlanId}`,
      after: { memberNumber: result.memberNumber, plan: input.membershipPlanId, invoice: result.invoiceId },
    });
    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'consent_capture',
      entityType: 'consent',
      subjectUserId: result.userId,
      summary: `Captured consent and a signed waiver for ${input.fullName}`,
      after: input.consents,
    });

    return { ok: true, ...result, safetyNotice: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrolment failed.';
    return { ok: false, error: message };
  }
}

async function nextInvoiceNumber(db: Queryable): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await db.query<{ number: string | null }>(
    `select max(number) as number from invoices where number like $1`,
    [`APX-${year}-%`],
  );
  const last = rows[0]?.number;
  const sequence = last ? Number(last.split('-').pop()) + 1 : 1;
  return `APX-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Pick an approved template for a new member. Returns needsHuman when the
 * matcher is not confident enough to assign without a coach looking.
 */
async function assignBestProgram(
  db: Queryable,
  input: {
    organizationId: string;
    branchId: string;
    userId: string;
    goal: string;
    experienceLevel: string;
    assignedBy: string;
  },
): Promise<{ programName: string | null; needsHuman: boolean }> {
  const { rows: equipment } = await db.query<{ code: string }>(
    `select e.code from branch_equipment be join equipment e on e.id = be.equipment_id
      where be.branch_id = $1 and be.is_available`,
    [input.branchId],
  );

  const { rows: programs } = await db.query<Record<string, unknown>>(
    `select p.id, p.code, p.name, p.summary, p.intent, p.goal, p.experience_level, p.days_per_week,
            p.session_minutes, p.total_weeks, p.requires_equipment_codes, p.low_impact, p.ramadan_friendly,
            p.contraindications, p.scope, pv.id as version_id
       from programs p
       join program_versions pv on pv.program_id = p.id and pv.publish_state = 'published'
      where p.publish_state = 'published'
        and (p.organization_id is null or p.organization_id = $1)`,
    [input.organizationId],
  );

  const candidates: ProgramCandidate[] = programs.map((row) => ({
    programId: String(row.id),
    code: String(row.code),
    name: String(row.name),
    summary: String(row.summary),
    intent: row.intent as ProgramCandidate['intent'],
    goal: row.goal as ProgramCandidate['goal'],
    experienceLevel: row.experience_level as ProgramCandidate['experienceLevel'],
    daysPerWeek: Number(row.days_per_week),
    sessionMinutes: Number(row.session_minutes),
    totalWeeks: Number(row.total_weeks),
    requiresEquipmentCodes: (row.requires_equipment_codes as string[]) ?? [],
    lowImpact: Boolean(row.low_impact),
    ramadanFriendly: Boolean(row.ramadan_friendly),
    contraindications: (row.contraindications as string[]) ?? [],
    scope: row.scope as ProgramCandidate['scope'],
  }));

  const profile: MatchProfile = {
    goal: input.goal as MatchProfile['goal'],
    experienceLevel: input.experienceLevel as MatchProfile['experienceLevel'],
    daysPerWeek: input.experienceLevel === 'first_time' ? 2 : 3,
    sessionMinutes: input.experienceLevel === 'first_time' ? 30 : 45,
    availableEquipmentCodes: equipment.map((row) => row.code),
    needsLowImpact: false,
    ramadanMode: false,
    trainsAtHome: false,
    conditions: [],
    requiresHumanReview: false,
  };

  const outcome = matchProgram(profile, candidates);
  if (!outcome.best || outcome.needsHumanAssignment) {
    return { programName: outcome.best?.program.name ?? null, needsHuman: true };
  }

  const versionRow = programs.find((row) => row.id === outcome.best!.program.programId);
  await db.query(
    `insert into program_assignments
       (organization_id, branch_id, user_id, program_id, program_version_id, assigned_by,
        assignment_source, state, starts_on)
     values ($1,$2,$3,$4,$5,$6,'engine','active',current_date)`,
    [
      input.organizationId,
      input.branchId,
      input.userId,
      outcome.best.program.programId,
      versionRow?.version_id,
      input.assignedBy,
    ],
  );
  return { programName: outcome.best.program.name, needsHuman: false };
}

/** Used by the onboarding flow to fold screening answers into risk decisions. */
export function screeningDecision(answers: Parameters<typeof assessScreening>[0]) {
  return decideSafety(assessScreening(answers));
}
