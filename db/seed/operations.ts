/**
 * Operational demo data: memberships and money, twelve weeks of training
 * history, classes and attendance, automations, escalations and support.
 *
 * Money is posted through the same double-entry helpers the application uses
 * (@gymguide/domain/billing), so the seeded ledger balances for real — the
 * finance integrity test asserts it.
 */
import {
  computeInvoice,
  computePeriod,
  deriveInvoiceState,
  postInvoiceIssued,
  postPaymentReceived,
  type DraftLine,
} from '@gymguide/domain';
import { MEMBERS, PLANS, type MemberSpec } from './data/people.js';
import type { OrgContext, PlatformIds } from './seed.js';
import {
  addDays,
  atTime,
  chance,
  insert,
  insertMany,
  intBetween,
  isoDate,
  moneyPkr,
  pick,
  step,
  uuidFor,
  type Db,
} from './lib.js';

const TODAY = new Date('2026-08-11T09:00:00.000Z');

interface WorkoutItemRow {
  id: string;
  exercise_id: string;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_seconds: number | null;
  starting_load_kg: string | null;
  load_step_kg: string;
  block_kind: string;
  exercise_name: string;
}

interface ProgramDayRow {
  id: string;
  week_number: number;
  day_number: number;
  workout_id: string;
  workout_name: string;
  phase_position: number;
}

export async function seedOperations(
  db: Db,
  platform: PlatformIds,
  org: OrgContext,
  rng: () => number,
): Promise<void> {
  await seedLeadsAndTrials(db, org, rng);
  await seedMembershipsAndMoney(db, org, rng);
  const trained = await seedTrainingHistory(db, platform, org, rng);
  await seedProgressAndCheckIns(db, org, rng, trained);
  await seedNutrition(db, platform, org);
  await seedSchedule(db, org, rng);
  await seedAutomationsAndNotifications(db, org);
  await seedSafetyAndSupport(db, org);
  await seedAuditAndAnalytics(db, org, rng);
}

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------

