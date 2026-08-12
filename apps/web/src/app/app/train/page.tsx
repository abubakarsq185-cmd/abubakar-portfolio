import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, EmptyState } from '@gymguide/ui';
import { formatDate } from '@gymguide/config';
import { requireMember, tenantSessionFor } from '@/server/auth/session';
import { withTenant } from '@/server/db/pool';

export const metadata: Metadata = { title: 'Train' };

export default async function TrainPage() {
  const { actor } = await requireMember();

  const sessions = await withTenant(tenantSessionFor(actor), async (db) => {
    const { rows } = await db.query<{
      id: string; title: string; scheduled_for: string; state: string;
      completed_sets: number; prescribed_sets: number; total_volume_kg: string;
    }>(
      `select id, title, scheduled_for, state, completed_sets, prescribed_sets, total_volume_kg
         from workout_sessions
        where user_id = $1 and scheduled_for between current_date - 14 and current_date + 14
        order by scheduled_for desc`,
      [actor.userId],
    );
    return rows;
  });

  const upcoming = sessions.filter((s) => s.state === 'scheduled' || s.state === 'in_progress');
  const past = sessions.filter((s) => s.state === 'completed' || s.state === 'skipped');

  return (
    <div className="stack stack-6 fade-up">
      <h1 style={{ fontSize: '1.5rem' }}>Train</h1>

      <section className="stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>Coming up</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing scheduled" body="Your coach will assign your next block shortly." />
        ) : (
          upcoming.map((session) => (
            <Link key={session.id} href={`/app/train/${session.id}`} className="card card-hover row-between">
              <div className="stack" style={{ gap: '0.125rem' }}>
                <strong>{session.title}</strong>
                <span className="micro muted">
                  {formatDate(session.scheduled_for, 'en', 'Asia/Karachi', 'weekday')} · {session.prescribed_sets} sets
                </span>
              </div>
              <Badge tone={session.state === 'in_progress' ? 'warning' : 'primary'}>
                {session.state === 'in_progress' ? 'Resume' : 'Start'}
              </Badge>
            </Link>
          ))
        )}
      </section>

      <section className="stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>Recent sessions</h2>
        {past.length === 0 ? (
          <EmptyState title="No history yet" body="Your completed sessions will show here with volume and records." />
        ) : (
          past.slice(0, 12).map((session) => (
            <article key={session.id} className="card row-between">
              <div className="stack" style={{ gap: '0.125rem' }}>
                <strong className="small">{session.title}</strong>
                <span className="micro muted">
                  {formatDate(session.scheduled_for)} ·{' '}
                  {session.state === 'completed'
                    ? `${session.completed_sets} sets · ${Math.round(Number(session.total_volume_kg)).toLocaleString('en-PK')} kg`
                    : 'Missed'}
                </span>
              </div>
              <Badge tone={session.state === 'completed' ? 'success' : 'neutral'}>
                {session.state === 'completed' ? 'Done' : 'Missed'}
              </Badge>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
