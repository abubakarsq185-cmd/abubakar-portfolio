import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, EmptyState, SafetyBanner } from '@gymguide/ui';
import { formatDate } from '@gymguide/config';
import { requireMember, tenantSessionFor } from '@/server/auth/session';
import { withTenant } from '@/server/db/pool';

export const metadata: Metadata = { title: 'Plan' };

export default async function PlanPage() {
  const { actor } = await requireMember();

  const data = await withTenant(tenantSessionFor(actor), async (db) => {
    const assignment = await db.query<{
      program_name: string; summary: string; total_weeks: number; days_per_week: number;
      session_minutes: number; current_week: number; starts_on: string; assignment_source: string;
      progression_locked: boolean; progression_lock_reason: string | null; program_version_id: string;
    }>(
      `select p.name as program_name, p.summary, p.total_weeks, p.days_per_week, p.session_minutes,
              pa.current_week, pa.starts_on, pa.assignment_source, pa.progression_locked,
              pa.progression_lock_reason, pa.program_version_id
         from program_assignments pa join programs p on p.id = pa.program_id
        where pa.user_id = $1 and pa.state = 'active' limit 1`,
      [actor.userId],
    );

    if (!assignment.rows[0]) return { assignment: null, phases: [], week: [], changes: [] };

    const [phases, week, changes] = await Promise.all([
      db.query<{ name: string; focus: string; weeks: number; member_summary: string | null; position: number }>(
        `select name, focus, weeks, member_summary, position from program_phases
          where program_version_id = $1 order by position`,
        [assignment.rows[0].program_version_id],
      ),
      db.query<{ id: string; title: string; scheduled_for: string; state: string; day_number: number | null }>(
        `select id, title, scheduled_for, state, day_number from workout_sessions
          where user_id = $1
            and scheduled_for between date_trunc('week', current_date)::date
                                  and date_trunc('week', current_date)::date + 6
          order by scheduled_for`,
        [actor.userId],
      ),
      db.query<{ rationale: string; kind: string; created_at: string; state: string }>(
        `select rationale, kind, created_at, state from coaching_recommendations
          where user_id = $1 and state in ('auto_applied','approved')
          order by created_at desc limit 5`,
        [actor.userId],
      ),
    ]);

    return {
      assignment: assignment.rows[0],
      phases: phases.rows,
      week: week.rows,
      changes: changes.rows,
    };
  });

  if (!data.assignment) {
    return (
      <div className="stack stack-6 fade-up">
        <h1 style={{ fontSize: '1.5rem' }}>Your plan</h1>
        <EmptyState
          title="No plan assigned yet"
          body="A coach will assign your program shortly. If you have just joined, finishing your setup helps them pick the right one."
        />
      </div>
    );
  }

  const plan = data.assignment;

  return (
    <div className="stack stack-6 fade-up">
      <header className="stack stack-2">
        <h1 style={{ fontSize: '1.5rem' }}>Your plan</h1>
        <p className="small muted">
          {plan.assignment_source === 'coach' ? 'Chosen by your coach' : 'Matched to your goal and this branch'} ·
          started {formatDate(plan.starts_on)}
        </p>
      </header>

      {plan.progression_locked ? (
        <SafetyBanner tone="warning" title="Weights are staying where they are">
          {plan.progression_lock_reason ?? 'A coach is reviewing your plan.'} Nothing is wrong with a steady week — the
          plan will start moving again once they have spoken to you.
        </SafetyBanner>
      ) : null}

      <section className="card card-accent stack stack-3">
        <div className="row-between">
          <h2 style={{ fontSize: '1.25rem' }}>{plan.program_name}</h2>
          <Badge tone="primary">
            Week {plan.current_week} of {plan.total_weeks}
          </Badge>
        </div>
        <p className="secondary">{plan.summary}</p>
        <p className="micro muted">
          {plan.days_per_week} sessions a week · about {plan.session_minutes} minutes each
        </p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, (plan.current_week / plan.total_weeks) * 100)}%` }} />
        </div>
      </section>

      <section className="stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>This week</h2>
        {data.week.length === 0 ? (
          <EmptyState title="Nothing scheduled this week" body="Your next block starts shortly." />
        ) : (
          data.week.map((session) => (
            <article key={session.id} className="card row-between">
              <div className="stack" style={{ gap: '0.125rem' }}>
                <strong className="small">{session.title}</strong>
                <span className="micro muted">
                  {formatDate(session.scheduled_for, 'en', 'Asia/Karachi', 'weekday')}
                </span>
              </div>
              <Badge
                tone={
                  session.state === 'completed' ? 'success' : session.state === 'skipped' ? 'neutral' : 'primary'
                }
              >
                {session.state === 'completed' ? 'Done' : session.state === 'skipped' ? 'Missed' : 'To do'}
              </Badge>
            </article>
          ))
        )}
      </section>

      <section className="stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>How the plan is structured</h2>
        {data.phases.map((phase) => (
          <article
            key={phase.position}
            className={phase.position === 1 ? 'card card-accent stack stack-2' : 'card stack stack-2'}
          >
            <div className="row-between">
              <strong className="small">
                Phase {phase.position} · {phase.name}
              </strong>
              <span className="micro muted">{phase.weeks} weeks</span>
            </div>
            <p className="small secondary">{phase.member_summary ?? phase.focus}</p>
          </article>
        ))}
      </section>

      {data.changes.length > 0 ? (
        <section className="stack stack-3">
          <h2 style={{ fontSize: '1.0625rem' }}>Why your plan changed</h2>
          {data.changes.map((change, index) => (
            <article key={index} className="card stack stack-2">
              <div className="row-between">
                <strong className="small">{change.kind.replace(/_/g, ' ')}</strong>
                <span className="micro muted">{formatDate(change.created_at)}</span>
              </div>
              <p className="small secondary">{change.rationale}</p>
            </article>
          ))}
          <p className="micro muted">
            Every automatic change records the rule that made it. A coach can override any of them.
          </p>
        </section>
      ) : null}

      <article className="card card-hover row-between">
        <div className="stack" style={{ gap: '0.125rem', minWidth: 0 }}>
          <strong className="small">Eating alongside this plan</strong>
          <span className="micro muted">Portion guidance and, if your gym has set them, calorie and macro targets.</span>
        </div>
        <Link className="btn btn-secondary btn-sm" href="/app/nutrition">
          Open nutrition
        </Link>
      </article>
    </div>
  );
}
