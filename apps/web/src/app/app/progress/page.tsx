import type { Metadata } from 'next';
import { BarChart, EmptyState, LineChart, ProgressRing } from '@gymguide/ui';
import { formatDate } from '@gymguide/config';
import { computeAdherence, computeStreak } from '@gymguide/domain';
import { requireMember, tenantSessionFor } from '@/server/auth/session';
import { withTenant } from '@/server/db/pool';

export const metadata: Metadata = { title: 'Progress' };

export default async function ProgressPage() {
  const { actor } = await requireMember();

  const data = await withTenant(tenantSessionFor(actor), async (db) => {
    const [sessions, weights, volume, records, habits, goal] = await Promise.all([
      db.query<{ scheduled_for: string; state: string; completed_sets: number; prescribed_sets: number; total_volume_kg: string }>(
        `select scheduled_for, state, completed_sets, prescribed_sets, total_volume_kg
           from workout_sessions where user_id = $1 and scheduled_for >= current_date - 84
          order by scheduled_for asc`,
        [actor.userId],
      ),
      db.query<{ measured_on: string; value: string }>(
        `select ml.measured_on, ml.value
           from metric_logs ml join metric_definitions md on md.id = ml.metric_definition_id
          where ml.user_id = $1 and md.key = 'body_weight'
          order by ml.measured_on asc`,
        [actor.userId],
      ),
      db.query<{ week: string; volume: string }>(
        `select to_char(date_trunc('week', scheduled_for), 'DD Mon') as week,
                coalesce(sum(total_volume_kg), 0)::text as volume
           from workout_sessions
          where user_id = $1 and state = 'completed' and scheduled_for >= current_date - 84
          group by date_trunc('week', scheduled_for)
          order by date_trunc('week', scheduled_for)`,
        [actor.userId],
      ),
      db.query<{ name: string; record_kind: string; value: string; unit: string; achieved_at: string }>(
        `select e.name, pr.record_kind, pr.value, pr.unit, pr.achieved_at
           from personal_records pr join exercises e on e.id = pr.exercise_id
          where pr.user_id = $1 order by pr.achieved_at desc limit 6`,
        [actor.userId],
      ),
      db.query<{ key: string; label: string; target_value: string; unit: string; logged: string }>(
        `select h.key, h.label, h.target_value, h.unit,
                (select count(*) from habit_logs hl
                  where hl.habit_id = h.id and hl.completed and hl.logged_on >= current_date - 7) as logged
           from habits h where h.user_id = $1 and h.is_active order by h.key`,
        [actor.userId],
      ),
      db.query<{ headline: string; start_value: string | null; current_value: string | null; target_value: string | null; unit: string | null }>(
        `select headline, start_value, current_value, target_value, unit
           from goals where user_id = $1 and state = 'active' limit 1`,
        [actor.userId],
      ),
    ]);
    return {
      sessions: sessions.rows,
      weights: weights.rows,
      volume: volume.rows,
      records: records.rows,
      habits: habits.rows,
      goal: goal.rows[0] ?? null,
    };
  });

  const outcomes = data.sessions.map((row) => ({
    scheduledFor: row.scheduled_for,
    state: row.state as 'completed',
    completedSets: row.completed_sets,
    prescribedSets: row.prescribed_sets,
    totalVolumeKg: Number(row.total_volume_kg),
  }));
  const adherence = computeAdherence(outcomes);
  const streak = computeStreak(outcomes);
  const latestWeight = data.weights[data.weights.length - 1];
  const firstWeight = data.weights[0];

  return (
    <div className="stack stack-6 fade-up">
      <h1 style={{ fontSize: '1.5rem' }}>Progress</h1>

      <section className="card stack stack-4" style={{ alignItems: 'center' }}>
        <ProgressRing value={adherence.adherencePercent} caption="4 weeks" label="Adherence" size={148} />
        <p className="secondary" style={{ textAlign: 'center' }}>
          {adherence.message}
        </p>
        <div className="row" style={{ gap: '2rem' }}>
          <div className="stat" style={{ alignItems: 'center' }}>
            <span className="stat-label">Streak</span>
            <span className="stat-value">{streak.current}</span>
          </div>
          <div className="stat" style={{ alignItems: 'center' }}>
            <span className="stat-label">Best</span>
            <span className="stat-value">{streak.best}</span>
          </div>
          <div className="stat" style={{ alignItems: 'center' }}>
            <span className="stat-label">Completed</span>
            <span className="stat-value">{adherence.completed}</span>
          </div>
        </div>
      </section>

      {data.goal ? (
        <section className="card stack stack-3">
          <span className="eyebrow">Your goal</span>
          <strong>{data.goal.headline}</strong>
          {data.goal.start_value && data.goal.target_value ? (
            <p className="small secondary">
              Started at {data.goal.start_value} {data.goal.unit} · now {latestWeight?.value ?? data.goal.current_value}{' '}
              {data.goal.unit} · target {data.goal.target_value} {data.goal.unit}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>Weight</h2>
        {data.weights.length >= 2 ? (
          <>
            <LineChart
              ariaLabel="Body weight over time"
              valueSuffix=" kg"
              data={data.weights.map((row) => ({
                label: formatDate(row.measured_on, 'en', 'Asia/Karachi', 'short'),
                value: Number(row.value),
              }))}
            />
            <p className="small secondary">
              {firstWeight && latestWeight
                ? `${Number(firstWeight.value).toFixed(1)} kg → ${Number(latestWeight.value).toFixed(1)} kg over ${data.weights.length} weigh-ins. Week to week movement is normal; the direction over months is what matters.`
                : null}
            </p>
          </>
        ) : (
          <EmptyState title="No weigh-ins yet" body="Log your weight weekly and the trend appears here." />
        )}
      </section>

      <section className="card stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>Weekly training volume</h2>
        <BarChart
          ariaLabel="Total weight lifted per week"
          data={data.volume.map((row) => ({ label: row.week, value: Math.round(Number(row.volume)) }))}
        />
        <p className="micro muted">Total kilograms lifted each week — sets × reps × weight.</p>
      </section>

      <section className="stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>Habits this week</h2>
        <div className="grid grid-2">
          {data.habits.map((habit) => (
            <article key={habit.key} className="card stack stack-2">
              <strong className="small">{habit.label}</strong>
              <div className="progress-track">
                <div
                  className="progress-fill success"
                  style={{ width: `${Math.min(100, (Number(habit.logged) / 7) * 100)}%` }}
                />
              </div>
              <span className="micro muted">{habit.logged} of 7 days</span>
            </article>
          ))}
        </div>
      </section>

      {data.records.length > 0 ? (
        <section className="stack stack-3">
          <h2 style={{ fontSize: '1.0625rem' }}>Personal records</h2>
          {data.records.map((record, index) => (
            <article key={`${record.name}-${index}`} className="card row-between">
              <div className="stack" style={{ gap: '0.125rem' }}>
                <strong className="small">{record.name}</strong>
                <span className="micro muted">
                  {record.record_kind.replace(/_/g, ' ')} · {formatDate(record.achieved_at)}
                </span>
              </div>
              <span className="numeric" style={{ fontWeight: 700 }}>
                {Number(record.value).toFixed(1)} {record.unit}
              </span>
            </article>
          ))}
        </section>
      ) : null}

      <p className="micro muted" style={{ textAlign: 'center' }}>
        Progress is not linear and these numbers will not move every week. Showing up is the part you control.
      </p>
    </div>
  );
}
