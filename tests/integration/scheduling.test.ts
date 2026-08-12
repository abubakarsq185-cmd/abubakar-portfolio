import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { permissionsForRoles, type Actor } from '@gymguide/types';
import {
  cancelBooking,
  cancelClassSession,
  checkInBooking,
  loadSchedule,
  promoteFromWaitlist,
} from '../../apps/web/src/server/services/scheduling';
import { closePools } from '../../apps/web/src/server/db/pool';
import { ownerClient } from './helpers';

/**
 * Classes, bookings and attendance, driven as a real front-desk user.
 *
 * The interesting behaviour is at the edges: a full class must refuse to
 * promote, a released place must go to whoever waited longest, and a cancelled
 * class must not leave members holding a booking for something that is not
 * happening.
 */
describe('classes, bookings and attendance', () => {
  let owner: Client;
  let actor: Actor;
  /** Cancelling a class is a manager decision — front desk cannot do it. */
  let manager: Actor;
  let organizationId: string;
  let branchId: string;
  let classId: string;
  let coachId: string;

  /** Class sessions created by a test, removed afterwards. */
  const created: string[] = [];

  async function makeSession(capacity: number, startsInHours: number): Promise<string> {
    const { rows } = await owner.query<{ id: string }>(
      `insert into class_sessions (organization_id, branch_id, class_id, coach_id, starts_at, ends_at, capacity)
       values ($1, $2, $3, $4, now() + make_interval(hours => $5), now() + make_interval(hours => $5 + 1), $6)
       returning id`,
      [organizationId, branchId, classId, coachId, startsInHours, capacity],
    );
    const id = rows[0]!.id;
    created.push(id);
    return id;
  }

  /** Book a seeded member onto a session, oldest booking first by offset. */
  async function book(
    classSessionId: string,
    memberEmail: string,
    state: 'booked' | 'waitlisted',
    minutesAgo: number,
  ): Promise<string> {
    const { rows } = await owner.query<{ id: string }>(
      `insert into bookings (organization_id, branch_id, class_session_id, user_id, state, booked_at)
       select $1, $2, $3, u.id, $4::booking_state, now() - make_interval(mins => $5)
         from users u where u.email = $6
       returning id`,
      [organizationId, branchId, classSessionId, state, minutesAgo, memberEmail],
    );
    await owner.query(
      `update class_sessions
          set booked_count   = (select count(*) from bookings where class_session_id = $1 and state = 'booked'),
              waitlist_count = (select count(*) from bookings where class_session_id = $1 and state = 'waitlisted')
        where id = $1`,
      [classSessionId],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    owner = await ownerClient();

    const { rows: staff } = await owner.query<{ id: string; organization_id: string; branch_id: string }>(
      `select u.id, u.organization_id, sa.branch_id
         from users u join staff_assignments sa on sa.user_id = u.id
        where u.email = 'frontdesk@apexfitness.pk'`,
    );
    organizationId = staff[0]!.organization_id;
    branchId = staff[0]!.branch_id;

    const { rows: classes } = await owner.query<{ id: string; default_coach_id: string | null }>(
      `select id, default_coach_id from classes
        where branch_id = $1 and is_active and deleted_at is null
        order by name limit 1`,
      [branchId],
    );
    classId = classes[0]!.id;

    const { rows: coach } = await owner.query<{ id: string }>(
      `select id from users where email = 'coach@apexfitness.pk'`,
    );
    coachId = classes[0]!.default_coach_id ?? coach[0]!.id;

    actor = {
      userId: staff[0]!.id,
      organizationId,
      role: 'front_desk',
      roles: ['front_desk'],
      permissions: permissionsForRoles(['front_desk']),
      branchIds: [branchId],
      isPlatformAdmin: false,
      fullName: 'Zoya Ahmed',
      email: 'frontdesk@apexfitness.pk',
    };

    const { rows: managerRows } = await owner.query<{ id: string }>(
      `select id from users where email = 'manager.dha@apexfitness.pk'`,
    );
    manager = {
      userId: managerRows[0]!.id,
      organizationId,
      role: 'branch_manager',
      roles: ['branch_manager'],
      permissions: permissionsForRoles(['branch_manager']),
      branchIds: [branchId],
      isPlatformAdmin: false,
      fullName: 'Sadia Rehman',
      email: 'manager.dha@apexfitness.pk',
    };
  }, 30_000);

  afterAll(async () => {
    if (created.length) {
      await owner.query('delete from class_sessions where id = any($1::uuid[])', [created]);
    }
    await closePools();
    await owner?.end();
  });

  it('checks a booked member in and writes the attendance the reports read', async () => {
    const sessionId = await makeSession(10, 2);
    const bookingId = await book(sessionId, 'ayesha.khan@example.com', 'booked', 60);

    const result = await checkInBooking(actor, bookingId);
    expect(result.ok, result.message).toBe(true);

    const { rows } = await owner.query<{ state: string; attendance: string; attended_count: number }>(
      `select bk.state::text as state,
              (select count(*) from attendance a where a.booking_id = bk.id) as attendance,
              cs.attended_count
         from bookings bk join class_sessions cs on cs.id = bk.class_session_id
        where bk.id = $1`,
      [bookingId],
    );
    expect(rows[0]!.state).toBe('attended');
    expect(Number(rows[0]!.attendance)).toBe(1);
    expect(rows[0]!.attended_count).toBe(1);
  });

  it('refuses to check the same member in twice', async () => {
    const sessionId = await makeSession(10, 2);
    const bookingId = await book(sessionId, 'bilal.ahmed@example.com', 'booked', 60);

    expect((await checkInBooking(actor, bookingId)).ok).toBe(true);
    const second = await checkInBooking(actor, bookingId);
    expect(second.ok).toBe(false);
    expect(second.message).toMatch(/not open for check-in/i);

    const { rows } = await owner.query<{ count: string }>(
      'select count(*) as count from attendance where booking_id = $1',
      [bookingId],
    );
    expect(Number(rows[0]!.count)).toBe(1);
  });

  it('will not promote from the waitlist while the class is full', async () => {
    const sessionId = await makeSession(1, 3);
    await book(sessionId, 'ayesha.khan@example.com', 'booked', 90);
    await book(sessionId, 'bilal.ahmed@example.com', 'waitlisted', 60);

    const result = await promoteFromWaitlist(actor, sessionId);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already full|nobody is waiting/i);
  });

  it('gives a released place to whoever waited longest', async () => {
    const sessionId = await makeSession(1, 3);
    const holder = await book(sessionId, 'ayesha.khan@example.com', 'booked', 120);
    // Sana waited longer than Zainab, so the place is hers.
    await book(sessionId, 'sana.iqbal@example.com', 'waitlisted', 90);
    await book(sessionId, 'zainab.malik@example.com', 'waitlisted', 30);

    const result = await cancelBooking(actor, holder, 'Member called to cancel');
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toMatch(/waitlist/i);

    const { rows } = await owner.query<{ full_name: string; state: string }>(
      `select u.full_name, bk.state::text as state
         from bookings bk join users u on u.id = bk.user_id
        where bk.class_session_id = $1 and bk.state = 'booked'`,
      [sessionId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.full_name).toBe('Sana Iqbal');

    const { rows: counts } = await owner.query<{ booked_count: number; waitlist_count: number }>(
      'select booked_count, waitlist_count from class_sessions where id = $1',
      [sessionId],
    );
    expect(counts[0]!.booked_count).toBe(1);
    expect(counts[0]!.waitlist_count).toBe(1);
  });

  it('charges the late-cancellation penalty only inside the class’s own window', async () => {
    const { rows: windowRows } = await owner.query<{ hours: number; penalty: number }>(
      'select cancellation_window_hours as hours, late_cancel_penalty_credits as penalty from classes where id = $1',
      [classId],
    );
    const { hours, penalty } = windowRows[0]!;

    const early = await makeSession(10, hours + 24);
    const earlyBooking = await book(early, 'ayesha.khan@example.com', 'booked', 60);
    expect((await cancelBooking(actor, earlyBooking, 'Plans changed')).ok).toBe(true);

    const late = await makeSession(10, Math.max(0, hours - 1));
    const lateBooking = await book(late, 'ayesha.khan@example.com', 'booked', 60);
    expect((await cancelBooking(actor, lateBooking, 'Stuck in traffic')).ok).toBe(true);

    const { rows } = await owner.query<{ id: string; state: string; penalty_applied: number }>(
      'select id, state::text as state, penalty_applied from bookings where id = any($1::uuid[])',
      [[earlyBooking, lateBooking]],
    );
    const earlyRow = rows.find((row) => row.id === earlyBooking)!;
    const lateRow = rows.find((row) => row.id === lateBooking)!;

    expect(earlyRow.state).toBe('cancelled');
    expect(earlyRow.penalty_applied).toBe(0);
    expect(lateRow.state).toBe('late_cancelled');
    expect(lateRow.penalty_applied).toBe(penalty);
  });

  it('releases everyone when a class is cancelled, and charges nobody', async () => {
    const sessionId = await makeSession(2, 5);
    await book(sessionId, 'ayesha.khan@example.com', 'booked', 90);
    await book(sessionId, 'bilal.ahmed@example.com', 'booked', 60);
    await book(sessionId, 'sana.iqbal@example.com', 'waitlisted', 30);

    const result = await cancelClassSession(manager, sessionId, 'Coach unwell — resumes next week');
    expect(result.ok, result.message).toBe(true);
    expect(result.affected).toBe(3);

    const { rows } = await owner.query<{ state: string; credits_charged: number }>(
      'select state::text as state, credits_charged from bookings where class_session_id = $1',
      [sessionId],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.state === 'cancelled')).toBe(true);
    expect(rows.every((row) => row.credits_charged === 0)).toBe(true);

    const { rows: sessionRows } = await owner.query<{ state: string; booked_count: number }>(
      'select state, booked_count from class_sessions where id = $1',
      [sessionId],
    );
    expect(sessionRows[0]!.state).toBe('cancelled');
    expect(sessionRows[0]!.booked_count).toBe(0);
  });

  it('requires a reason before a class can be cancelled', async () => {
    const sessionId = await makeSession(5, 6);
    const result = await cancelClassSession(manager, sessionId, 'nope');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/reason/i);

    const { rows } = await owner.query<{ state: string }>('select state from class_sessions where id = $1', [sessionId]);
    expect(rows[0]!.state).toBe('scheduled');
  });

  it('does not let front desk or a coach cancel a class — that needs classes.write', async () => {
    const sessionId = await makeSession(5, 7);
    const coachActor: Actor = {
      ...actor,
      role: 'coach',
      roles: ['coach'],
      permissions: permissionsForRoles(['coach']),
    };
    expect(coachActor.permissions).not.toContain('classes.write');

    expect(actor.permissions).not.toContain('classes.write');

    for (const denied of [actor, coachActor]) {
      const result = await cancelClassSession(denied, sessionId, 'Not my call to make');
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/permission/i);
    }

    const { rows } = await owner.query<{ state: string }>('select state from class_sessions where id = $1', [sessionId]);
    expect(rows[0]!.state).toBe('scheduled');
  });

  it('shows the day’s timetable with its roster', async () => {
    const sessionId = await makeSession(8, 4);
    await book(sessionId, 'ayesha.khan@example.com', 'booked', 45);

    const { rows } = await owner.query<{ day: string }>(
      `select (starts_at at time zone 'Asia/Karachi')::date::text as day from class_sessions where id = $1`,
      [sessionId],
    );
    const schedule = await loadSchedule(actor, rows[0]!.day);

    const found = schedule.sessions.find((item) => item.sessionId === sessionId);
    expect(found).toBeDefined();
    expect(found!.bookings.some((booking) => booking.memberName === 'Ayesha Khan')).toBe(true);
    expect(schedule.totals.capacity).toBeGreaterThanOrEqual(8);
  });
});
