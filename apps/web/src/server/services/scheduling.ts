import 'server-only';
/**
 * Classes, bookings and attendance.
 *
 * The rules that matter here are capacity and the waitlist. A booking is never
 * accepted past capacity, and when a place is released the earliest waitlisted
 * member takes it — decided in the database inside one transaction rather than
 * by reading a count and hoping nobody else booked in between.
 */
import type { Actor } from '@gymguide/types';
import { can } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withTenant } from '../db/pool';
import { recordAudit } from '../audit';

export interface ScheduleBooking {
  bookingId: string;
  userId: string;
  memberName: string;
  state: string;
  checkedInAt: string | null;
  bookedAt: string;
}

export interface ScheduleSession {
  sessionId: string;
  className: string;
  category: string;
  intensity: string;
  branchName: string;
  roomName: string | null;
  coachName: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  waitlistCount: number;
  attendedCount: number;
  state: string;
  cancellationReason: string | null;
  womenOnly: boolean;
  bookings: ScheduleBooking[];
}

export interface ScheduleDay {
  day: string;
  sessions: ScheduleSession[];
  totals: { sessions: number; booked: number; capacity: number; attended: number; waitlisted: number };
}

/** Sessions for one day, with their roster. */
export async function loadSchedule(actor: Actor, day: string): Promise<ScheduleDay> {
  const session = tenantSessionFor(actor);

  return withTenant(session, async (db) => {
    const { rows } = await db.query<{
      session_id: string;
      class_name: string;
      category: string;
      intensity: string;
      branch_name: string;
      room_name: string | null;
      coach_name: string | null;
      starts_at: string;
      ends_at: string;
      capacity: number;
      booked_count: number;
      waitlist_count: number;
      attended_count: number;
      state: string;
      cancellation_reason: string | null;
      women_only: boolean;
    }>(
      `select cs.id as session_id, c.name as class_name, c.category, c.intensity, c.women_only,
              b.name as branch_name, r.name as room_name, coach.full_name as coach_name,
              cs.starts_at, cs.ends_at, cs.capacity, cs.booked_count, cs.waitlist_count,
              cs.attended_count, cs.state, cs.cancellation_reason
         from class_sessions cs
         join classes c on c.id = cs.class_id
         join branches b on b.id = cs.branch_id
         left join rooms r on r.id = cs.room_id
         left join users coach on coach.id = cs.coach_id
        where (cs.starts_at at time zone 'Asia/Karachi')::date = $1::date
        order by cs.starts_at, b.name`,
      [day],
    );

    const sessionIds = rows.map((row) => row.session_id);
    const bookings = sessionIds.length
      ? await db.query<{
          class_session_id: string;
          booking_id: string;
          user_id: string;
          member_name: string;
          state: string;
          checked_in_at: string | null;
          booked_at: string;
        }>(
          `select bk.class_session_id, bk.id as booking_id, bk.user_id, u.full_name as member_name,
                  bk.state::text as state, bk.checked_in_at, bk.booked_at
             from bookings bk
             join users u on u.id = bk.user_id
            where bk.class_session_id = any($1::uuid[])
            order by bk.booked_at`,
          [sessionIds],
        )
      : { rows: [] };

    const sessions: ScheduleSession[] = rows.map((row) => ({
      sessionId: row.session_id,
      className: row.class_name,
      category: row.category,
      intensity: row.intensity,
      branchName: row.branch_name,
      roomName: row.room_name,
      coachName: row.coach_name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      capacity: row.capacity,
      bookedCount: row.booked_count,
      waitlistCount: row.waitlist_count,
      attendedCount: row.attended_count,
      state: row.state,
      cancellationReason: row.cancellation_reason,
      womenOnly: row.women_only,
      bookings: bookings.rows
        .filter((booking) => booking.class_session_id === row.session_id)
        .map((booking) => ({
          bookingId: booking.booking_id,
          userId: booking.user_id,
          memberName: booking.member_name,
          state: booking.state,
          checkedInAt: booking.checked_in_at,
          bookedAt: booking.booked_at,
        })),
    }));

    return {
      day,
      sessions,
      totals: {
        sessions: sessions.filter((item) => item.state !== 'cancelled').length,
        booked: sessions.reduce((sum, item) => sum + item.bookedCount, 0),
        capacity: sessions.reduce((sum, item) => sum + item.capacity, 0),
        attended: sessions.reduce((sum, item) => sum + item.attendedCount, 0),
        waitlisted: sessions.reduce((sum, item) => sum + item.waitlistCount, 0),
      },
    };
  });
}

/**
 * Mark a booked member as present.
 *
 * Writes the attendance row the reports read from, so a class check-in and a
 * gym check-in are the same event to everything downstream.
 */
