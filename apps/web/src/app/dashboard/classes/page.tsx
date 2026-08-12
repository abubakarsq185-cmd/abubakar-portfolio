import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { Badge, EmptyState, Notice, Panel, ProgressBar, Stat } from '@gymguide/ui';
import { requirePermission, requireStaff } from '@/server/auth/session';
import {
  cancelBooking,
  cancelClassSession,
  checkInBooking,
  loadSchedule,
  promoteFromWaitlist,
} from '@/server/services/scheduling';

export const metadata: Metadata = { title: 'Classes' };

const KARACHI = 'Asia/Karachi';
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: KARACHI, hour12: false });
const DATE_LONG = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: KARACHI,
});

/** Today in the gym's timezone, not the server's. */
function todayInKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KARACHI }).format(new Date());
}

function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Redirect back to the same day, carrying a message the page can show. */
function backTo(day: string, message: string, ok: boolean): never {
  const params = new URLSearchParams({ day, [ok ? 'done' : 'error']: message });
  redirect(`/dashboard/classes?${params.toString()}`);
}

async function checkInAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('attendance.write');
  const day = String(formData.get('day'));
  const result = await checkInBooking(actor, String(formData.get('bookingId')));
  revalidatePath('/dashboard/classes');
  backTo(day, result.message, result.ok);
}

async function cancelBookingAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('bookings.write');
  const day = String(formData.get('day'));
  const result = await cancelBooking(actor, String(formData.get('bookingId')), String(formData.get('reason') ?? ''));
  revalidatePath('/dashboard/classes');
  backTo(day, result.message, result.ok);
}

async function promoteAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('bookings.write');
  const day = String(formData.get('day'));
  const result = await promoteFromWaitlist(actor, String(formData.get('classSessionId')));
  revalidatePath('/dashboard/classes');
  backTo(day, result.message, result.ok);
}

