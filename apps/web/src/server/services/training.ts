import 'server-only';
/**
 * The member's training day: what to do today, the workout player payload, and
 * the offline-safe sync endpoint.
 *
 * Offline model: the client caches the player payload and queues completed
 * sessions with a `clientSessionId`. Sync is idempotent — replaying the queue
 * updates the same row instead of creating duplicates — so a phone that
 * reconnects after three days does the right thing.
 */
import {
  computeAdherence,
  computeSessionTotals,
  detectPersonalRecords,
  evaluateCoachingRules,
  resolveSubstitutions,
  suggestedLoadForNextSession,
  type CoachingContext,
  type ExerciseHistory,
  type SubstitutionCandidate,
} from '@gymguide/domain';
import type {
  Actor,
  MovementPattern,
  TodayCard,
  WorkoutPlayerBlock,
  WorkoutPlayerPayload,
  WorkoutSessionSyncInput,
} from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant, type Queryable } from '../db/pool';
import { recordAudit } from '../audit';
import { reportMemberRisk } from './safety';
import { signedUrlFor } from '../adapters/storage';

const RESTRICTED_BY_HOLD = 'restricted';

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

export async function loadToday(actor: Actor): Promise<{
  greetingName: string;
  cards: TodayCard[];
  streak: number;
  adherencePercent: number;
  safetyBanner: string | null;
}> {
  return withTenant(tenantSessionFor(actor), async (db) => {
    const [profile, todaySession, nextSession, checkIn, invoice, booking, notice] = await Promise.all([
      db.query<{ full_name: string; onboarding_completed_at: string | null; progression_hold_reason: string | null; ramadan_mode: boolean }>(
        `select u.full_name, mp.onboarding_completed_at, mp.progression_hold_reason, mp.ramadan_mode
           from users u join member_profiles mp on mp.user_id = u.id where u.id = $1`,
        [actor.userId],
      ),
      db.query<{ id: string; title: string; state: string; workout_id: string | null }>(
        `select id, title, state, workout_id from workout_sessions
          where user_id = $1 and scheduled_for = current_date order by created_at desc limit 1`,
        [actor.userId],
      ),
      db.query<{ scheduled_for: string; title: string }>(
        `select scheduled_for, title from workout_sessions
          where user_id = $1 and scheduled_for > current_date and state = 'scheduled'
          order by scheduled_for asc limit 1`,
        [actor.userId],
      ),
      db.query<{ id: string; week_starting: string }>(
        `select id, week_starting from check_ins
          where user_id = $1 and state = 'pending' and week_starting <= current_date
          order by week_starting desc limit 1`,
        [actor.userId],
      ),
      db.query<{ id: string; number: string; balance: string; due_at: string }>(
        `select id, number, (total_minor - amount_paid_minor) as balance, due_at from invoices
          where user_id = $1 and state in ('open','partially_paid') order by due_at asc limit 1`,
        [actor.userId],
      ),
      db.query<{ name: string; starts_at: string }>(
        `select c.name, cs.starts_at from bookings b
           join class_sessions cs on cs.id = b.class_session_id
           join classes c on c.id = cs.class_id
          where b.user_id = $1 and b.state = 'booked' and cs.starts_at >= now()
          order by cs.starts_at asc limit 1`,
        [actor.userId],
      ),
      db.query<{ title: string; body: string }>(
        `select title, body from notifications
          where user_id = $1 and category = 'safety' and read_at is null
          order by created_at desc limit 1`,
        [actor.userId],
      ),
    ]);

    const person = profile.rows[0];
    const cards: TodayCard[] = [];

    if (person && !person.onboarding_completed_at) {
      cards.push({
        kind: 'onboarding',
        title: 'Finish setting up your plan',
        subtitle: 'Two minutes of questions and your coach can build the right plan for you.',
        ctaLabel: 'See your plan',
        ctaHref: '/app/plan',
        tone: 'primary',
      });
    }

    const session = todaySession.rows[0];
    if (session && session.state !== 'completed' && session.state !== 'skipped') {
      cards.push({
        kind: 'workout',
        title: session.title,
        subtitle: session.state === 'in_progress' ? 'You started this — pick up where you left off.' : 'Today’s session is ready.',
        ctaLabel: session.state === 'in_progress' ? 'Resume workout' : 'Start workout',
        ctaHref: `/app/train/${session.id}`,
        tone: 'primary',
      });
    } else if (session?.state === 'completed') {
      cards.push({
        kind: 'workout',
        title: 'Session complete',
        subtitle: 'Nicely done. Recovery is part of the plan — eat, hydrate, sleep.',
        ctaLabel: 'See your progress',
        ctaHref: '/app/progress',
        tone: 'success',
      });
    } else {
      cards.push({
        kind: 'rest',
        title: 'Rest and recover',
        subtitle: nextSession.rows[0]
          ? `Next session: ${nextSession.rows[0].title} on ${new Date(nextSession.rows[0].scheduled_for).toLocaleDateString('en-PK', { weekday: 'long' })}.`
          : 'Recovery is when your body adapts. Walk, hydrate, sleep well.',
        ctaLabel: 'View my plan',
        ctaHref: '/app/plan',
        tone: 'neutral',
      });
    }

    if (booking.rows[0]) {
      cards.push({
        kind: 'class',
        title: booking.rows[0].name,
        subtitle: new Date(booking.rows[0].starts_at).toLocaleString('en-PK', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
        ctaLabel: 'See your plan',
        ctaHref: '/app/plan',
        tone: 'neutral',
      });
    }
    if (checkIn.rows[0]) {
      cards.push({
        kind: 'checkin',
        title: 'Weekly check-in',
        subtitle: 'Two minutes. Your coach uses this to adjust next week.',
        ctaLabel: 'Check in',
        ctaHref: '/app/progress',
        tone: 'neutral',
      });
    }
    if (invoice.rows[0]) {
      cards.push({
        kind: 'payment',
        title: 'Membership payment due',
        subtitle: `${invoice.rows[0].number} — you can pay at the front desk or by bank transfer.`,
        ctaLabel: 'Ask the front desk',
        ctaHref: '/app/support',
        tone: 'warning',
        meta: { balanceMinor: Number(invoice.rows[0].balance) },
      });
    }

    const adherenceRows = await db.query<{ state: string; completed_sets: number; prescribed_sets: number; total_volume_kg: string; scheduled_for: string }>(
      `select state, completed_sets, prescribed_sets, total_volume_kg, scheduled_for
         from workout_sessions where user_id = $1 and scheduled_for >= current_date - 28`,
      [actor.userId],
    );
    const adherence = computeAdherence(
      adherenceRows.rows.map((row) => ({
        scheduledFor: row.scheduled_for,
        state: row.state as 'completed',
        completedSets: row.completed_sets,
        prescribedSets: row.prescribed_sets,
        totalVolumeKg: Number(row.total_volume_kg),
      })),
    );

    return {
      greetingName: person?.full_name.split(' ')[0] ?? 'there',
      cards,
      streak: adherence.completed,
      adherencePercent: adherence.adherencePercent,
      safetyBanner: notice.rows[0] ? `${notice.rows[0].title}. ${notice.rows[0].body}` : person?.progression_hold_reason
        ? 'Automatic progression is paused while gym staff review your plan.'
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Workout player
// ---------------------------------------------------------------------------

export async function loadWorkoutPlayer(
  actor: Actor,
  sessionId: string,
): Promise<WorkoutPlayerPayload | null> {
  return withTenant(tenantSessionFor(actor), async (db) => {
    const sessionRows = await db.query<{
      id: string; title: string; workout_id: string | null; program_assignment_id: string | null;
      program_day_id: string | null; scheduled_for: string; week_number: number | null; day_number: number | null;
      state: string;
    }>(
      `select id, title, workout_id, program_assignment_id, program_day_id, scheduled_for,
              week_number, day_number, state
         from workout_sessions where id = $1 and user_id = $2`,
      [sessionId, actor.userId],
    );
    const session = sessionRows.rows[0];
    if (!session || !session.workout_id) return null;

    const [workoutRows, blockRows, holdRows, restrictionRows, equipmentRows] = await Promise.all([
      db.query<{ name: string; intent: string; estimated_minutes: number; effort_scale: string; member_intro: string | null }>(
        'select name, intent, estimated_minutes, effort_scale, member_intro from workouts where id = $1',
        [session.workout_id],
      ),
      db.query<Record<string, unknown>>(
        `select wb.id as block_id, wb.kind, wb.label, wb.position as block_position, wb.rounds,
                wb.rest_between_rounds_seconds, wb.instructions,
                wi.id as item_id, wi.position as item_position, wi.target_sets, wi.target_reps_min,
                wi.target_reps_max, wi.target_seconds, wi.target_rpe, wi.tempo, wi.rest_seconds,
                wi.load_guidance, wi.starting_load_kg, wi.allow_substitution, wi.member_note,
                e.id as exercise_id, e.code, e.name, e.name_ur, e.name_ur_rm, e.movement_pattern,
                e.primary_muscles, e.secondary_muscles, e.required_equipment_codes, e.difficulty,
                e.is_low_impact, e.setup_instructions, e.execution_steps, e.form_cues,
                e.common_mistakes, e.safety_notes, e.breathing_cue, e.contraindications,
                e.default_rest_seconds, e.load_step_kg,
                em.storage_key, em.kind as media_kind
           from workout_blocks wb
           join workout_items wi on wi.workout_block_id = wb.id
           join exercises e on e.id = wi.exercise_id
           left join exercise_media em on em.exercise_id = e.id and em.is_primary
          where wb.workout_id = $1
          order by wb.position, wi.position`,
        [session.workout_id],
      ),
      db.query<{ progression_hold_reason: string | null; branch_id: string }>(
        'select progression_hold_reason, branch_id from member_profiles where user_id = $1',
        [actor.userId],
      ),
      db.query<{ affected_movements: string[] }>(
        `select affected_movements from risk_flags where user_id = $1 and resolved_at is null`,
        [actor.userId],
      ),
      db.query<{ code: string }>(
        `select e.code from branch_equipment be
           join equipment e on e.id = be.equipment_id
           join member_profiles mp on mp.branch_id = be.branch_id
          where mp.user_id = $1 and be.is_available`,
        [actor.userId],
      ),
    ]);

    const workout = workoutRows.rows[0];
    if (!workout) return null;

    const hold = holdRows.rows[0]?.progression_hold_reason ?? null;
    const restrictedMovements = [
      ...new Set(restrictionRows.rows.flatMap((row) => row.affected_movements ?? [])),
    ] as MovementPattern[];
    const availableEquipment = equipmentRows.rows.map((row) => row.code);

    const blocks = new Map<string, WorkoutPlayerBlock>();
    for (const row of blockRows.rows) {
      const blockId = String(row.block_id);
      if (!blocks.has(blockId)) {
        blocks.set(blockId, {
          id: blockId,
          kind: row.kind as WorkoutPlayerBlock['kind'],
          label: String(row.label),
          position: Number(row.block_position),
          rounds: Number(row.rounds),
          restBetweenRoundsSeconds: Number(row.rest_between_rounds_seconds),
          instructions: (row.instructions as string | null) ?? null,
          items: [],
        });
      }

      const exerciseId = String(row.exercise_id);
      const history = await loadExerciseHistory(db, actor.userId, exerciseId, String(row.name), row.movement_pattern as MovementPattern, Number(row.load_step_kg));
      const previous = history.sessions[0];

      const substitutions = row.allow_substitution
        ? await loadSubstitutions(db, exerciseId, row.movement_pattern as MovementPattern, availableEquipment, restrictedMovements)
        : [];

      blocks.get(blockId)!.items.push({
        workoutItemId: String(row.item_id),
        position: Number(row.item_position),
        exercise: {
          id: exerciseId,
          code: String(row.code),
          name: String(row.name),
          nameUr: (row.name_ur as string | null) ?? null,
          nameUrRm: (row.name_ur_rm as string | null) ?? null,
          movementPattern: row.movement_pattern as MovementPattern,
          primaryMuscles: (row.primary_muscles as string[]) ?? [],
          secondaryMuscles: (row.secondary_muscles as string[]) ?? [],
          requiredEquipmentCodes: (row.required_equipment_codes as string[]) ?? [],
          difficulty: row.difficulty as 'beginner',
          isLowImpact: Boolean(row.is_low_impact),
          setupInstructions: String(row.setup_instructions),
          executionSteps: (row.execution_steps as string[]) ?? [],
          formCues: (row.form_cues as string[]) ?? [],
          commonMistakes: (row.common_mistakes as string[]) ?? [],
          safetyNotes: (row.safety_notes as string[]) ?? [],
          breathingCue: (row.breathing_cue as string | null) ?? null,
          contraindications: (row.contraindications as string[]) ?? [],
          defaultRestSeconds: Number(row.default_rest_seconds),
          loadStepKg: Number(row.load_step_kg),
          primaryMediaUrl: row.storage_key ? signedUrlFor(String(row.storage_key), 900).url : null,
          mediaKind: (row.media_kind as 'video' | null) ?? null,
        },
        targetSets: Number(row.target_sets),
        targetRepsMin: row.target_reps_min ? Number(row.target_reps_min) : null,
        targetRepsMax: row.target_reps_max ? Number(row.target_reps_max) : null,
        targetSeconds: row.target_seconds ? Number(row.target_seconds) : null,
        targetRpe: row.target_rpe ? Number(row.target_rpe) : null,
        tempo: (row.tempo as string | null) ?? null,
        restSeconds: Number(row.rest_seconds),
        loadGuidance: (row.load_guidance as string | null) ?? null,
        suggestedLoadKg: suggestedLoadForNextSession(
          history,
          { progressionHoldReason: hold, restrictedMovements },
          row.starting_load_kg ? Number(row.starting_load_kg) : null,
        ),
        allowSubstitution: Boolean(row.allow_substitution),
        memberNote: (row.member_note as string | null) ?? null,
        previous: previous
          ? {
              exerciseId,
              lastPerformedOn: previous.performedOn,
              bestWeightKg: Math.max(0, ...previous.sets.map((s) => s.weightKg ?? 0)) || null,
              bestReps: Math.max(0, ...previous.sets.map((s) => s.reps ?? 0)) || null,
              lastSets: previous.sets.map((s) => ({
                setNumber: s.setNumber,
                weightKg: s.weightKg,
                reps: s.reps,
                rpe: s.rpe,
              })),
            }
          : null,
        substitutions,
      });
    }

    return {
      sessionId: session.id,
      clientSessionId: `srv-${session.id}`,
      programAssignmentId: session.program_assignment_id,
      programDayId: session.program_day_id,
      workoutId: session.workout_id,
      title: session.title,
      intent: workout.intent as WorkoutPlayerPayload['intent'],
      goalHeadline: workout.member_intro ?? '',
      estimatedMinutes: workout.estimated_minutes,
      scheduledFor: session.scheduled_for,
      weekNumber: session.week_number,
      dayNumber: session.day_number,
      memberIntro: workout.member_intro,
      effortScale: workout.effort_scale as 'simple',
      blocks: [...blocks.values()].sort((a, b) => a.position - b.position),
      safety: {
        progressionLocked: Boolean(hold),
        lockReason: hold,
        restrictedMovements,
        banner: hold
          ? 'Your plan is being reviewed by a coach, so weights stay where they are today. Nothing is wrong with a steady week.'
          : null,
      },
      generatedAt: new Date().toISOString(),
    };
  });
}

async function loadExerciseHistory(
  db: Queryable,
  userId: string,
  exerciseId: string,
  exerciseName: string,
  movementPattern: MovementPattern,
  loadStepKg: number,
): Promise<ExerciseHistory> {
  const { rows } = await db.query<{
    session_id: string; performed_on: string; set_number: number; reps_completed: number | null;
    weight_kg: string | null; rpe: string | null; target_reps_min: number | null;
    target_reps_max: number | null; is_warmup: boolean; skipped: boolean; discomfort_level: number | null;
    prescribed: number;
  }>(
    `select ws.id as session_id, ws.scheduled_for as performed_on, sl.set_number, sl.reps_completed,
            sl.weight_kg, sl.rpe, sl.target_reps_min, sl.target_reps_max, sl.is_warmup, sl.skipped,
            sl.discomfort_level, ws.prescribed_sets as prescribed
       from set_logs sl
       join workout_sessions ws on ws.id = sl.workout_session_id
      where sl.user_id = $1 and sl.exercise_id = $2 and ws.state = 'completed'
      order by ws.scheduled_for desc, sl.set_number asc
      limit 40`,
    [userId, exerciseId],
  );

  const bySession = new Map<string, ExerciseHistory['sessions'][number]>();
  for (const row of rows) {
    if (!bySession.has(row.session_id)) {
      bySession.set(row.session_id, {
        sessionId: row.session_id,
        performedOn: row.performed_on,
        prescribedSets: rows.filter((r) => r.session_id === row.session_id && !r.is_warmup).length,
        targetRpe: null,
        sets: [],
      });
    }
    bySession.get(row.session_id)!.sets.push({
      setNumber: row.set_number,
      reps: row.reps_completed,
      weightKg: row.weight_kg ? Number(row.weight_kg) : null,
      rpe: row.rpe ? Number(row.rpe) : null,
      targetRepsMin: row.target_reps_min,
      targetRepsMax: row.target_reps_max,
      isWarmup: row.is_warmup,
      skipped: row.skipped,
      discomfortLevel: row.discomfort_level,
    });
  }

  return {
    exerciseId,
    exerciseName,
    movementPattern,
    loadStepKg,
    sessions: [...bySession.values()],
  };
}

async function loadSubstitutions(
  db: Queryable,
  exerciseId: string,
  movementPattern: MovementPattern,
  availableEquipment: string[],
  restrictedMovements: MovementPattern[],
): Promise<Array<{ exerciseId: string; name: string; reason: string; requiresEquipment: string[] }>> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select es.reason, es.preference_rank, alt.id, alt.name, alt.movement_pattern,
            alt.required_equipment_codes, alt.difficulty, alt.is_low_impact, alt.contraindications
       from exercise_substitutions es
       join exercises alt on alt.id = es.alternative_exercise_id
      where es.exercise_id = $1 and alt.deleted_at is null`,
    [exerciseId],
  );

  const candidates: SubstitutionCandidate[] = rows.map((row) => ({
    exerciseId: String(row.id),
    name: String(row.name),
    movementPattern: row.movement_pattern as MovementPattern,
    requiredEquipmentCodes: (row.required_equipment_codes as string[]) ?? [],
    difficulty: row.difficulty as 'beginner',
    isLowImpact: Boolean(row.is_low_impact),
    contraindications: (row.contraindications as string[]) ?? [],
    reason: row.reason as SubstitutionCandidate['reason'],
    preferenceRank: Number(row.preference_rank),
  }));

  const resolved = resolveSubstitutions({
    originalExerciseId: exerciseId,
    originalMovementPattern: movementPattern,
    reason: 'preference',
    availableEquipmentCodes: availableEquipment,
    restrictedMovements,
    memberConditions: [],
    requireLowImpact: false,
    approvedCandidates: candidates,
  });

  return resolved.allowed.map((candidate) => ({
    exerciseId: candidate.exerciseId,
    name: candidate.name,
    reason: candidate.reason,
    requiresEquipment: candidate.requiredEquipmentCodes,
  }));
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export interface SyncResult {
  ok: boolean;
  sessionId?: string;
  duplicate: boolean;
  totals?: { volumeKg: number; completedSets: number; prescribedSets: number };
  personalRecords: Array<{ exerciseName: string; kind: string; value: number; unit: string }>;
  recommendations: Array<{ ruleId: string; kind: string; memberMessage: string; requiresStaffApproval: boolean }>;
  escalation: { caseReference: string | null; notice: { title: string; body: string; tone: string } | null } | null;
  message: string;
}

export async function syncWorkoutSession(actor: Actor, input: WorkoutSessionSyncInput): Promise<SyncResult> {
  const session = tenantSessionFor(actor);

  const outcome = await withTenant(session, async (db) => {
    const profile = await db.query<{ branch_id: string; organization_id: string; progression_hold_reason: string | null; training_days_per_week: number | null; primary_goal: string | null; experience_level: string | null }>(
      `select branch_id, organization_id, progression_hold_reason, training_days_per_week, primary_goal, experience_level
         from member_profiles where user_id = $1`,
      [actor.userId],
    );
    const member = profile.rows[0];
    if (!member) throw new Error('No member profile for this account.');

    // Idempotency: the same clientSessionId always maps to the same row.
    const existing = await db.query<{ id: string; state: string }>(
      'select id, state from workout_sessions where user_id = $1 and client_session_id = $2',
      [actor.userId, input.clientSessionId],
    );

    const totals = computeSessionTotals(
      input.sets.map((set) => ({
        reps: set.repsCompleted ?? null,
        weightKg: set.weightKg ?? null,
        rpe: set.rpe ?? null,
        isWarmup: set.isWarmup,
        skipped: set.skipped,
      })),
      input.sets.length,
    );

    let sessionId: string;
    let duplicate = false;

    if (existing.rows[0]) {
      sessionId = existing.rows[0].id;
      duplicate = existing.rows[0].state === 'completed' && input.state === 'completed';
      await db.query(
        `update workout_sessions
            set state = $1::session_state, started_at = coalesce(started_at, $2), completed_at = $3,
                duration_seconds = $4, total_volume_kg = $5, completed_sets = $6,
                session_rpe = $7, mood = $8, sleep_hours = $9, energy_level = $10,
                member_note = $11, synced_at = now(), sync_source = 'offline_queue',
                client_recorded_at = $12
          where id = $13`,
        [
          input.state, input.startedAt ?? null, input.completedAt ?? null, input.durationSeconds ?? null,
          totals.totalVolumeKg, totals.completedSets, input.sessionRpe ?? null, input.mood ?? null,
          input.sleepHours ?? null, input.energyLevel ?? null, input.memberNote ?? null,
          input.clientRecordedAt, sessionId,
        ],
      );
    } else {
      const { rows } = await db.query<{ id: string }>(
        `insert into workout_sessions
           (organization_id, branch_id, user_id, program_assignment_id, program_day_id, workout_id,
            title, state, scheduled_for, started_at, completed_at, duration_seconds, total_volume_kg,
            completed_sets, prescribed_sets, session_rpe, mood, sleep_hours, energy_level, member_note,
            client_session_id, client_recorded_at, synced_at, sync_source)
         values ($1,$2,$3,$4,$5,$6,$7,$8::session_state,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,now(),'offline_queue')
         returning id`,
        [
          member.organization_id, member.branch_id, actor.userId, input.programAssignmentId ?? null,
          input.programDayId ?? null, input.workoutId ?? null, input.title, input.state,
          input.scheduledFor, input.startedAt ?? null, input.completedAt ?? null,
          input.durationSeconds ?? null, totals.totalVolumeKg, totals.completedSets, input.sets.length,
          input.sessionRpe ?? null, input.mood ?? null, input.sleepHours ?? null,
          input.energyLevel ?? null, input.memberNote ?? null, input.clientSessionId, input.clientRecordedAt,
        ],
      );
      sessionId = rows[0]!.id;
    }

    // Replace this session's set logs. `client_set_id` keeps replays stable.
    for (const set of input.sets) {
      await db.query(
        `insert into set_logs
           (organization_id, workout_session_id, user_id, workout_item_id, exercise_id,
            substituted_for_exercise_id, set_number, target_reps_min, target_reps_max, reps_completed,
            weight_kg, seconds_held, distance_m, rpe, rest_taken_seconds, is_warmup, skipped,
            skip_reason, discomfort_level, discomfort_area, note, logged_at, client_set_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         on conflict (workout_session_id, workout_item_id, set_number) do update
            set reps_completed = excluded.reps_completed,
                weight_kg = excluded.weight_kg,
                rpe = excluded.rpe,
                skipped = excluded.skipped,
                discomfort_level = excluded.discomfort_level,
                note = excluded.note`,
        [
          member.organization_id, sessionId, actor.userId, set.workoutItemId, set.exerciseId,
          set.substitutedForExerciseId ?? null, set.setNumber, set.targetRepsMin ?? null,
          set.targetRepsMax ?? null, set.repsCompleted ?? null, set.weightKg ?? null,
          set.secondsHeld ?? null, set.distanceM ?? null, set.rpe ?? null, set.restTakenSeconds ?? null,
          set.isWarmup, set.skipped, set.skipReason ?? null, set.discomfortLevel ?? null,
          set.discomfortArea ?? null, set.note ?? null, set.loggedAt, set.clientSetId,
        ],
      );
    }

    // Personal records.
    const prCandidates = input.sets
      .filter((set) => !set.isWarmup && !set.skipped && (set.weightKg ?? 0) > 0 && (set.repsCompleted ?? 0) > 0)
      .map((set) => ({
        exerciseId: set.exerciseId,
        exerciseName: '',
        weightKg: set.weightKg!,
        reps: set.repsCompleted!,
        setLogId: set.clientSetId,
        achievedAt: set.loggedAt,
      }));

    const { rows: existingRecords } = await db.query<{ exercise_id: string; record_kind: string; value: string }>(
      `select exercise_id, record_kind, value from personal_records where user_id = $1`,
      [actor.userId],
    );
    const detected = detectPersonalRecords(
      prCandidates,
      existingRecords.map((row) => ({
        exerciseId: row.exercise_id,
        kind: row.record_kind as 'max_weight',
        value: Number(row.value),
      })),
    );

    const namedRecords: Array<{ exerciseName: string; kind: string; value: number; unit: string }> = [];
    for (const record of detected) {
      const { rows: exerciseRows } = await db.query<{ name: string }>('select name from exercises where id = $1', [
        record.exerciseId,
      ]);
      const name = exerciseRows[0]?.name ?? 'Exercise';
      namedRecords.push({ exerciseName: name, kind: record.kind, value: record.value, unit: record.unit });
      await db.query(
        `insert into personal_records
           (organization_id, user_id, exercise_id, record_kind, value, unit, reps, weight_kg, achieved_at, previous_value)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict do nothing`,
        [
          member.organization_id, actor.userId, record.exerciseId, record.kind, record.value,
          record.unit, null, null, record.achievedAt, record.previousValue,
        ],
      );
    }

    await db.query(
      `update member_profiles set last_workout_at = greatest(coalesce(last_workout_at, to_timestamp(0)), $1::timestamptz),
              last_visit_at = greatest(coalesce(last_visit_at, to_timestamp(0)), $1::timestamptz)
        where user_id = $2`,
      [input.completedAt ?? new Date().toISOString(), actor.userId],
    );

    return { sessionId, duplicate, totals, records: namedRecords, member };
  });

  // Pain reported during the session escalates outside the write transaction so
  // the workout is never lost if escalation fails.
  let escalation: SyncResult['escalation'] = null;
  const painfulSet = input.sets.find((set) => (set.discomfortLevel ?? 0) >= 5);
  if (input.reportedRisk || painfulSet) {
    const result = await reportMemberRisk(actor, {
      memberUserId: actor.userId,
      kind: (input.reportedRisk?.kind as 'sharp_or_worsening_pain') ?? 'sharp_or_worsening_pain',
      detail: input.reportedRisk?.detail ?? painfulSet?.note ?? undefined,
      discomfortLevel: painfulSet?.discomfortLevel ?? undefined,
      workoutSessionId: outcome.sessionId,
      source: 'workout_log',
    });
    escalation = { caseReference: result.caseReference, notice: result.memberNotice };
  }

  // Run the coaching engine after a completed session.
  const recommendations = input.state === 'completed' ? await runCoachingEngine(actor) : [];

  await recordAudit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: outcome.duplicate ? 'update' : 'create',
    entityType: 'workout_session',
    entityId: outcome.sessionId,
    subjectUserId: actor.userId,
    summary: outcome.duplicate
      ? 'Re-synced an already-recorded workout (no duplicate created)'
      : `Logged ${input.title} — ${outcome.totals.completedSets} sets, ${outcome.totals.totalVolumeKg} kg`,
  });

  return {
    ok: true,
    sessionId: outcome.sessionId,
    duplicate: outcome.duplicate,
    totals: {
      volumeKg: outcome.totals.totalVolumeKg,
      completedSets: outcome.totals.completedSets,
      prescribedSets: outcome.totals.prescribedSets,
    },
    personalRecords: outcome.records,
    recommendations,
    escalation,
    message: outcome.duplicate ? 'Already synced — nothing was duplicated.' : 'Workout synced.',
  };
}

// ---------------------------------------------------------------------------
// Coaching engine run
// ---------------------------------------------------------------------------

export async function runCoachingEngine(
  actor: Actor,
): Promise<Array<{ ruleId: string; kind: string; memberMessage: string; requiresStaffApproval: boolean }>> {
  const session = tenantSessionFor(actor);

  return withTenant(session, async (db) => {
    const profile = await db.query<{
      primary_goal: string; experience_level: string; progression_hold_reason: string | null;
      training_days_per_week: number | null; organization_id: string;
    }>(
      `select primary_goal, experience_level, progression_hold_reason, training_days_per_week, organization_id
         from member_profiles where user_id = $1`,
      [actor.userId],
    );
    const member = profile.rows[0];
    if (!member) return [];

    const assignment = await db.query<{ id: string }>(
      `select id from program_assignments where user_id = $1 and state = 'active' limit 1`,
      [actor.userId],
    );

    const [exerciseIds, sessions, checkIns, restrictions] = await Promise.all([
      db.query<{ exercise_id: string; name: string; movement_pattern: string; load_step_kg: string }>(
        `select distinct sl.exercise_id, e.name, e.movement_pattern, e.load_step_kg
           from set_logs sl join exercises e on e.id = sl.exercise_id
          where sl.user_id = $1 and sl.logged_at >= now() - interval '21 days'`,
        [actor.userId],
      ),
      db.query<{ id: string; scheduled_for: string; state: string; session_rpe: string | null; discomfort_reported: boolean }>(
        `select id, scheduled_for, state, session_rpe, discomfort_reported from workout_sessions
          where user_id = $1 and scheduled_for >= current_date - 21`,
        [actor.userId],
      ),
      db.query<{ week_starting: string; sleep_quality: number | null; stress_level: number | null; soreness_level: number | null; energy_level: number | null; nutrition_adherence: number | null }>(
        `select week_starting, sleep_quality, stress_level, soreness_level, energy_level, nutrition_adherence
           from check_ins where user_id = $1 and state in ('submitted','reviewed')
          order by week_starting desc limit 4`,
        [actor.userId],
      ),
      db.query<{ affected_movements: string[] }>(
        'select affected_movements from risk_flags where user_id = $1 and resolved_at is null',
        [actor.userId],
      ),
    ]);

    const histories: ExerciseHistory[] = [];
    for (const row of exerciseIds.rows) {
      histories.push(
        await loadExerciseHistory(
          db,
          actor.userId,
          row.exercise_id,
          row.name,
          row.movement_pattern as MovementPattern,
          Number(row.load_step_kg),
        ),
      );
    }

    const context: CoachingContext = {
      userId: actor.userId,
      programAssignmentId: assignment.rows[0]?.id ?? null,
      goal: (member.primary_goal as CoachingContext['goal']) ?? 'general_fitness',
      experienceLevel: (member.experience_level as CoachingContext['experienceLevel']) ?? 'beginner',
      progressionHoldReason: member.progression_hold_reason,
      restrictedMovements: [...new Set(restrictions.rows.flatMap((r) => r.affected_movements ?? []))] as MovementPattern[],
      trainingDaysPerWeek: member.training_days_per_week ?? 3,
      today: new Date().toISOString().slice(0, 10),
      histories,
      recentSessions: sessions.rows.map((row) => ({
        sessionId: row.id,
        scheduledFor: row.scheduled_for,
        state: row.state as 'completed',
        sessionRpe: row.session_rpe ? Number(row.session_rpe) : null,
        discomfortReported: row.discomfort_reported,
      })),
      recentCheckIns: checkIns.rows.map((row) => ({
        weekStarting: row.week_starting,
        sleepQuality: row.sleep_quality,
        stressLevel: row.stress_level,
        sorenessLevel: row.soreness_level,
        energyLevel: row.energy_level,
        nutritionAdherence: row.nutrition_adherence,
      })),
      availableEquipmentCodes: [],
    };

    const recommendations = evaluateCoachingRules(context);

    for (const recommendation of recommendations) {
      // Do not re-propose the same rule for the same exercise within a week.
      const { rows: recent } = await db.query<{ id: string }>(
        `select id from coaching_recommendations
          where user_id = $1 and rule_id = $2 and coalesce(exercise_id::text,'') = coalesce($3::text,'')
            and created_at > now() - interval '6 days'`,
        [actor.userId, recommendation.ruleId, recommendation.exerciseId],
      );
      if (recent.length > 0) continue;

      await db.query(
        `insert into coaching_recommendations
           (organization_id, user_id, program_assignment_id, exercise_id, rule_id, rule_version, kind,
            rationale, evidence, before_value, after_value, requires_staff_approval, state, applied_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          member.organization_id, actor.userId, context.programAssignmentId, recommendation.exerciseId,
          recommendation.ruleId, recommendation.ruleVersion, recommendation.kind, recommendation.rationale,
          JSON.stringify(recommendation.evidence), JSON.stringify(recommendation.beforeValue),
          JSON.stringify(recommendation.afterValue), recommendation.requiresStaffApproval,
          recommendation.requiresStaffApproval ? 'proposed' : 'auto_applied',
          recommendation.requiresStaffApproval ? null : new Date(),
        ],
      );
    }

    return recommendations.map((r) => ({
      ruleId: r.ruleId,
      kind: r.kind,
      memberMessage: r.memberMessage,
      requiresStaffApproval: r.requiresStaffApproval,
    }));
  });
}

export { RESTRICTED_BY_HOLD };