export async function checkInBooking(actor: Actor, bookingId: string): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'attendance.write')) {
    return { ok: false, message: 'You do not have permission to record attendance.' };
  }
  const session = tenantSessionFor(actor);

  try {
    const result = await withTenant(session, async (db) => {
      const { rows } = await db.query<{
        id: string;
        user_id: string;
        branch_id: string;
        class_session_id: string;
        member_name: string;
      }>(
        `update bookings bk
            set state = 'attended', checked_in_at = now(), updated_at = now()
           from users u
          where bk.id = $1 and u.id = bk.user_id
            and bk.state in ('booked', 'waitlisted')
        returning bk.id, bk.user_id, bk.branch_id, bk.class_session_id, u.full_name as member_name`,
        [bookingId],
      );
      const booking = rows[0];
      if (!booking) throw new Error('That booking is not open for check-in, or is not visible to you.');

      await db.query(
        `insert into attendance
           (organization_id, branch_id, user_id, class_session_id, booking_id, method, recorded_by_user_id)
         values ($1, $2, $3, $4, $5, 'manual', $6)`,
        [actor.organizationId, booking.branch_id, booking.user_id, booking.class_session_id, booking.id, actor.userId],
      );

      await db.query(
        `update class_sessions
            set attended_count = (select count(*) from bookings where class_session_id = $1 and state = 'attended'),
                updated_at = now()
          where id = $1`,
        [booking.class_session_id],
      );

      await db.query('update member_profiles set last_visit_at = now() where user_id = $1', [booking.user_id]);

      return booking;
    });

    await recordAudit({
      organizationId: actor.organizationId,
      branchId: result.branch_id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      // The audit vocabulary is a closed enum in both TypeScript and the
      // database; entity_type carries what kind of thing was touched.
      action: 'create',
      entityType: 'attendance',
      entityId: result.id,
      subjectUserId: result.user_id,
      summary: `${actor.fullName} checked ${result.member_name} into a class`,
    });

    return { ok: true, message: `${result.member_name} checked in.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not record that check-in.' };
  }
}

/**
 * Cancel a class and release everyone booked onto it.
 *
 * Members are moved to `cancelled` rather than deleted so the credit-return and
 * notification logic has something to act on, and so the roster is still
 * auditable afterwards.
 */
export async function cancelClassSession(
  actor: Actor,
  classSessionId: string,
  reason: string,
): Promise<{ ok: boolean; message: string; affected: number }> {
  if (!can(actor, 'classes.write')) {
    return { ok: false, message: 'You do not have permission to cancel classes.', affected: 0 };
  }
  if (reason.trim().length < 5) {
    return { ok: false, message: 'Give members a reason — it is shown to them and recorded.', affected: 0 };
  }
  const session = tenantSessionFor(actor);

  try {
    const outcome = await withTenant(session, async (db) => {
      const { rows } = await db.query<{ id: string; branch_id: string; starts_at: string; class_name: string }>(
        `update class_sessions cs
            set state = 'cancelled', cancellation_reason = $2, updated_at = now()
           from classes c
          where cs.id = $1 and c.id = cs.class_id and cs.state = 'scheduled'
        returning cs.id, cs.branch_id, cs.starts_at, c.name as class_name`,
        [classSessionId, reason.trim()],
      );
      const classSession = rows[0];
      if (!classSession) throw new Error('That class is already cancelled or completed, or is not visible to you.');

      const released = await db.query(
        `update bookings
            set state = 'cancelled', cancelled_at = now(), cancelled_by_user_id = $2,
                cancellation_reason = $3, credits_charged = 0, updated_at = now()
          where class_session_id = $1 and state in ('booked', 'waitlisted')`,
        [classSessionId, actor.userId, `Class cancelled: ${reason.trim()}`],
      );

      await db.query(
        'update class_sessions set booked_count = 0, waitlist_count = 0 where id = $1',
        [classSessionId],
      );

      return { classSession, affected: released.rowCount ?? 0 };
    });

    await recordAudit({
      organizationId: actor.organizationId,
      branchId: outcome.classSession.branch_id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'class_session',
      entityId: outcome.classSession.id,
      summary: `${actor.fullName} cancelled ${outcome.classSession.class_name}, releasing ${outcome.affected} booking(s)`,
      reason: reason.trim(),
    });

    return {
      ok: true,
      affected: outcome.affected,
      message:
        outcome.affected === 0
          ? 'Class cancelled. Nobody was booked.'
          : `Class cancelled. ${outcome.affected} member(s) released and no credits charged.`,
    };
  } catch (error) {
    return {
      ok: false,
      affected: 0,
      message: error instanceof Error ? error.message : 'Could not cancel that class.',
    };
  }
}

/**
 * Cancel one member's place.
 *
 * Whether it counts as a late cancellation is decided from the class's own
 * cancellation window, not from a guess at the desk, and the freed place is
 * offered to the waitlist immediately — a place released an hour before a class
 * is worth nothing if someone has to notice it manually.
 */
export async function cancelBooking(
  actor: Actor,
  bookingId: string,
  reason: string,
): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'bookings.write')) {
    return { ok: false, message: 'You do not have permission to change bookings.' };
  }
  const session = tenantSessionFor(actor);

  try {
    const outcome = await withTenant(session, async (db) => {
      const { rows } = await db.query<{
        id: string;
        user_id: string;
        branch_id: string;
        class_session_id: string;
        member_name: string;
        late: boolean;
        penalty: number;
      }>(
        `update bookings bk
            set state = case
                          when cs.starts_at - now() < make_interval(hours => c.cancellation_window_hours)
                            then 'late_cancelled'::booking_state
                          else 'cancelled'::booking_state
                        end,
                cancelled_at = now(),
                cancelled_by_user_id = $2,
                cancellation_reason = $3,
                penalty_applied = case
                                    when cs.starts_at - now() < make_interval(hours => c.cancellation_window_hours)
                                      then c.late_cancel_penalty_credits
                                    else 0
                                  end,
                updated_at = now()
           -- users is listed rather than joined: PostgreSQL will not let the
           -- UPDATE target be referenced from a join condition in FROM.
           from class_sessions cs
           join classes c on c.id = cs.class_id,
                users u
          where bk.id = $1
            and cs.id = bk.class_session_id
            and u.id = bk.user_id
            and bk.state in ('booked', 'waitlisted')
        returning bk.id, bk.user_id, bk.branch_id, bk.class_session_id, u.full_name as member_name,
                  bk.state = 'late_cancelled' as late, bk.penalty_applied as penalty`,
        [bookingId, actor.userId, reason.trim() || 'Cancelled at the front desk'],
      );
      const booking = rows[0];
      if (!booking) throw new Error('That booking is already cancelled or attended, or is not visible to you.');

      await db.query(
        `update class_sessions
            set booked_count   = (select count(*) from bookings where class_session_id = $1 and state = 'booked'),
                waitlist_count = (select count(*) from bookings where class_session_id = $1 and state = 'waitlisted'),
                updated_at = now()
          where id = $1`,
        [booking.class_session_id],
      );

      return booking;
    });

    await recordAudit({
      organizationId: actor.organizationId,
      branchId: outcome.branch_id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'booking',
      entityId: outcome.id,
      subjectUserId: outcome.user_id,
      summary: `${actor.fullName} cancelled ${outcome.member_name}'s place${outcome.late ? ' (late cancellation)' : ''}`,
      reason: reason.trim() || undefined,
    });

    // The freed place goes to whoever has waited longest, straight away.
    const promotion = await promoteFromWaitlist(actor, outcome.class_session_id);

    const lateNote = outcome.late
      ? ` Inside the cancellation window, so ${outcome.penalty} credit(s) charged.`
      : '';
    return {
      ok: true,
      message: `${outcome.member_name} removed from the class.${lateNote}${
        promotion.ok ? ` ${promotion.message}` : ''
      }`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not cancel that booking.' };
  }
}