async function cancelAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('classes.write');
  const day = String(formData.get('day'));
  const result = await cancelClassSession(
    actor,
    String(formData.get('classSessionId')),
    String(formData.get('reason') ?? ''),
  );
  revalidatePath('/dashboard/classes');
  backTo(day, result.message, result.ok);
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; done?: string; error?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requireStaff(), searchParams]);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? '') ? params.day! : todayInKarachi();
  const schedule = await loadSchedule(actor, day);

  const canCheckIn = actor.permissions.includes('attendance.write');
  const canManage = actor.permissions.includes('classes.write');
  const canBook = actor.permissions.includes('bookings.write');
  const utilisation = schedule.totals.capacity
    ? Math.round((schedule.totals.booked / schedule.totals.capacity) * 100)
    : 0;

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Classes</h1>
          <p className="small muted">{DATE_LONG.format(new Date(`${day}T12:00:00Z`))} · times shown in Pakistan Standard Time</p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={`/dashboard/classes?day=${shiftDay(day, -1)}`}>
            ← Previous
          </Link>
          <Link className="btn btn-ghost btn-sm" href="/dashboard/classes">
            Today
          </Link>
          <Link className="btn btn-ghost btn-sm" href={`/dashboard/classes?day=${shiftDay(day, 1)}`}>
            Next →
          </Link>
        </div>
      </header>

      {params.done ? <Notice tone="success">{params.done}</Notice> : null}
      {params.error ? <Notice tone="danger">{params.error}</Notice> : null}

      <section className="grid grid-4" aria-label="Day summary">
        <Stat label="Classes" value={String(schedule.totals.sessions)} />
        <Stat label="Booked" value={`${schedule.totals.booked} / ${schedule.totals.capacity}`} delta={`${utilisation}% full`} />
        <Stat label="Checked in" value={String(schedule.totals.attended)} />
        <Stat
          label="On waitlists"
          value={String(schedule.totals.waitlisted)}
          tone={schedule.totals.waitlisted > 0 ? 'warning' : 'neutral'}
        />
      </section>

      {schedule.sessions.length === 0 ? (
        <Panel title="Timetable">
          <EmptyState
            title="Nothing scheduled"
            body="No classes run on this day. Use the arrows above to look at another day."
          />
        </Panel>
      ) : (
        <div className="stack stack-4">
          {schedule.sessions.map((item) => {
            const cancelled = item.state === 'cancelled';
            const full = item.bookedCount >= item.capacity;
            return (
              <article key={item.sessionId} className="card stack stack-4">
                <div className="row-between row-wrap">
                  <div className="stack stack-2">
                    <div className="row">
                      <strong style={{ fontSize: '1.0625rem' }}>{item.className}</strong>
                      {cancelled ? <Badge tone="danger">cancelled</Badge> : null}
                      {item.womenOnly ? <Badge tone="primary">women only</Badge> : null}
                      {!cancelled && full ? <Badge tone="warning">full</Badge> : null}
                    </div>
                    <p className="small muted">
                      {TIME.format(new Date(item.startsAt))}–{TIME.format(new Date(item.endsAt))} · {item.branchName}
                      {item.roomName ? ` · ${item.roomName}` : ''} · {item.coachName ?? 'no coach assigned'}
                    </p>
                    {item.cancellationReason ? (
                      <p className="small secondary">Reason given: {item.cancellationReason}</p>
                    ) : null}
                  </div>
                  <div className="stack stack-2" style={{ minWidth: '180px' }}>
                    <div className="row-between">
                      <span className="micro muted">
                        {item.bookedCount} booked of {item.capacity}
                      </span>
                      <span className="micro muted">{item.attendedCount} in</span>
                    </div>
                    <ProgressBar
                      value={item.bookedCount}
                      max={item.capacity}
                      tone={full ? 'warning' : 'primary'}
                      label={`${item.bookedCount} of ${item.capacity} places booked`}
                    />
                    {item.waitlistCount > 0 ? (
                      <span className="micro muted">{item.waitlistCount} waiting</span>
                    ) : null}
                  </div>
                </div>

                {cancelled ? null : (
                  <>
                    {item.bookings.length === 0 ? (
                      <p className="small muted">Nobody has booked this class yet.</p>
                    ) : (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th scope="col">Member</th>
                              <th scope="col">Status</th>
                              {canCheckIn || canBook ? <th scope="col" /> : null}
                            </tr>
                          </thead>
                          <tbody>
                            {item.bookings.map((booking) => (
                              <tr key={booking.bookingId}>
                                <th scope="row">
                                  <Link href={`/dashboard/members/${booking.userId}`}>{booking.memberName}</Link>
                                </th>
                                <td>
                                  <Badge
                                    tone={
                                      booking.state === 'attended'
                                        ? 'success'
                                        : booking.state === 'waitlisted'
                                          ? 'warning'
                                          : booking.state === 'booked'
                                            ? 'neutral'
                                            : 'danger'
                                    }
                                  >
                                    {booking.state.replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                                {canCheckIn || canBook ? (
                                  <td className="num">
                                    {booking.state === 'booked' || booking.state === 'waitlisted' ? (
                                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                                        {canCheckIn ? (
                                          <form action={checkInAction}>
                                            <input type="hidden" name="bookingId" value={booking.bookingId} />
                                            <input type="hidden" name="day" value={day} />
                                            <button className="btn btn-secondary btn-sm" type="submit">
                                              Check in
                                            </button>
                                          </form>
                                        ) : null}
                                        {canBook ? (
                                          <form action={cancelBookingAction}>
                                            <input type="hidden" name="bookingId" value={booking.bookingId} />
                                            <input type="hidden" name="day" value={day} />
                                            <input type="hidden" name="reason" value="Cancelled at the front desk" />
                                            <button className="btn btn-ghost btn-sm" type="submit">
                                              Cancel place
                                            </button>
                                          </form>
                                        ) : null}
                                      </div>
                                    ) : booking.checkedInAt ? (
                                      <span className="micro muted">{TIME.format(new Date(booking.checkedInAt))}</span>
                                    ) : (
                                      <span className="micro muted">—</span>
                                    )}
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="row row-wrap">
                      {canBook && item.waitlistCount > 0 && !full ? (
                        <form action={promoteAction}>
                          <input type="hidden" name="classSessionId" value={item.sessionId} />
                          <input type="hidden" name="day" value={day} />
                          <button className="btn btn-secondary btn-sm" type="submit">
                            Promote next from waitlist
                          </button>
                        </form>
                      ) : null}
                    </div>

                    {canManage ? (
                      <details className="disclosure">
                        <summary className="small">Cancel this class</summary>
                        <form action={cancelAction} className="stack stack-3" style={{ marginTop: '0.75rem' }}>
                          <input type="hidden" name="classSessionId" value={item.sessionId} />
                          <input type="hidden" name="day" value={day} />
                          <label className="label" htmlFor={`reason-${item.sessionId}`}>
                            Reason shown to booked members
                          </label>
                          <input
                            id={`reason-${item.sessionId}`}
                            className="input"
                            name="reason"
                            required
                            minLength={5}
                            placeholder="Coach unwell — class runs as normal next week"
                          />
                          <p className="micro muted">
                            Everyone booked or waitlisted is released and no credits are charged. The cancellation is
                            audited.
                          </p>
                          <button className="btn btn-danger btn-sm" type="submit" style={{ alignSelf: 'flex-start' }}>
                            Cancel class
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