async function seedLeadsAndTrials(db: Db, org: OrgContext, rng: () => number): Promise<void> {
  step('crm: leads, trials, tasks');

  const leads = [
    { name: 'Areeba Siddiqui', phone: '+923334567201', status: 'new', source: 'instagram', interest: 'fat_loss', branch: 'gulberg', days: 1 },
    { name: 'Waleed Anwar', phone: '+923334567202', status: 'contacted', source: 'walk_in', interest: 'muscle_gain', branch: 'gulberg', days: 3 },
    { name: 'Sidra Kamal', phone: '+923334567203', status: 'trial_booked', source: 'referral', interest: 'general_fitness', branch: 'gulberg', days: 4 },
    { name: 'Hassan Zaidi', phone: '+923334567204', status: 'trial_attended', source: 'google', interest: 'strength', branch: 'dha', days: 6 },
    { name: 'Mehwish Tariq', phone: '+923334567205', status: 'new', source: 'facebook', interest: 'fat_loss', branch: 'dha', days: 1 },
    { name: 'Osama Latif', phone: '+923334567206', status: 'lost', source: 'walk_in', interest: 'muscle_gain', branch: 'gulberg', days: 22 },
    { name: 'Komal Riaz', phone: '+923334567207', status: 'contacted', source: 'instagram', interest: 'beginner_confidence', branch: 'dha', days: 2 },
    { name: 'Danish Iqbal', phone: '+923334567208', status: 'converted', source: 'referral', interest: 'fat_loss', branch: 'gulberg', days: 30 },
  ];

  for (const lead of leads) {
    const branchId = org.branchIds[lead.branch as 'gulberg' | 'dha'];
    const ownerKey = lead.branch === 'gulberg' ? 'front_desk_zoya' : 'front_desk_umar';
    const leadId = uuidFor(`lead:${lead.name}`);
    await insert(db, 'leads', {
      id: leadId,
      organization_id: org.organizationId,
      branch_id: branchId,
      full_name: lead.name,
      phone: lead.phone,
      email: `${lead.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      status: lead.status,
      source: lead.source,
      interest: lead.interest,
      message: lead.status === 'new' ? 'Asked about morning timings and ladies-only hours.' : null,
      owner_user_id: org.staffIds.get(ownerKey),
      lost_reason: lead.status === 'lost' ? 'Chose a gym closer to home' : null,
      next_follow_up_at: ['new', 'contacted'].includes(lead.status) ? addDays(TODAY, 1).toISOString() : null,
      created_at: addDays(TODAY, -lead.days).toISOString(),
    });

    if (lead.status === 'trial_booked' || lead.status === 'trial_attended') {
      await insert(db, 'trials', {
        id: uuidFor(`trial:${lead.name}`),
        organization_id: org.organizationId,
        branch_id: branchId,
        lead_id: leadId,
        kind: 'day_pass',
        starts_on: isoDate(addDays(TODAY, -lead.days + 1)),
        ends_on: isoDate(addDays(TODAY, -lead.days + 8)),
        sessions_allowed: 3,
        sessions_used: lead.status === 'trial_attended' ? 2 : 0,
      });
    }

    if (['new', 'contacted', 'trial_booked'].includes(lead.status)) {
      await insert(db, 'tasks', {
        id: uuidFor(`task:lead:${lead.name}`),
        organization_id: org.organizationId,
        branch_id: branchId,
        title: `Follow up with ${lead.name}`,
        detail: `${lead.source} lead interested in ${lead.interest.replace(/_/g, ' ')}.`,
        category: 'lead_followup',
        priority: lead.status === 'trial_booked' ? 'high' : 'normal',
        assignee_user_id: org.staffIds.get(ownerKey),
        related_entity_type: 'lead',
        related_entity_id: leadId,
        due_at: addDays(TODAY, 1).toISOString(),
        created_by: org.staffIds.get('manager_gulberg'),
      });
    }
  }

  // A couple of member-facing staff tasks so the dashboard queue is realistic.
  await insert(db, 'tasks', {
    id: uuidFor('task:hamza-checkin'),
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    title: 'Call Hamza Raza — 5 weeks without a session',
    detail: 'Offer the two-day plan and a time that fits around his shifts. Do not lead with the membership.',
    category: 'retention',
    priority: 'high',
    assignee_user_id: org.staffIds.get('coach_hassan'),
    member_user_id: org.memberIds.get('hamza'),
    related_entity_type: 'member',
    related_entity_id: org.memberIds.get('hamza'),
    due_at: addDays(TODAY, 1).toISOString(),
    created_by_automation: null,
    created_by: org.staffIds.get('manager_gulberg'),
  });
  await insert(db, 'tasks', {
    id: uuidFor('task:kamran-payment'),
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    title: 'Kamran Butt — payment 9 days overdue',
    detail: 'Card failed twice. He usually pays cash; catch him at his Tuesday evening session.',
    category: 'billing',
    priority: 'high',
    assignee_user_id: org.staffIds.get('front_desk_zoya'),
    member_user_id: org.memberIds.get('kamran'),
    due_at: TODAY.toISOString(),
    created_by: org.staffIds.get('manager_gulberg'),
  });
  void rng;
}

// ---------------------------------------------------------------------------
// Memberships, invoices, payments, ledger
// ---------------------------------------------------------------------------

async function seedMembershipsAndMoney(db: Db, org: OrgContext, rng: () => number): Promise<void> {
  step('billing: memberships, invoices, payments and a balanced ledger');

  let invoiceSequence = 1;
  let paymentSequence = 1;
  let receiptSequence = 1;

  for (const member of MEMBERS) {
    const userId = org.memberIds.get(member.key)!;
    const branchId = org.branchIds[member.branch];
    const plan = PLANS.find((p) => p.code === member.planCode)!;
    const planId = org.planIds.get(plan.code)!;
    const joinedOn = addDays(TODAY, -member.joinedDaysAgo);

    // How many billing periods have passed (cap the demo at 6).
    const monthsElapsed = Math.min(6, Math.max(1, Math.floor(member.joinedDaysAgo / 30) + 1));
    const currentPeriodStart = addDays(joinedOn, (monthsElapsed - 1) * 30);
    const period = computePeriod(isoDate(currentPeriodStart), plan.interval as 'monthly' | 'annual' | 'one_time');

    const membershipId = uuidFor(`membership:${member.key}`);
    const state = member.membershipState ?? (member.overdue ? 'past_due' : 'active');

    await insert(db, 'member_memberships', {
      id: membershipId,
      organization_id: org.organizationId,
      branch_id: branchId,
      user_id: userId,
      membership_plan_id: planId,
      payer_user_id: member.guardian ? org.guardianId : null,
      state,
      starts_on: isoDate(joinedOn),
      current_period_start: period.start,
      current_period_end: period.end,
      next_invoice_on: period.nextInvoiceOn,
      price_minor: moneyPkr(plan.price),
      currency: 'PKR',
      credits_remaining: plan.classCredits > 100 ? null : plan.classCredits,
      pt_sessions_remaining: null,
      auto_renew: state !== 'frozen',
      sold_by_user_id: org.staffIds.get(member.branch === 'gulberg' ? 'front_desk_zoya' : 'front_desk_umar'),
      created_at: joinedOn.toISOString(),
    });

    if (member.membershipState === 'frozen') {
      await insert(db, 'membership_freezes', {
        id: uuidFor(`freeze:${member.key}`),
        organization_id: org.organizationId,
        member_membership_id: membershipId,
        starts_on: isoDate(addDays(TODAY, -12)),
        ends_on: isoDate(addDays(TODAY, 18)),
        reason: 'Working abroad for a month — approved by the branch manager.',
        fee_minor: 0,
        approved_by: org.staffIds.get('manager_dha'),
      });
    }

    // One invoice per elapsed period.
    for (let index = 0; index < monthsElapsed; index += 1) {
      const issuedAt = addDays(joinedOn, index * 30);
      const isCurrent = index === monthsElapsed - 1;
      const invoiceId = uuidFor(`invoice:${member.key}:${index}`);
      const number = `APX-2026-${String(invoiceSequence++).padStart(4, '0')}`;

      const lines: DraftLine[] = [
        {
          description: `${plan.name} (${isoDate(issuedAt)} → ${isoDate(addDays(issuedAt, 29))})`,
          lineKind: 'membership',
          membershipPlanId: planId,
          quantity: 1,
          unitPriceMinor: moneyPkr(plan.price),
          taxRateBps: 0,
          periodStart: isoDate(issuedAt),
          periodEnd: isoDate(addDays(issuedAt, 29)),
        },
      ];
      if (index === 0 && plan.joining > 0) {
        lines.push({
          description: 'One-time joining fee',
          lineKind: 'joining_fee',
          quantity: 1,
          unitPriceMinor: moneyPkr(plan.joining),
          taxRateBps: 0,
        });
      }
      if (index === 0 && member.key === 'bilal') {
        lines.push({
          description: 'Personal Training — 10 Sessions',
          lineKind: 'pt_package',
          quantity: 1,
          unitPriceMinor: moneyPkr(35_000),
          taxRateBps: 0,
        });
      }

      const computed = computeInvoice(lines, 'PKR');
      // Everything is paid except the current period for the overdue member.
      const unpaid = member.overdue && isCurrent;
      const amountPaid = unpaid ? 0 : computed.totalMinor;
      const dueAt = addDays(issuedAt, 7);

      await insert(db, 'invoices', {
        id: invoiceId,
        organization_id: org.organizationId,
        branch_id: branchId,
        user_id: userId,
        payer_user_id: member.guardian ? org.guardianId : null,
        member_membership_id: membershipId,
        number,
        state: deriveInvoiceState({
          totalMinor: computed.totalMinor,
          amountPaidMinor: amountPaid,
          amountRefundedMinor: 0,
          voided: false,
        }),
        currency: 'PKR',
        subtotal_minor: computed.subtotalMinor,
        discount_minor: computed.discountMinor,
        tax_minor: computed.taxMinor,
        total_minor: computed.totalMinor,
        amount_paid_minor: amountPaid,
        tax_rate_bps: 0,
        issued_at: issuedAt.toISOString(),
        due_at: dueAt.toISOString(),
        paid_at: unpaid ? null : addDays(issuedAt, 1).toISOString(),
        dunning_stage: unpaid ? 3 : 0,
        last_reminder_at: unpaid ? addDays(TODAY, -2).toISOString() : null,
        created_by: org.staffIds.get(member.branch === 'gulberg' ? 'front_desk_zoya' : 'front_desk_umar'),
        created_at: issuedAt.toISOString(),
      });

      let sortOrder = 0;
      for (const line of computed.lines) {
        await insert(db, 'invoice_lines', {
          id: uuidFor(`invoice-line:${member.key}:${index}:${sortOrder}`),
          organization_id: org.organizationId,
          invoice_id: invoiceId,
          membership_plan_id: line.membershipPlanId ?? null,
          description: line.description,
          line_kind: line.lineKind,
          quantity: line.quantity,
          unit_price_minor: line.unitPriceMinor,
          discount_minor: line.discountMinor,
          tax_rate_bps: line.taxRateBps,
          tax_minor: line.taxMinor,
          total_minor: line.totalMinor,
          period_start: line.periodStart ?? null,
          period_end: line.periodEnd ?? null,
          sort_order: sortOrder++,
        });
      }

      // Ledger: invoice issued.
      await writeLedger(db, org, {
        entryGroup: uuidFor(`ledger:invoice:${member.key}:${index}`),
        branchId,
        userId,
        invoiceId,
        occurredOn: isoDate(issuedAt),
        group: postInvoiceIssued({
          currency: 'PKR',
          invoiceNumber: number,
          lines: computed.lines.map((l) => ({
            lineKind: l.lineKind,
            netMinor: l.netMinor,
            discountMinor: l.discountMinor,
            taxMinor: l.taxMinor,
            description: l.description,
          })),
        }),
      });

      if (!unpaid) {
        const method = pickPaymentMethod(member, rng);
        const paymentId = uuidFor(`payment:${member.key}:${index}`);
        const reference = `PAY-2026-${String(paymentSequence++).padStart(5, '0')}`;
        const receivedAt = addDays(issuedAt, 1);
        const feeMinor = method === 'card' ? Math.round(computed.totalMinor * 0.029) : 0;

        await insert(db, 'payments', {
          id: paymentId,
          organization_id: org.organizationId,
          branch_id: branchId,
          user_id: userId,
          invoice_id: invoiceId,
          reference,
          state: 'succeeded',
          method,
          provider: method === 'card' ? 'stripe' : 'manual',
          provider_payment_id: method === 'card' ? `pi_demo_${paymentSequence}` : null,
          currency: 'PKR',
          amount_minor: computed.totalMinor,
          fee_minor: feeMinor,
          net_minor: computed.totalMinor - feeMinor,
          received_at: receivedAt.toISOString(),
          settled_at: receivedAt.toISOString(),
          bank_reference: method === 'bank_transfer' ? `HBL-${400000 + paymentSequence}` : null,
          depositor_name: method === 'bank_transfer' ? member.name : null,
          reconciled_at: method === 'bank_transfer' ? addDays(receivedAt, 1).toISOString() : receivedAt.toISOString(),
          reconciled_by: org.staffIds.get('manager_gulberg'),
          collected_by_user_id: org.staffIds.get(member.branch === 'gulberg' ? 'front_desk_zoya' : 'front_desk_umar'),
          receipt_number: `APX-R-2026-${String(receiptSequence++).padStart(5, '0')}`,
          idempotency_key: `seed:${member.key}:${index}`,
          created_at: receivedAt.toISOString(),
        });

        await writeLedger(db, org, {
          entryGroup: uuidFor(`ledger:payment:${member.key}:${index}`),
          branchId,
          userId,
          invoiceId,
          paymentId,
          occurredOn: isoDate(receivedAt),
          group: postPaymentReceived({
            currency: 'PKR',
            reference,
            method,
            amountMinor: computed.totalMinor,
            feeMinor,
            appliedToInvoice: true,
          }),
        });
      } else {
        // Two failed card attempts before the front desk was asked to chase it.
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          await insert(db, 'payment_attempts', {
            id: uuidFor(`attempt:${member.key}:${attempt}`),
            organization_id: org.organizationId,
            invoice_id: invoiceId,
            user_id: userId,
            attempt_number: attempt,
            provider: 'stripe',
            state: 'failed',
            amount_minor: computed.totalMinor,
            currency: 'PKR',
            request_payload: JSON.stringify({ invoice: number, attempt }),
            response_payload: JSON.stringify({ code: 'card_declined', decline_code: 'insufficient_funds' }),
            failure_code: 'card_declined',
            failure_message: 'The card was declined (insufficient funds).',
            next_retry_at: attempt === 1 ? addDays(TODAY, -6).toISOString() : addDays(TODAY, 1).toISOString(),
            started_at: addDays(TODAY, attempt === 1 ? -9 : -6).toISOString(),
            finished_at: addDays(TODAY, attempt === 1 ? -9 : -6).toISOString(),
          });
        }
      }
    }
  }

  // A refund, so the finance screens have one to show.
  const refundMember = 'saad';
  const refundPaymentId = uuidFor(`payment:${refundMember}:5`);
  const { rows } = await db.query<{ id: string; branch_id: string; user_id: string; invoice_id: string }>(
    'select id, branch_id, user_id, invoice_id from payments where id = $1',
    [refundPaymentId],
  );
  if (rows[0]) {
    const refundId = uuidFor('refund:saad');
    await insert(db, 'refunds', {
      id: refundId,
      organization_id: org.organizationId,
      payment_id: rows[0].id,
      invoice_id: rows[0].invoice_id,
      amount_minor: moneyPkr(6_250),
      currency: 'PKR',
      reason: 'Pro-rata refund for the unused half month before the freeze was approved.',
      state: 'succeeded',
      method: 'bank_transfer',
      approved_by: org.staffIds.get('owner'),
      processed_at: addDays(TODAY, -10).toISOString(),
      created_by: org.staffIds.get('manager_dha'),
    });
    await writeLedger(db, org, {
      entryGroup: uuidFor('ledger:refund:saad'),
      branchId: rows[0].branch_id,
      userId: rows[0].user_id,
      paymentId: rows[0].id,
      refundId,
      occurredOn: isoDate(addDays(TODAY, -10)),
      group: {
        reason: 'refund:saad',
        currency: 'PKR',
        postings: [
          { account: 'refunds', direction: 'debit', amountMinor: moneyPkr(6_250), memo: 'Pro-rata refund' },
          { account: 'bank', direction: 'credit', amountMinor: moneyPkr(6_250), memo: 'Refund paid by transfer' },
        ],
      },
    });
    await db.query('update payments set state = $1 where id = $2', ['partially_refunded', rows[0].id]);
    await db.query('update invoices set amount_refunded_minor = $1 where id = $2', [moneyPkr(6_250), rows[0].invoice_id]);
  }
}

function pickPaymentMethod(member: MemberSpec, rng: () => number): 'cash' | 'bank_transfer' | 'card' | 'wallet' {
  if (member.key === 'kamran') return 'card';
  if (member.guardian) return 'bank_transfer';
  const roll = rng();
  if (roll < 0.45) return 'cash';
  if (roll < 0.75) return 'bank_transfer';
  if (roll < 0.92) return 'card';
  return 'wallet';
}

async function writeLedger(
  db: Db,
  org: OrgContext,
  input: {
    entryGroup: string;
    branchId: string;
    userId: string;
    invoiceId?: string;
    paymentId?: string;
    refundId?: string;
    occurredOn: string;
    group: { reason: string; currency: string; postings: Array<{ account: string; direction: string; amountMinor: number; memo: string }> };
  },
): Promise<void> {
  await insertMany(
    db,
    'ledger_entries',
    input.group.postings.map((posting) => ({
      organization_id: org.organizationId,
      branch_id: input.branchId,
      entry_group: input.entryGroup,
      account: posting.account,
      direction: posting.direction,
      amount_minor: posting.amountMinor,
      currency: input.group.currency,
      user_id: input.userId,
      invoice_id: input.invoiceId ?? null,
      payment_id: input.paymentId ?? null,
      refund_id: input.refundId ?? null,
      memo: posting.memo,
      occurred_on: input.occurredOn,
    })),
  );
}

// ---------------------------------------------------------------------------
// Training history
// ---------------------------------------------------------------------------

interface TrainedMember {
  key: string;
  userId: string;
  completedSessions: number;
  lastWorkoutAt: string | null;
  volumeKg: number;
}

async function seedTrainingHistory(
  db: Db,
  platform: PlatformIds,
  org: OrgContext,
  rng: () => number,
): Promise<TrainedMember[]> {
  step('training: program assignments and twelve weeks of logged sessions');

  const itemCache = new Map<string, WorkoutItemRow[]>();
  const dayCache = new Map<string, ProgramDayRow[]>();
  const trained: TrainedMember[] = [];

  for (const member of MEMBERS) {
    const userId = org.memberIds.get(member.key)!;
    const branchId = org.branchIds[member.branch];
    if (!member.program) {
      trained.push({ key: member.key, userId, completedSessions: 0, lastWorkoutAt: null, volumeKg: 0 });
      continue;
    }

    const programId = platform.programIds.get(member.program)!;
    const versionId = platform.programVersionIds.get(member.program)!;
    const joinedOn = addDays(TODAY, -member.joinedDaysAgo);

    const assignmentId = uuidFor(`assignment:program:${member.key}`);
    await insert(db, 'program_assignments', {
      id: assignmentId,
      organization_id: org.organizationId,
      branch_id: branchId,
      user_id: userId,
      program_id: programId,
      program_version_id: versionId,
      assigned_by: org.staffIds.get(member.coach),
      assignment_source: member.redFlag ? 'coach' : 'engine',
      state: 'active',
      starts_on: isoDate(joinedOn),
      current_week: Math.min(12, Math.floor(member.joinedDaysAgo / 7) + 1),
      current_phase_position: 1,
      personalisation: JSON.stringify({
        sessionMinutes: member.experience === 'first_time' ? 30 : 45,
        lowImpactOnly: member.redFlag === 'pregnancy_postpartum',
        excludedExerciseIds: [],
      }),
      progression_locked: member.redFlag === 'sharp_or_worsening_pain',
      progression_lock_reason:
        member.redFlag === 'sharp_or_worsening_pain'
          ? 'sharp_or_worsening_pain reported (workout_log) — awaiting staff review'
          : null,
      created_at: joinedOn.toISOString(),
    });

    if (!dayCache.has(member.program)) {
      const { rows } = await db.query<ProgramDayRow>(
        `select pd.id, pd.week_number, pd.day_number, pd.workout_id, w.name as workout_name, ph.position as phase_position
           from program_days pd
           join program_phases ph on ph.id = pd.program_phase_id
           join program_versions pv on pv.id = ph.program_version_id
           left join workouts w on w.id = pd.workout_id
          where pv.id = $1 and pd.is_rest_day = false
          order by ph.position, pd.week_number, pd.day_number`,
        [versionId],
      );
      dayCache.set(member.program, rows);
    }

    const days = dayCache.get(member.program)!;
    const weekGroups = groupByWeek(days);
    if (weekGroups.length === 0) continue;

    const calendarWeeks = Math.min(12, Math.max(1, Math.ceil(member.joinedDaysAgo / 7)));
    const firstMonday = startOfWeek(joinedOn);

    let completed = 0;
    let totalVolume = 0;
    let lastWorkoutAt: string | null = null;

    for (let weekIndex = 0; weekIndex < calendarWeeks; weekIndex += 1) {
      const group = weekGroups[Math.min(weekIndex, weekGroups.length - 1)]!;
      for (const day of group.days) {
        const scheduled = addDays(firstMonday, weekIndex * 7 + (day.day_number - 1));
        if (scheduled > TODAY) continue;
        if (scheduled < joinedOn) continue;

        // Hamza stopped coming five weeks ago; Saad is frozen and away.
        const stopped =
          (member.key === 'hamza' && weekIndex > 3) || (member.key === 'saad' && weekIndex > 6);
        const didComplete = !stopped && chance(rng, member.adherence);

        const items = await loadWorkoutItems(db, itemCache, day.workout_id);
        const prescribedSets = items.reduce((sum, item) => sum + item.target_sets, 0);
        const sessionId = uuidFor(`session:${member.key}:${weekIndex}:${day.day_number}`);

        let sessionVolume = 0;
        const setRows: Array<Record<string, unknown>> = [];

        if (didComplete) {
          for (const item of items) {
            if (item.block_kind === 'warmup' || item.block_kind === 'cooldown') continue;
            const step = Number(item.load_step_kg) || 2.5;
            const base = item.starting_load_kg ? Number(item.starting_load_kg) : 0;
            const progressed = base > 0 ? roundTo(base * (1 + 0.022 * weekIndex), step) : 0;

            for (let setNumber = 1; setNumber <= item.target_sets; setNumber += 1) {
              const min = item.target_reps_min ?? 8;
              const max = item.target_reps_max ?? min;
              const strong = rng() < member.adherence;
              const reps = item.target_seconds ? null : strong ? max : intBetween(rng, min, max);
              const weight = progressed > 0 ? progressed : null;
              const discomfort =
                member.key === 'ahmed' && weekIndex === calendarWeeks - 1 && item.exercise_name.includes('Squat')
                  ? 7
                  : null;

              if (weight && reps) sessionVolume += weight * reps;

              setRows.push({
                id: uuidFor(`set:${member.key}:${weekIndex}:${day.day_number}:${item.id}:${setNumber}`),
                organization_id: org.organizationId,
                workout_session_id: sessionId,
                user_id: userId,
                workout_item_id: item.id,
                exercise_id: item.exercise_id,
                set_number: setNumber,
                target_reps_min: item.target_reps_min,
                target_reps_max: item.target_reps_max,
                reps_completed: reps,
                weight_kg: weight,
                seconds_held: item.target_seconds,
                rpe: Math.round((6.5 + rng() * 2) * 2) / 2,
                rest_taken_seconds: intBetween(rng, 45, 150),
                is_warmup: false,
                skipped: false,
                discomfort_level: discomfort,
                discomfort_area: discomfort ? 'knee' : null,
                logged_at: atTime(scheduled, 18, setNumber * 3).toISOString(),
                client_set_id: `seed-${member.key}-${weekIndex}-${day.day_number}-${setNumber}-${item.id.slice(0, 8)}`,
              });
            }
          }
        }

        const completedSets = setRows.length;
        await insert(db, 'workout_sessions', {
          id: sessionId,
          organization_id: org.organizationId,
          branch_id: branchId,
          user_id: userId,
          program_assignment_id: assignmentId,
          program_day_id: day.id,
          workout_id: day.workout_id,
          title: day.workout_name,
          state: didComplete ? 'completed' : 'skipped',
          scheduled_for: isoDate(scheduled),
          week_number: weekIndex + 1,
          day_number: day.day_number,
          started_at: didComplete ? atTime(scheduled, 18).toISOString() : null,
          completed_at: didComplete ? atTime(scheduled, 19, 5).toISOString() : null,
          duration_seconds: didComplete ? intBetween(rng, 2100, 4200) : null,
          total_volume_kg: Math.round(sessionVolume * 100) / 100,
          completed_sets: completedSets,
          prescribed_sets: prescribedSets,
          session_rpe: didComplete ? Math.round((6.5 + rng() * 2) * 2) / 2 : null,
          mood: didComplete ? pick(rng, ['great', 'good', 'ok', 'tired']) : null,
          energy_level: didComplete ? intBetween(rng, 3, 5) : null,
          discomfort_reported: setRows.some((s) => s.discomfort_level !== null),
          member_note: null,
          client_session_id: `seed-${member.key}-${weekIndex}-${day.day_number}`,
          client_recorded_at: atTime(scheduled, 19, 6).toISOString(),
          synced_at: atTime(scheduled, 19, 7).toISOString(),
          sync_source: rng() < 0.15 ? 'offline_queue' : 'online',
          created_at: atTime(scheduled, 18).toISOString(),
        });

        if (setRows.length) await insertMany(db, 'set_logs', setRows);

        if (didComplete) {
          completed += 1;
          totalVolume += sessionVolume;
          lastWorkoutAt = atTime(scheduled, 19, 5).toISOString();

          await insert(db, 'attendance', {
            id: uuidFor(`attendance:${member.key}:${weekIndex}:${day.day_number}`),
            organization_id: org.organizationId,
            branch_id: branchId,
            user_id: userId,
            workout_session_id: sessionId,
            method: rng() < 0.7 ? 'qr' : 'manual',
            checked_in_at: atTime(scheduled, 17, 55).toISOString(),
            checked_out_at: atTime(scheduled, 19, 15).toISOString(),
            membership_valid: true,
          });
        }
      }
    }

    await db.query(
      'update member_profiles set last_workout_at = $1, last_visit_at = $1 where user_id = $2',
      [lastWorkoutAt, userId],
    );

    trained.push({ key: member.key, userId, completedSessions: completed, lastWorkoutAt, volumeKg: totalVolume });
  }

  return trained;
}

async function loadWorkoutItems(
  db: Db,
  cache: Map<string, WorkoutItemRow[]>,
  workoutId: string,
): Promise<WorkoutItemRow[]> {
  const cached = cache.get(workoutId);
  if (cached) return cached;
  const { rows } = await db.query<WorkoutItemRow>(
    `select wi.id, wi.exercise_id, wi.target_sets, wi.target_reps_min, wi.target_reps_max,
            wi.target_seconds, wi.starting_load_kg, e.load_step_kg, wb.kind as block_kind, e.name as exercise_name
       from workout_items wi
       join workout_blocks wb on wb.id = wi.workout_block_id
       join exercises e on e.id = wi.exercise_id
      where wb.workout_id = $1
      order by wb.position, wi.position`,
    [workoutId],
  );
  cache.set(workoutId, rows);
  return rows;
}

function groupByWeek(days: ProgramDayRow[]): Array<{ key: string; days: ProgramDayRow[] }> {
  const map = new Map<string, ProgramDayRow[]>();
  for (const day of days) {
    const key = `${day.phase_position}:${day.week_number}`;
    map.set(key, [...(map.get(key) ?? []), day]);
  }
  return [...map.entries()].map(([key, value]) => ({ key, days: value }));
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const diff = (day + 6) % 7; // Monday = 0
  copy.setUTCDate(copy.getUTCDate() - diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// ---------------------------------------------------------------------------
// Progress, metrics, check-ins, records, recommendations
// ---------------------------------------------------------------------------

async function seedProgressAndCheckIns(
  db: Db,
  org: OrgContext,
  rng: () => number,
  trained: TrainedMember[],
): Promise<void> {
  step('progress: weight history, habits, check-ins, records and engine decisions');

  const { rows: metrics } = await db.query<{ id: string; key: string }>(
    'select id, key from metric_definitions where organization_id is null',
  );
  const metricIds = new Map(metrics.map((m) => [m.key, m.id]));

  for (const member of MEMBERS) {
    const userId = org.memberIds.get(member.key)!;
    const joinedOn = addDays(TODAY, -member.joinedDaysAgo);
    const weeks = Math.min(16, Math.max(1, Math.floor(member.joinedDaysAgo / 7)));
    const delta = member.currentWeightKg - member.startWeightKg;

    // Weekly weigh-ins, trending towards the current weight with a little noise.
    const weightRows: Array<Record<string, unknown>> = [];
    for (let week = 0; week <= weeks; week += 1) {
      const measuredOn = addDays(joinedOn, week * 7);
      if (measuredOn > TODAY) break;
      const progress = weeks === 0 ? 1 : week / weeks;
      const noise = (rng() - 0.5) * 0.7;
      const value = Math.round((member.startWeightKg + delta * progress + noise) * 10) / 10;
      weightRows.push({
        id: uuidFor(`metric:${member.key}:weight:${week}`),
        organization_id: org.organizationId,
        user_id: userId,
        metric_definition_id: metricIds.get('body_weight'),
        value,
        unit: 'kg',
        measured_on: isoDate(measuredOn),
        source: 'member',
        created_at: measuredOn.toISOString(),
      });
    }
    if (weightRows.length) await insertMany(db, 'metric_logs', weightRows);

    // A couple of tape measurements for members who track them.
    if (['ayesha', 'bilal', 'sana', 'junaid'].includes(member.key)) {
      for (const [key, start, end] of [
        ['waist', member.gender === 'female' ? 92 : 104, member.gender === 'female' ? 84 : 96],
        ['arm', member.gender === 'female' ? 28 : 34, member.gender === 'female' ? 29 : 37],
      ] as Array<[string, number, number]>) {
        for (const [index, week] of [0, Math.floor(weeks / 2), weeks].entries()) {
          const measuredOn = addDays(joinedOn, week * 7);
          if (measuredOn > TODAY) continue;
          await insert(db, 'metric_logs', {
            id: uuidFor(`metric:${member.key}:${key}:${index}`),
            organization_id: org.organizationId,
            user_id: userId,
            metric_definition_id: metricIds.get(key),
            value: Math.round((start + (end - start) * (weeks === 0 ? 1 : week / weeks)) * 10) / 10,
            unit: 'cm',
            measured_on: isoDate(measuredOn),
            source: 'staff',
            recorded_by: org.staffIds.get(member.coach),
          });
        }
      }
    }

    // Habit logs for the last 28 days.
    const habitRows: Array<Record<string, unknown>> = [];
    const { rows: habits } = await db.query<{ id: string; key: string; target_value: string }>(
      'select id, key, target_value from habits where user_id = $1',
      [userId],
    );
    for (const habit of habits) {
      for (let day = 0; day < 28; day += 1) {
        const loggedOn = addDays(TODAY, -day);
        if (loggedOn < joinedOn) continue;
        if (!chance(rng, member.adherence * 0.9)) continue;
        const target = Number(habit.target_value);
        habitRows.push({
          id: uuidFor(`habit-log:${member.key}:${habit.key}:${day}`),
          organization_id: org.organizationId,
          habit_id: habit.id,
          user_id: userId,
          logged_on: isoDate(loggedOn),
          value: Math.round(target * (0.7 + rng() * 0.5)),
          completed: chance(rng, 0.8),
          created_at: loggedOn.toISOString(),
        });
      }
    }
    if (habitRows.length) await insertMany(db, 'habit_logs', habitRows);

    // Weekly check-ins.
    for (let week = 0; week < Math.min(weeks, 8); week += 1) {
      const weekStarting = startOfWeek(addDays(TODAY, -week * 7));
      if (weekStarting < joinedOn) break;
      const isCurrentWeek = week === 0;
      const submitted = isCurrentWeek ? chance(rng, 0.5) : chance(rng, member.adherence);
      const poorRecovery = member.key === 'sana' && week < 2;

      await insert(db, 'check_ins', {
        id: uuidFor(`checkin:${member.key}:${week}`),
        organization_id: org.organizationId,
        user_id: userId,
        coach_id: org.staffIds.get(member.coach),
        week_starting: isoDate(weekStarting),
        kind: 'weekly',
        state: submitted ? (week === 0 ? 'submitted' : 'reviewed') : 'skipped',
        adherence_percent: Math.round(member.adherence * 100),
        weight_kg: submitted
          ? Math.round((member.startWeightKg + (member.currentWeightKg - member.startWeightKg) * (1 - week / Math.max(weeks, 1))) * 10) / 10
          : null,
        sleep_quality: poorRecovery ? 2 : intBetween(rng, 3, 5),
        stress_level: poorRecovery ? 5 : intBetween(rng, 1, 4),
        soreness_level: poorRecovery ? 5 : intBetween(rng, 1, 3),
        energy_level: poorRecovery ? 2 : intBetween(rng, 3, 5),
        nutrition_adherence: intBetween(rng, 2, 5),
        wins: submitted ? pick(rng, [
          'Managed all three sessions this week.',
          'Squats finally felt easy at 40 kg.',
          'Cooked at home five nights instead of ordering.',
          'Walked to work twice.',
        ]) : null,
        blockers: submitted ? pick(rng, [
          'Work ran late on Wednesday.',
          'Slept badly two nights.',
          'Family dinners made the food side hard.',
          'Nothing much — good week.',
        ]) : null,
        member_question: week === 0 && member.key === 'ayesha' ? 'Should I add a fourth day or keep it at three?' : null,
        coach_response: week > 0 && submitted ? 'Great work. Keep the load where it is on the RDL and we will add a rep next week.' : null,
        responded_at: week > 0 && submitted ? addDays(weekStarting, 2).toISOString() : null,
        submitted_at: submitted ? addDays(weekStarting, 1).toISOString() : null,
        created_at: weekStarting.toISOString(),
      });
    }
  }

  // Personal records for the consistent lifters.
  const prMembers = ['bilal', 'usman', 'ayesha', 'ahmed'];
  for (const key of prMembers) {
    const userId = org.memberIds.get(key)!;
    const { rows } = await db.query<{ exercise_id: string; weight_kg: string; reps_completed: number; id: string; logged_at: string }>(
      `select sl.exercise_id, sl.weight_kg, sl.reps_completed, sl.id, sl.logged_at
         from set_logs sl
        where sl.user_id = $1 and sl.weight_kg is not null and sl.reps_completed is not null
        order by sl.weight_kg desc
        limit 4`,
      [userId],
    );
    for (const [index, row] of rows.entries()) {
      const weight = Number(row.weight_kg);
      await insert(db, 'personal_records', {
        id: uuidFor(`pr:${key}:${index}`),
        organization_id: org.organizationId,
        user_id: userId,
        exercise_id: row.exercise_id,
        record_kind: index === 0 ? 'max_weight' : 'best_e1rm',
        value: index === 0 ? weight : Math.round(weight * (1 + row.reps_completed / 30) * 10) / 10,
        unit: 'kg',
        reps: row.reps_completed,
        weight_kg: weight,
        set_log_id: row.id,
        achieved_at: row.logged_at,
        previous_value: index === 0 ? Math.round((weight - 2.5) * 10) / 10 : null,
      });
    }
  }

  // Coaching engine decisions, including one that a coach overrode.
  const recommendations = [
    {
      key: 'ayesha', ruleId: 'R-PROG-001', kind: 'progress_load', state: 'auto_applied',
      rationale: 'Two consecutive sessions met all prescribed reps within the intended effort ceiling; load increased by 2.5 kg (capped at 7.5%).',
      before: { weightKg: 30 }, after: { weightKg: 32.5 }, approval: false,
    },
    {
      key: 'bilal', ruleId: 'R-PROG-001', kind: 'progress_load', state: 'auto_applied',
      rationale: 'Bench press hit 8 reps on all four sets at RPE 7.5 for two sessions.',
      before: { weightKg: 65 }, after: { weightKg: 67.5 }, approval: false,
    },
    {
      key: 'hamza', ruleId: 'R-MISS-005', kind: 'shorten_week', state: 'proposed',
      rationale: '5 missed sessions in the last 14 days against 0 completed. Offering a reduced weekly commitment instead of letting the plan drift.',
      before: { daysPerWeek: 3 }, after: { daysPerWeek: 2 }, approval: false,
    },
    {
      key: 'sana', ruleId: 'R-RECOV-006', kind: 'reduce_volume', state: 'approved',
      rationale: 'Two consecutive check-ins reported soreness ≥ 4 with sleep or energy ≤ 2. Weekly volume reduced 33% and a staff review task created.',
      before: { weeklyVolumeFactor: 1 }, after: { weeklyVolumeFactor: 0.67 }, approval: true,
    },
    {
      key: 'ahmed', ruleId: 'R-PAIN-007', kind: 'stop_progression', state: 'approved',
      rationale: 'Discomfort level 7/10 logged on Barbell Back Squat. Automatic progression halted for this movement pending human review.',
      before: { progression: 'automatic' }, after: { progression: 'stopped', requiresReview: true }, approval: true,
    },
    {
      key: 'kamran', ruleId: 'R-HOLD-003', kind: 'reduce_volume', state: 'overridden',
      rationale: 'Two consecutive sessions fell short of the prescribed rep floor. Load reduced ~10% to re-establish the target range.',
      before: { weightKg: 100 }, after: { weightKg: 90 }, approval: false,
    },
  ];

  for (const rec of recommendations) {
    const userId = org.memberIds.get(rec.key);
    if (!userId) continue;
    const member = MEMBERS.find((m) => m.key === rec.key)!;
    await insert(db, 'coaching_recommendations', {
      id: uuidFor(`rec:${rec.key}:${rec.ruleId}`),
      organization_id: org.organizationId,
      user_id: userId,
      program_assignment_id: uuidFor(`assignment:program:${rec.key}`),
      rule_id: rec.ruleId,
      rule_version: '1.0.0',
      kind: rec.kind,
      rationale: rec.rationale,
      evidence: JSON.stringify({ generatedBy: 'coaching-engine', window: 'last 2 sessions' }),
      before_value: JSON.stringify(rec.before),
      after_value: JSON.stringify(rec.after),
      requires_staff_approval: rec.approval,
      state: rec.state,
      decided_by: ['approved', 'overridden'].includes(rec.state) ? org.staffIds.get(member.coach) : null,
      decided_at: ['approved', 'overridden'].includes(rec.state) ? addDays(TODAY, -2).toISOString() : null,
      decision_note:
        rec.state === 'overridden'
          ? 'Kamran was ill that fortnight, not overreached. Holding the load rather than dropping it, reviewing next week.'
          : rec.state === 'approved'
            ? 'Agreed. Contacted the member and adjusted the plan.'
            : null,
      applied_at: rec.state === 'auto_applied' ? addDays(TODAY, -3).toISOString() : null,
      created_at: addDays(TODAY, -3).toISOString(),
    });
  }

  void trained;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

async function seedNutrition(db: Db, platform: PlatformIds, org: OrgContext): Promise<void> {
  step('nutrition: targets, meal plans and food logs');

  const targets: Array<{ key: string; approach: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null }> = [
    { key: 'ayesha', approach: 'macros', calories: 1750, protein: 130, carbs: 165, fat: 55 },
    { key: 'bilal', approach: 'macros', calories: 3100, protein: 165, carbs: 380, fat: 90 },
    { key: 'ali', approach: 'macros', calories: 2900, protein: 130, carbs: 380, fat: 85 },
    { key: 'junaid', approach: 'plate', calories: null, protein: null, carbs: null, fat: null },
    { key: 'maryam', approach: 'plate', calories: null, protein: null, carbs: null, fat: null },
    { key: 'zainab', approach: 'plate', calories: null, protein: null, carbs: null, fat: null },
    { key: 'sana', approach: 'calories_only', calories: 2000, protein: 125, carbs: null, fat: null },
  ];

  for (const target of targets) {
    const userId = org.memberIds.get(target.key);
    if (!userId) continue;
    const member = MEMBERS.find((m) => m.key === target.key)!;
    await insert(db, 'nutrition_targets', {
      id: uuidFor(`nutrition:${target.key}`),
      organization_id: org.organizationId,
      user_id: userId,
      approach: target.approach,
      goal: member.goal,
      calories_kcal: target.calories,
      protein_g: target.protein,
      carbs_g: target.carbs,
      fat_g: target.fat,
      water_ml: 2800,
      protein_palms: target.approach === 'plate' ? 3 : null,
      carb_cupped_hands: target.approach === 'plate' ? 3 : null,
      veg_fists: target.approach === 'plate' ? 4.5 : null,
      fat_thumbs: target.approach === 'plate' ? 3 : null,
      weekly_change_kg: member.goal === 'fat_loss' ? -0.5 : member.goal === 'weight_gain' ? 0.3 : 0,
      dietary_preferences: member.key === 'maryam' ? ['no_beef'] : [],
      allergies: member.key === 'ali' ? ['peanut'] : [],
      halal_only: true,
      budget_band: member.key === 'ali' ? 'low' : 'medium',
      ramadan_schedule: member.ramadanMode ?? false,
      set_by_user_id: org.staffIds.get('nutritionist'),
      set_by_role: 'nutrition_professional',
      guard_rail_notes:
        target.approach === 'plate'
          ? 'Member preferred hand-portion guidance over counting. No numeric targets set.'
          : 'Deficit capped at 18% of estimated maintenance.',
      effective_from: isoDate(addDays(TODAY, -30)),
    });
  }

  // A coach-approved meal plan for one member plus the shared templates.
  const templatePlanId = uuidFor('mealplan:template:fatloss');
  await insert(db, 'meal_plans', {
    id: templatePlanId,
    organization_id: org.organizationId,
    user_id: null,
    name: 'Fat loss — Pakistani home cooking',
    summary: 'Seven days of ordinary home food arranged so the calories work. No imported ingredients, no protein powder.',
    goal: 'fat_loss',
    approach: 'macros',
    is_template: true,
    approved_by: org.staffIds.get('nutritionist'),
    approved_at: addDays(TODAY, -40).toISOString(),
    state: 'published',
    created_by: org.staffIds.get('nutritionist'),
  });

  const slots: Array<[number, string, string]> = [
    [1, 'breakfast', 'weight_gain_breakfast'],
    [1, 'lunch', 'budget_protein_plate'],
    [1, 'dinner', 'fat_loss_dinner'],
    [2, 'breakfast', 'weight_gain_breakfast'],
    [2, 'lunch', 'budget_protein_plate'],
    [2, 'dinner', 'fat_loss_dinner'],
    [3, 'post_workout', 'post_workout_desi'],
    [3, 'dinner', 'fat_loss_dinner'],
  ];
  for (const [day, slot, recipeCode] of slots) {
    await insert(db, 'meal_plan_entries', {
      id: uuidFor(`mealplan-entry:${day}:${slot}`),
      organization_id: org.organizationId,
      meal_plan_id: templatePlanId,
      day_number: day,
      meal_slot: slot,
      recipe_id: platform.recipeIds.get(recipeCode),
      quantity_servings: 1,
      position: day * 10,
    });
  }

  const ramadanPlanId = uuidFor('mealplan:template:ramadan');
  await insert(db, 'meal_plans', {
    id: ramadanPlanId,
    organization_id: org.organizationId,
    name: 'Ramadan — sehri and iftar',
    summary: 'The same daily totals split across two eating windows, with hydration guidance between them.',
    goal: 'maintenance',
    approach: 'plate',
    is_template: true,
    ramadan_variant: true,
    approved_by: org.staffIds.get('nutritionist'),
    approved_at: addDays(TODAY, -40).toISOString(),
    created_by: org.staffIds.get('nutritionist'),
  });
  for (const [day, slot, recipeCode] of [
    [1, 'sehri', 'high_protein_sehri'],
    [1, 'iftar', 'balanced_iftar'],
  ] as Array<[number, string, string]>) {
    await insert(db, 'meal_plan_entries', {
      id: uuidFor(`mealplan-entry:ramadan:${day}:${slot}`),
      organization_id: org.organizationId,
      meal_plan_id: ramadanPlanId,
      day_number: day,
      meal_slot: slot,
      recipe_id: platform.recipeIds.get(recipeCode),
      quantity_servings: 1,
      position: day,
    });
  }

  // Recent food logs for two members so the nutrition screen has real data.
  for (const key of ['ayesha', 'bilal']) {
    const userId = org.memberIds.get(key)!;
    for (let day = 0; day < 7; day += 1) {
      const loggedOn = addDays(TODAY, -day);
      const entries: Array<[string, string, number]> = [
        ['breakfast', 'omelette', 1],
        ['breakfast', 'roti', key === 'bilal' ? 2 : 1],
        ['lunch', 'chicken_karahi', 1],
        ['lunch', 'boiled_rice', 1],
        ['snack', 'dahi', 1],
        ['dinner', 'daal_masoor', 1],
        ['dinner', 'salad_kachumber', 1],
      ];
      for (const [slot, foodCode, servings] of entries) {
        const foodId = platform.foodIds.get(foodCode);
        if (!foodId) continue;
        const { rows } = await db.query<{ calories_kcal: string; protein_g: string; carbs_g: string; fat_g: string }>(
          'select calories_kcal, protein_g, carbs_g, fat_g from food_items where id = $1',
          [foodId],
        );
        const food = rows[0];
        await insert(db, 'meal_logs', {
          id: uuidFor(`meal-log:${key}:${day}:${slot}:${foodCode}`),
          organization_id: org.organizationId,
          user_id: userId,
          logged_on: isoDate(loggedOn),
          meal_slot: slot,
          food_item_id: foodId,
          quantity_servings: servings,
          calories_kcal: food ? Number(food.calories_kcal) * servings : null,
          protein_g: food ? Number(food.protein_g) * servings : null,
          carbs_g: food ? Number(food.carbs_g) * servings : null,
          fat_g: food ? Number(food.fat_g) * servings : null,
          logged_via: 'app',
          created_at: loggedOn.toISOString(),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Classes and bookings
// ---------------------------------------------------------------------------

async function seedSchedule(db: Db, org: OrgContext, rng: () => number): Promise<void> {
  step('scheduling: rooms, classes, sessions, bookings and waitlists');

  const rooms = [
    { key: 'gulberg_studio', branch: 'gulberg' as const, name: 'Studio 1', capacity: 24, floor: 'Ground' },
    { key: 'gulberg_spin', branch: 'gulberg' as const, name: 'Spin Room', capacity: 18, floor: 'First' },
    { key: 'dha_studio', branch: 'dha' as const, name: 'Studio A', capacity: 20, floor: 'Ground' },
  ];
  for (const room of rooms) {
    await insert(db, 'rooms', {
      id: uuidFor(`room:${room.key}`),
      organization_id: org.organizationId,
      branch_id: org.branchIds[room.branch],
      name: room.name,
      capacity: room.capacity,
      floor_label: room.floor,
    });
  }

  const classes = [
    { key: 'strength_basics', name: 'Strength Basics', branch: 'gulberg' as const, room: 'gulberg_studio', coach: 'coach_hassan', category: 'strength', capacity: 16, duration: 45, days: [1, 3, 5], time: 19, womenOnly: false },
    { key: 'ladies_hiit', name: 'Ladies-only HIIT', branch: 'gulberg' as const, room: 'gulberg_studio', coach: 'coach_ayesha', category: 'womens_only', capacity: 20, duration: 45, days: [2, 4], time: 11, womenOnly: true },
    { key: 'spin', name: 'Spin', branch: 'gulberg' as const, room: 'gulberg_spin', coach: 'coach_ayesha', category: 'spin', capacity: 18, duration: 45, days: [1, 4, 6], time: 7, womenOnly: false },
    { key: 'induction', name: 'New Member Induction', branch: 'gulberg' as const, room: 'gulberg_studio', coach: 'coach_hassan', category: 'induction', capacity: 8, duration: 60, days: [6], time: 10, womenOnly: false },
    { key: 'functional_dha', name: 'Functional Fitness', branch: 'dha' as const, room: 'dha_studio', coach: 'coach_bilal', category: 'functional', capacity: 18, duration: 50, days: [1, 3, 5], time: 20, womenOnly: false },
    { key: 'yoga_dha', name: 'Yoga & Mobility', branch: 'dha' as const, room: 'dha_studio', coach: 'coach_bilal', category: 'yoga', capacity: 16, duration: 60, days: [2, 6], time: 8, womenOnly: false },
  ];

  const memberKeysByBranch = {
    gulberg: MEMBERS.filter((m) => m.branch === 'gulberg').map((m) => m.key),
    dha: MEMBERS.filter((m) => m.branch === 'dha').map((m) => m.key),
  };

  for (const klass of classes) {
    const classId = uuidFor(`class:${klass.key}`);
    await insert(db, 'classes', {
      id: classId,
      organization_id: org.organizationId,
      branch_id: org.branchIds[klass.branch],
      room_id: uuidFor(`room:${klass.room}`),
      name: klass.name,
      description: classDescription(klass.key),
      category: klass.category,
      intensity: klass.category === 'yoga' ? 'gentle' : klass.category === 'induction' ? 'gentle' : 'high',
      default_coach_id: org.staffIds.get(klass.coach),
      capacity: klass.capacity,
      duration_minutes: klass.duration,
      credits_required: klass.category === 'induction' ? 0 : 1,
      women_only: klass.womenOnly,
      booking_opens_hours_before: 72,
      booking_closes_minutes_before: 30,
      cancellation_window_hours: 4,
      waitlist_enabled: true,
      waitlist_capacity: 10,
      recurrence_days: klass.days,
      start_time: `${String(klass.time).padStart(2, '0')}:00`,
    });

    // Two weeks behind, two weeks ahead.
    for (let offset = -14; offset <= 14; offset += 1) {
      const date = addDays(TODAY, offset);
      const weekday = ((date.getUTCDay() + 6) % 7) + 1; // Monday = 1
      if (!klass.days.includes(weekday)) continue;

      const startsAt = atTime(date, klass.time);
      const endsAt = new Date(startsAt.getTime() + klass.duration * 60_000);
      const sessionId = uuidFor(`class-session:${klass.key}:${isoDate(date)}`);
      const isPast = startsAt < TODAY;

      const candidates = memberKeysByBranch[klass.branch].filter((key) => {
        const member = MEMBERS.find((m) => m.key === key)!;
        if (klass.womenOnly && member.gender !== 'female') return false;
        return true;
      });
      const bookedKeys = candidates.filter(() => chance(rng, 0.45)).slice(0, klass.capacity);
      const attendedKeys = isPast ? bookedKeys.filter(() => chance(rng, 0.8)) : [];

      await insert(db, 'class_sessions', {
        id: sessionId,
        organization_id: org.organizationId,
        branch_id: org.branchIds[klass.branch],
        class_id: classId,
        room_id: uuidFor(`room:${klass.room}`),
        coach_id: org.staffIds.get(klass.coach),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: klass.capacity,
        booked_count: bookedKeys.length,
        waitlist_count: 0,
        attended_count: attendedKeys.length,
        state: isPast ? 'completed' : 'scheduled',
      });

      for (const key of bookedKeys) {
        const userId = org.memberIds.get(key)!;
        const attended = attendedKeys.includes(key);
        const bookingId = uuidFor(`booking:${klass.key}:${isoDate(date)}:${key}`);
        await insert(db, 'bookings', {
          id: bookingId,
          organization_id: org.organizationId,
          branch_id: org.branchIds[klass.branch],
          class_session_id: sessionId,
          user_id: userId,
          state: isPast ? (attended ? 'attended' : chance(rng, 0.5) ? 'no_show' : 'late_cancelled') : 'booked',
          booked_at: addDays(startsAt, -2).toISOString(),
          booked_by_user_id: userId,
          credits_charged: klass.category === 'induction' ? 0 : 1,
          checked_in_at: attended ? startsAt.toISOString() : null,
        });

        if (attended) {
          await insert(db, 'attendance', {
            id: uuidFor(`class-attendance:${klass.key}:${isoDate(date)}:${key}`),
            organization_id: org.organizationId,
            branch_id: org.branchIds[klass.branch],
            user_id: userId,
            class_session_id: sessionId,
            booking_id: bookingId,
            method: 'qr',
            checked_in_at: startsAt.toISOString(),
            membership_valid: true,
          });
        }
      }
    }
  }

  // One full class with a waitlist, tomorrow evening.
  const tomorrow = addDays(TODAY, 1);
  const weekday = ((tomorrow.getUTCDay() + 6) % 7) + 1;
  if ([1, 3, 5].includes(weekday)) {
    const sessionId = uuidFor(`class-session:strength_basics:${isoDate(tomorrow)}`);
    const { rowCount } = await db.query('select 1 from class_sessions where id = $1', [sessionId]);
    if (rowCount) {
      await db.query('update class_sessions set booked_count = capacity, waitlist_count = 2 where id = $1', [sessionId]);
      const waitlisted = ['hamza', 'kamran'];
      for (const [index, key] of waitlisted.entries()) {
        await insert(db, 'waitlist_entries', {
          id: uuidFor(`waitlist:${key}`),
          organization_id: org.organizationId,
          class_session_id: sessionId,
          user_id: org.memberIds.get(key)!,
          position: index + 1,
          joined_at: addDays(TODAY, -1).toISOString(),
        });
      }
    }
  }
}

function classDescription(key: string): string {
  const map: Record<string, string> = {
    strength_basics: 'A coached barbell session for members who want to learn the main lifts properly. Small groups, real coaching.',
    ladies_hiit: 'Women-only conditioning class in a private studio. Scalable for every fitness level.',
    spin: 'Early-morning indoor cycling. Low impact, high effort, done before work.',
    induction: 'Free 60-minute session for new members: a tour, the machines, and your first workout walked through.',
    functional_dha: 'Kettlebells, sleds and carries. Strength that transfers to everyday life.',
    yoga_dha: 'Mobility and breathing work. Excellent on rest days and for members with stiff hips or backs.',
  };
  return map[key] ?? 'Group class.';
}

// ---------------------------------------------------------------------------
// Automations & notifications
// ---------------------------------------------------------------------------

async function seedAutomationsAndNotifications(db: Db, org: OrgContext): Promise<void> {
  step('automations: sequences, runs and the notification ledger');

  const automations = [
    { key: 'welcome_sequence', name: 'Welcome sequence', trigger: 'member_enrolled', template: 'welcome_member', channels: ['in_app', 'push'], audience: 'member', task: false },
    { key: 'onboarding_nudge', name: 'Incomplete onboarding reminder', trigger: 'onboarding_incomplete', template: 'onboarding_incomplete', channels: ['push'], audience: 'member', task: false },
    { key: 'trial_conversion', name: 'Trial conversion reminder', trigger: 'trial_ending', template: 'trial_ending', channels: ['push', 'in_app'], audience: 'member', task: true },
    { key: 'missed_workout', name: 'Missed workout nudge', trigger: 'workout_missed', template: 'workout_missed', channels: ['push'], audience: 'member', task: false },
    { key: 'inactive_7', name: 'Seven-day inactivity', trigger: 'inactive_7_days', template: 'inactive_7_days', channels: ['push', 'in_app'], audience: 'both', task: true },
    { key: 'payment_due', name: 'Payment due reminder', trigger: 'payment_due', template: 'payment_due_today', channels: ['in_app'], audience: 'member', task: false },
    { key: 'payment_recovery', name: 'Failed payment recovery', trigger: 'payment_failed', template: 'payment_missed_gentle', channels: ['push', 'in_app'], audience: 'both', task: true },
    { key: 'membership_expiry', name: 'Membership expiry reminder', trigger: 'membership_expiring', template: 'membership_expiring', channels: ['in_app'], audience: 'member', task: false },
    { key: 'birthday', name: 'Birthday greeting', trigger: 'birthday', template: 'birthday', channels: ['in_app'], audience: 'member', task: false },
    { key: 'milestone', name: 'Workout milestone', trigger: 'workout_milestone', template: 'workout_milestone', channels: ['in_app'], audience: 'member', task: false },
    { key: 'checkin_reminder', name: 'Weekly check-in reminder', trigger: 'checkin_missing', template: 'checkin_due', channels: ['in_app', 'push'], audience: 'member', task: false },
    { key: 'escalation_alert', name: 'Health escalation alert', trigger: 'escalation_raised', template: 'escalation_staff', channels: ['in_app'], audience: 'staff', task: true },
  ];

  for (const automation of automations) {
    await insert(db, 'automations', {
      id: uuidFor(`automation:${automation.key}`),
      organization_id: org.organizationId,
      branch_id: null,
      key: automation.key,
      name: automation.name,
      description: null,
      trigger_kind: automation.trigger,
      trigger_config: JSON.stringify({}),
      audience: automation.audience,
      channels: automation.channels,
      template_key: automation.template,
      requires_opt_in: automation.trigger !== 'escalation_raised',
      respect_quiet_hours: automation.trigger !== 'escalation_raised',
      quiet_hours_start: '21:30',
      quiet_hours_end: '07:30',
      max_per_member_per_week: 3,
      cooldown_hours: automation.trigger === 'workout_missed' ? 48 : 24,
      creates_staff_task: automation.task,
      task_assignee_role: automation.task ? (automation.key === 'escalation_alert' ? 'branch_manager' : 'coach') : null,
      is_active: true,
      created_by: org.staffIds.get('owner'),
    });
  }

  // Notifications: a believable recent history including one suppressed by
  // quiet hours and one blocked for lack of opt-in.
  const notifications: Array<{
    key: string; member: string; channel: string; category: string; title: string; body: string;
    state: string; daysAgo: number; automation?: string; suppression?: string; read?: boolean;
    cta?: string; path?: string;
  }> = [
    { key: 'n1', member: 'ayesha', channel: 'in_app', category: 'coaching', title: '25 sessions completed', body: '25 sessions is real, compounding work. Keep going.', state: 'read', daysAgo: 2, automation: 'milestone', read: true, cta: 'See my progress', path: '/app/progress' },
    { key: 'n2', member: 'ayesha', channel: 'push', category: 'coaching', title: 'Weekly check-in', body: 'Two minutes, Ayesha. Your coach uses this to adjust next week.', state: 'delivered', daysAgo: 1, automation: 'checkin_reminder' },
    { key: 'n3', member: 'hamza', channel: 'push', category: 'coaching', title: 'We miss you at Apex Fitness Lahore', body: 'It has been a week, Hamza. Would a shorter two-day plan help? Your coach can set it up today.', state: 'delivered', daysAgo: 6, automation: 'inactive_7' },
    { key: 'n4', member: 'hamza', channel: 'whatsapp', category: 'coaching', title: 'We miss you at Apex Fitness Lahore', body: 'It has been a week, Hamza.', state: 'suppressed', daysAgo: 6, automation: 'inactive_7', suppression: 'No opt-in recorded for whatsapp' },
    { key: 'n5', member: 'kamran', channel: 'in_app', category: 'billing', title: 'Payment reminder', body: 'Hi Kamran, we could not collect Rs 7,500 for your membership. No rush — you can settle it at the desk any time this week.', state: 'delivered', daysAgo: 2, automation: 'payment_recovery', cta: 'View invoice', path: '/app/billing' },
    { key: 'n6', member: 'fatima', channel: 'push', category: 'operational', title: 'Two minutes to finish setting up', body: 'Fatima, your coach needs a couple more answers before your plan is ready.', state: 'delivered', daysAgo: 3, automation: 'onboarding_nudge' },
    { key: 'n7', member: 'nida', channel: 'push', category: 'operational', title: 'Your trial ends in 2 days', body: 'Hi Nida — how has the week been? If you would like to keep going, the front desk can sort it in two minutes.', state: 'queued', daysAgo: 0, automation: 'trial_conversion' },
    { key: 'n8', member: 'bilal', channel: 'push', category: 'coaching', title: 'Yesterday’s session is still there', body: 'No guilt, Bilal — your session from yesterday is still waiting.', state: 'suppressed', daysAgo: 1, automation: 'missed_workout', suppression: 'Quiet hours (21:30–07:30)' },
    { key: 'n9', member: 'zainab', channel: 'in_app', category: 'safety', title: 'Your plan is being reviewed', body: 'Because of what you shared, a coach is checking your plan before it changes. Nothing is wrong — we just want a person involved.', state: 'read', daysAgo: 40, read: true },
    { key: 'n10', member: 'ahmed', channel: 'in_app', category: 'safety', title: 'We have paused automatic progression', body: 'You told us Barbell Back Squat felt uncomfortable. We have stopped increasing it and asked a coach to check in with you. Please do not push through pain.', state: 'delivered', daysAgo: 1 },
  ];

  for (const notification of notifications) {
    const userId = org.memberIds.get(notification.member);
    if (!userId) continue;
    const member = MEMBERS.find((m) => m.key === notification.member)!;
    const createdAt = addDays(TODAY, -notification.daysAgo);
    const notificationId = uuidFor(`notification:${notification.key}`);

    await insert(db, 'notifications', {
      id: notificationId,
      organization_id: org.organizationId,
      branch_id: org.branchIds[member.branch],
      user_id: userId,
      channel: notification.channel,
      category: notification.category,
      template_key: null,
      title: notification.title,
      body: notification.body,
      cta_label: notification.cta ?? null,
      cta_path: notification.path ?? null,
      state: notification.state,
      suppression_reason: notification.suppression ?? null,
      provider: notification.channel === 'in_app' ? 'internal' : 'console',
      scheduled_for: createdAt.toISOString(),
      sent_at: ['sent', 'delivered', 'read'].includes(notification.state) ? createdAt.toISOString() : null,
      delivered_at: ['delivered', 'read'].includes(notification.state) ? createdAt.toISOString() : null,
      read_at: notification.read ? addDays(createdAt, 0).toISOString() : null,
      automation_id: notification.automation ? uuidFor(`automation:${notification.automation}`) : null,
      created_at: createdAt.toISOString(),
    });

    if (notification.automation) {
      await insert(db, 'automation_runs', {
        id: uuidFor(`automation-run:${notification.key}`),
        organization_id: org.organizationId,
        automation_id: uuidFor(`automation:${notification.automation}`),
        target_user_id: userId,
        state: notification.state === 'suppressed' ? 'skipped' : 'sent',
        skip_reason: notification.suppression ?? null,
        evidence: JSON.stringify({ channel: notification.channel, category: notification.category }),
        notification_id: notificationId,
        // Dedupe is per automation + member + channel + day: the same trigger may
        // legitimately fan out to two channels, but must never fire twice on one.
        dedupe_key: `${notification.automation}:${notification.member}:${notification.channel}:${isoDate(createdAt)}`,
        ran_at: createdAt.toISOString(),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Safety escalations and support
// ---------------------------------------------------------------------------

async function seedSafetyAndSupport(db: Db, org: OrgContext): Promise<void> {
  step('safety: risk flags, escalations, support cases and AI transcripts');

  // --- Ahmed: knee pain reported inside the workout player -------------------
  const ahmedId = org.memberIds.get('ahmed')!;
  const ahmedCaseId = uuidFor('case:ahmed-knee');
  const ahmedRiskId = uuidFor('risk:ahmed-knee');

  await insert(db, 'support_cases', {
    id: ahmedCaseId,
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    reference: 'APX-C-1041',
    member_user_id: ahmedId,
    raised_by_user_id: ahmedId,
    raised_by_ai: false,
    category: 'health_escalation',
    priority: 'high',
    state: 'in_progress',
    subject: 'Health review needed: sharp or worsening pain',
    detail:
      '• [high] sharp_or_worsening_pain: Reported during a workout on a squat movement. Member note: "Sharp pain on the outside of my right knee on the third set of back squats. It got worse each set."',
    contains_health_data: true,
    risk_flag_id: null,
    assigned_to_user_id: org.staffIds.get('coach_hassan'),
    assigned_role: 'coach',
    acknowledged_at: addDays(TODAY, -1).toISOString(),
    first_response_at: addDays(TODAY, -1).toISOString(),
    sla_due_at: addDays(TODAY, 0).toISOString(),
    created_at: addDays(TODAY, -1).toISOString(),
  });

  await insert(db, 'risk_flags', {
    id: ahmedRiskId,
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    user_id: ahmedId,
    kind: 'sharp_or_worsening_pain',
    severity: 'high',
    source: 'workout_log',
    detail: 'Sharp pain on the outside of the right knee during back squats, worsening across sets.',
    affected_movements: ['squat', 'lunge', 'knee_isolation'],
    blocks_progression: true,
    requires_human_review: true,
    support_case_id: ahmedCaseId,
    raised_by: ahmedId,
    raised_at: addDays(TODAY, -1).toISOString(),
  });

  await db.query(
    `update member_profiles
        set progression_hold_reason = $1
      where user_id = $2`,
    ['sharp_or_worsening_pain reported (workout_log) — awaiting staff review', ahmedId],
  );

  await insert(db, 'notes', {
    id: uuidFor('note:ahmed-knee'),
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    entity_type: 'member',
    entity_id: ahmedId,
    author_user_id: org.staffIds.get('coach_hassan'),
    body:
      'Called Ahmed. Pain is lateral, comes on under load, no swelling, no giving way. Told him to stop squatting for now, referred him to the physio we work with, and swapped squats for leg press within a pain-free range. Progression stays locked until the physio reports back. Not making any diagnosis myself.',
    visibility: 'coach_only',
    is_pinned: true,
    created_at: addDays(TODAY, -1).toISOString(),
  });

  // --- Zainab: postpartum flag from screening -------------------------------
  const zainabId = org.memberIds.get('zainab')!;
  const zainabCaseId = uuidFor('case:zainab-postpartum');
  await insert(db, 'support_cases', {
    id: zainabCaseId,
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    reference: 'APX-C-1012',
    member_user_id: zainabId,
    raised_by_user_id: null,
    raised_by_ai: false,
    category: 'health_escalation',
    priority: 'high',
    state: 'resolved',
    subject: 'Health review needed: pregnancy postpartum',
    detail: '• [high] pregnancy_postpartum: Health screening: member reported pregnancy or postpartum.',
    contains_health_data: true,
    assigned_to_user_id: org.staffIds.get('coach_ayesha'),
    assigned_role: 'coach',
    acknowledged_at: addDays(TODAY, -45).toISOString(),
    first_response_at: addDays(TODAY, -45).toISOString(),
    resolved_at: addDays(TODAY, -44).toISOString(),
    resolution_note:
      'Doctor’s clearance received and filed. Assigned the Low Impact Strength program manually. Reviewing again in four weeks.',
    created_at: addDays(TODAY, -46).toISOString(),
  });

  await insert(db, 'risk_flags', {
    id: uuidFor('risk:zainab'),
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    user_id: zainabId,
    kind: 'pregnancy_postpartum',
    severity: 'high',
    source: 'screening',
    detail: 'Five months postpartum. Written clearance from her doctor is on file.',
    affected_movements: ['anti_extension', 'hinge'],
    blocks_progression: false,
    requires_human_review: true,
    support_case_id: zainabCaseId,
    raised_at: addDays(TODAY, -46).toISOString(),
    resolved_by: org.staffIds.get('coach_ayesha'),
    resolved_at: addDays(TODAY, -44).toISOString(),
    resolution_note: 'Cleared for low-impact training by her doctor. Program assigned by a coach, not the engine.',
  });

  // --- Junaid: blood pressure noted -----------------------------------------
  await insert(db, 'risk_flags', {
    id: uuidFor('risk:junaid-bp'),
    organization_id: org.organizationId,
    branch_id: org.branchIds.dha,
    user_id: org.memberIds.get('junaid')!,
    kind: 'blood_pressure',
    severity: 'moderate',
    source: 'screening',
    detail: 'Health screening: declared condition "high blood pressure". On medication, doctor aware.',
    affected_movements: [],
    blocks_progression: false,
    requires_human_review: true,
    support_case_id: null,
    raised_at: addDays(TODAY, -70).toISOString(),
    resolved_by: org.staffIds.get('coach_bilal'),
    resolved_at: addDays(TODAY, -69).toISOString(),
    resolution_note: 'Noted. Avoiding heavy overhead and long breath-holds. Member reminded to keep taking medication as prescribed.',
  });

  // --- Ordinary support cases ------------------------------------------------
  const ordinaryCases = [
    { key: 'billing', ref: 'APX-C-1044', member: 'kamran', category: 'billing', priority: 'normal', state: 'open', subject: 'Card keeps declining', detail: 'My card failed twice, can I just pay cash on Tuesday?', assignee: 'front_desk_zoya', days: 2, ai: false },
    { key: 'coaching', ref: 'APX-C-1045', member: 'fatima', category: 'coaching', priority: 'normal', state: 'waiting_member', subject: 'Nervous about the free weights area', detail: 'Member asked GymGuide Coach how to use the squat rack and then asked for a person to show her.', assignee: 'coach_ayesha', days: 1, ai: true },
    { key: 'nutrition', ref: 'APX-C-1046', member: 'ali', category: 'nutrition', priority: 'normal', state: 'in_progress', subject: 'Struggling to eat enough to gain weight', detail: 'Referred by the AI coach after repeated questions about gaining weight on a student budget.', assignee: 'nutritionist', days: 4, ai: true },
    { key: 'membership', ref: 'APX-C-1047', member: 'saad', category: 'membership', priority: 'low', state: 'resolved', subject: 'Freeze membership while abroad', detail: 'Travelling for work until September.', assignee: 'manager_dha', days: 12, ai: false },
  ];

  for (const item of ordinaryCases) {
    const memberId = org.memberIds.get(item.member);
    if (!memberId) continue;
    const member = MEMBERS.find((m) => m.key === item.member)!;
    await insert(db, 'support_cases', {
      id: uuidFor(`case:${item.key}`),
      organization_id: org.organizationId,
      branch_id: org.branchIds[member.branch],
      reference: item.ref,
      member_user_id: memberId,
      raised_by_user_id: item.ai ? null : memberId,
      raised_by_ai: item.ai,
      category: item.category,
      priority: item.priority,
      state: item.state,
      subject: item.subject,
      detail: item.detail,
      contains_health_data: false,
      assigned_to_user_id: org.staffIds.get(item.assignee),
      acknowledged_at: addDays(TODAY, -item.days + 1).toISOString(),
      resolved_at: item.state === 'resolved' ? addDays(TODAY, -item.days + 2).toISOString() : null,
      resolution_note: item.state === 'resolved' ? 'Freeze applied for 30 days with the manager’s approval.' : null,
      sla_due_at: addDays(TODAY, 1).toISOString(),
      created_at: addDays(TODAY, -item.days).toISOString(),
    });
  }

  // --- Conversations: staff↔member and member↔AI -----------------------------
  const ayeshaId = org.memberIds.get('ayesha')!;
  const coachAyeshaId = org.staffIds.get('coach_ayesha')!;
  const staffThreadId = uuidFor('conversation:ayesha-coach');
  await insert(db, 'conversations', {
    id: staffThreadId,
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    kind: 'member_staff',
    subject: 'Week 18 check-in',
    member_user_id: ayeshaId,
    last_message_at: addDays(TODAY, -1).toISOString(),
    created_by_user_id: coachAyeshaId,
    created_at: addDays(TODAY, -3).toISOString(),
  });
  for (const [userId, role] of [[ayeshaId, 'owner'], [coachAyeshaId, 'participant']] as Array<[string, string]>) {
    await insert(db, 'conversation_participants', {
      id: uuidFor(`participant:ayesha:${userId}`),
      organization_id: org.organizationId,
      conversation_id: staffThreadId,
      user_id: userId,
      role_in_thread: role,
      last_read_at: addDays(TODAY, -1).toISOString(),
    });
  }
  const staffMessages = [
    { sender: coachAyeshaId, kind: 'user', body: 'Ayesha — brilliant week. Your RDL went up 5 kg and your adherence is 86%. How are you feeling in the mornings?', days: 3 },
    { sender: ayeshaId, kind: 'user', body: 'Honestly much better. Clothes fitting differently. Should I add a fourth day?', days: 2 },
    { sender: coachAyeshaId, kind: 'user', body: 'Let’s not. Three days you never miss beats four days you resent. If you want more, add a 20-minute walk on Sunday.', days: 1 },
  ];
  for (const [index, message] of staffMessages.entries()) {
    await insert(db, 'messages', {
      id: uuidFor(`message:staff:${index}`),
      organization_id: org.organizationId,
      conversation_id: staffThreadId,
      sender_user_id: message.sender,
      sender_kind: message.kind,
      body: message.body,
      is_ai_assisted: false,
      created_at: addDays(TODAY, -message.days).toISOString(),
    });
  }

  // AI conversation with an escalation, logged with full provenance.
  const fatimaId = org.memberIds.get('fatima')!;
  const aiThreadId = uuidFor('conversation:fatima-ai');
  await insert(db, 'conversations', {
    id: aiThreadId,
    organization_id: org.organizationId,
    branch_id: org.branchIds.gulberg,
    kind: 'member_ai',
    subject: 'GymGuide Coach',
    member_user_id: fatimaId,
    support_case_id: uuidFor('case:coaching'),
    last_message_at: addDays(TODAY, -1).toISOString(),
    created_by_user_id: fatimaId,
    created_at: addDays(TODAY, -1).toISOString(),
  });
  await insert(db, 'conversation_participants', {
    id: uuidFor('participant:fatima-ai'),
    organization_id: org.organizationId,
    conversation_id: aiThreadId,
    user_id: fatimaId,
    role_in_thread: 'owner',
    last_read_at: addDays(TODAY, -1).toISOString(),
  });

  const aiInteractionId = uuidFor('ai:fatima-1');
  await insert(db, 'ai_interactions', {
    id: aiInteractionId,
    organization_id: org.organizationId,
    user_id: fatimaId,
    subject_user_id: fatimaId,
    conversation_id: aiThreadId,
    surface: 'member_coach',
    driver: 'scripted',
    model: 'gymguide-scripted-v1',
    prompt_version: 'coach-2026-08-01',
    user_input: 'How do I use the squat rack? I have never touched one and I am a bit scared of that area.',
    tool_calls: JSON.stringify([
      { name: 'get_current_plan', arguments: {}, result_summary: 'Induction A, week 2, day 1' },
      { name: 'explain_exercise', arguments: { exerciseCode: 'goblet_squat' }, result_summary: 'Approved technique content returned' },
    ]),
    approved_sources: JSON.stringify([
      { kind: 'exercise', label: 'Goblet Squat', code: 'goblet_squat' },
      { kind: 'program', label: 'Gym Induction — First 4 Weeks' },
    ]),
    output_text:
      'You are not on the squat rack yet — your plan has goblet squats this week, which you do with one dumbbell and no rack at all. Hold the dumbbell against your chest, feet a little wider than your shoulders, and sit down and back like there is a chair behind you. Chest proud, heels down, knees pushed out. If you would like someone to walk you through the rack itself, I can ask a coach to meet you before your next session.',
    safety_result: 'allowed',
    safety_reasons: [],
    latency_ms: 412,
    feedback_rating: 'helpful',
    created_at: addDays(TODAY, -1).toISOString(),
  });

  const aiMessages = [
    { sender: fatimaId, kind: 'user', body: 'How do I use the squat rack? I have never touched one and I am a bit scared of that area.', ai: false, interaction: null },
    {
      sender: null, kind: 'ai', ai: true, interaction: aiInteractionId,
      body: 'You are not on the squat rack yet — your plan has goblet squats this week, which you do with one dumbbell and no rack at all. Hold the dumbbell against your chest, feet a little wider than your shoulders, and sit down and back like there is a chair behind you. Chest proud, heels down, knees pushed out. If you would like someone to walk you through the rack itself, I can ask a coach to meet you before your next session.',
    },
    { sender: fatimaId, kind: 'user', body: 'Yes please, that would help a lot.', ai: false, interaction: null },
    {
      sender: null, kind: 'ai', ai: true, interaction: null,
      body: 'Done — I have asked the team and Ayesha Farooq will meet you fifteen minutes before your Thursday session. Reference APX-C-1045.',
    },
  ];
  for (const [index, message] of aiMessages.entries()) {
    await insert(db, 'messages', {
      id: uuidFor(`message:ai:${index}`),
      organization_id: org.organizationId,
      conversation_id: aiThreadId,
      sender_user_id: message.sender,
      sender_kind: message.kind,
      body: message.body,
      is_ai_assisted: message.ai,
      ai_interaction_id: message.interaction,
      created_at: addDays(TODAY, -1).toISOString(),
    });
  }

  // A blocked AI request, so the safety log is not all happy paths.
  await insert(db, 'ai_interactions', {
    id: uuidFor('ai:hamza-blocked'),
    organization_id: org.organizationId,
    user_id: org.memberIds.get('hamza')!,
    subject_user_id: org.memberIds.get('hamza')!,
    surface: 'member_coach',
    driver: 'scripted',
    model: 'gymguide-scripted-v1',
    prompt_version: 'coach-2026-08-01',
    user_input: 'Give me an 800 calorie diet to lose 10kg in 2 weeks, and should I take a fat burner?',
    tool_calls: JSON.stringify([{ name: 'create_support_case', arguments: { category: 'nutrition', priority: 'normal' } }]),
    approved_sources: JSON.stringify([]),
    output_text:
      'I will not help set up a very low calorie or crash diet — they tend to backfire and can be genuinely unsafe. I can explain the balanced approach in your plan, and I have asked a qualified member of the team to talk it through with you.',
    safety_result: 'blocked_unsafe',
    safety_reasons: ['Extreme calorie restriction request', 'Supplement or medication advice is out of scope'],
    latency_ms: 96,
    created_at: addDays(TODAY, -9).toISOString(),
  });

  // Staff-facing AI summary of a check-in.
  await insert(db, 'ai_interactions', {
    id: uuidFor('ai:staff-summary'),
    organization_id: org.organizationId,
    user_id: org.staffIds.get('coach_ayesha')!,
    subject_user_id: org.memberIds.get('sana')!,
    surface: 'staff_summary',
    driver: 'scripted',
    model: 'gymguide-scripted-v1',
    prompt_version: 'coach-2026-08-01',
    user_input: 'summarize_checkin_for_staff',
    tool_calls: JSON.stringify([{ name: 'summarize_checkin_for_staff', arguments: { weeks: 2 } }]),
    approved_sources: JSON.stringify([{ kind: 'check_in', label: 'Weekly check-ins, last 2 weeks' }]),
    output_text:
      'Two consecutive check-ins with soreness 5/5 and sleep 2/5. Adherence still 79%, so this is recovery rather than motivation. The engine has proposed a 33% volume reduction — it needs your approval. Worth asking about work hours before changing the plan.',
    safety_result: 'allowed',
    safety_reasons: [],
    latency_ms: 380,
    created_at: addDays(TODAY, -2).toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Audit + analytics
// ---------------------------------------------------------------------------

async function seedAuditAndAnalytics(db: Db, org: OrgContext, rng: () => number): Promise<void> {
  step('audit and analytics');

  const auditRows = [
    { action: 'consent_capture', entity: 'consent', summary: 'Captured health data consent for Ayesha Khan', actor: 'front_desk_zoya', subject: 'ayesha', days: 128 },
    { action: 'payment_record', entity: 'payment', summary: 'Recorded a cash payment of Rs 7,500 from Ayesha Khan', actor: 'front_desk_zoya', subject: 'ayesha', days: 11 },
    { action: 'program_assign', entity: 'program_assignment', summary: 'Assigned "Low Impact Strength" to Zainab Malik after clearance', actor: 'coach_ayesha', subject: 'zainab', days: 44 },
    { action: 'escalation', entity: 'risk_flag', summary: 'High-priority escalation raised for Ahmed Nawaz (sharp or worsening pain)', actor: null, subject: 'ahmed', days: 1 },
    { action: 'program_override', entity: 'coaching_recommendation', summary: 'Overrode R-HOLD-003 for Kamran Butt with a written reason', actor: 'coach_hassan', subject: 'kamran', days: 2 },
    { action: 'permission_grant', entity: 'user_permission_grant', summary: 'Granted finance.read to Hassan Ali', actor: 'owner', subject: null, days: 60 },
    { action: 'refund', entity: 'refund', summary: 'Approved a Rs 6,250 pro-rata refund for Saad Mehmood', actor: 'owner', subject: 'saad', days: 10 },
    { action: 'read_sensitive', entity: 'health_screening', summary: 'Viewed health screening for Ahmed Nawaz', actor: 'coach_hassan', subject: 'ahmed', days: 1 },
    { action: 'role_change', entity: 'user_role', summary: 'Added Bilal Nadeem as a coach at Apex DHA Phase 5', actor: 'owner', subject: null, days: 180 },
    { action: 'login', entity: 'auth_session', summary: 'Owner signed in from Lahore', actor: 'owner', subject: null, days: 1 },
  ];

  for (const [index, row] of auditRows.entries()) {
    const actorId = row.actor ? org.staffIds.get(row.actor) ?? null : null;
    const subjectId = row.subject ? org.memberIds.get(row.subject) ?? null : null;
    await insert(
      db,
      'audit_logs',
      {
        organization_id: org.organizationId,
        branch_id: org.branchIds.gulberg,
        actor_user_id: actorId,
        actor_role: row.actor ? roleForStaffKey(row.actor) : null,
        action: row.action,
        entity_type: row.entity,
        entity_id: subjectId,
        subject_user_id: subjectId,
        summary: row.summary,
        reason: row.action === 'program_override' ? 'Member was ill, not overreached' : null,
        ip_address: '203.0.113.' + (10 + index),
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) GymGuide/1.0',
        occurred_at: addDays(TODAY, -row.days).toISOString(),
      },
      'id',
    );
  }

  // Platform support session — time limited, reasoned, and now ended.
  await insert(db, 'support_access_sessions', {
    id: uuidFor('support-session:1'),
    organization_id: org.organizationId,
    platform_user_id: uuidFor('user:platform-support'),
    reason: 'Investigating a duplicate invoice reported by the owner in ticket GG-4471.',
    ticket_reference: 'GG-4471',
    approved_by_org: true,
    scope: 'read_only',
    started_at: addDays(TODAY, -6).toISOString(),
    expires_at: new Date(addDays(TODAY, -6).getTime() + 60 * 60_000).toISOString(),
    ended_at: new Date(addDays(TODAY, -6).getTime() + 42 * 60_000).toISOString(),
    actions_taken: 4,
  });

  const events = ['app_opened', 'workout_started', 'workout_completed', 'set_logged', 'plan_viewed', 'checkin_submitted', 'ai_message_sent', 'class_booked'];
  const analyticsRows: Array<Record<string, unknown>> = [];
  for (const member of MEMBERS) {
    const userId = org.memberIds.get(member.key)!;
    for (let day = 0; day < 14; day += 1) {
      if (!chance(rng, member.adherence)) continue;
      const name = pick(rng, events);
      analyticsRows.push({
        organization_id: org.organizationId,
        branch_id: org.branchIds[member.branch],
        user_id: userId,
        name,
        surface: chance(rng, 0.7) ? 'mobile' : 'web',
        properties: JSON.stringify({ locale: member.locale }),
        occurred_at: addDays(TODAY, -day).toISOString(),
      });
    }
  }
  await insertMany(db, 'analytics_events', analyticsRows);
}

function roleForStaffKey(key: string): string {
  if (key === 'owner') return 'gym_owner';
  if (key.startsWith('manager')) return 'branch_manager';
  if (key.startsWith('coach')) return 'coach';
  if (key.startsWith('front_desk')) return 'front_desk';
  if (key === 'nutritionist') return 'nutrition_professional';
  return 'gym_owner';
}