/**
 * Move the longest-waiting member into a free place.
 *
 * The capacity check and the state change happen in the same statement, so two
 * staff promoting at once cannot both succeed past capacity.
 */
export async function promoteFromWaitlist(
  actor: Actor,
  classSessionId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'bookings.write')) {
    return { ok: false, message: 'You do not have permission to change bookings.' };
  }
  const session = tenantSessionFor(actor);

  try {
    const promoted = await withTenant(session, async (db) => {
      const { rows } = await db.query<{ id: string; user_id: string; member_name: string; branch_id: string }>(
        `update bookings bk
            set state = 'booked', updated_at = now()
           from users u
          where u.id = bk.user_id
            and bk.id = (
              select inner_bk.id
                from bookings inner_bk
                join class_sessions cs on cs.id = inner_bk.class_session_id
               where inner_bk.class_session_id = $1
                 and inner_bk.state = 'waitlisted'
                 and cs.state = 'scheduled'
                 and cs.booked_count < cs.capacity
               order by inner_bk.booked_at
               limit 1
               for update of inner_bk
            )
        returning bk.id, bk.user_id, bk.branch_id, u.full_name as member_name`,
        [classSessionId],
      );
      const booking = rows[0];
      if (!booking) throw new Error('Nobody is waiting, or the class is already full or not scheduled.');

      await db.query(
        `update class_sessions
            set booked_count   = (select count(*) from bookings where class_session_id = $1 and state = 'booked'),
                waitlist_count = (select count(*) from bookings where class_session_id = $1 and state = 'waitlisted'),
                updated_at = now()
          where id = $1`,
        [classSessionId],
      );

      return booking;
    });

    await recordAudit({
      organizationId: actor.organizationId,
      branchId: promoted.branch_id,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'booking',
      entityId: promoted.id,
      subjectUserId: promoted.user_id,
      summary: `${actor.fullName} promoted ${promoted.member_name} from the waitlist`,
    });

    return { ok: true, message: `${promoted.member_name} moved off the waitlist into the class.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not promote from the waitlist.' };
  }
}
