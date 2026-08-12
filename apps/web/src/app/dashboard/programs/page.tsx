import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { EXPERIENCE_LABELS, GOAL_LABELS, type ExperienceLevel, type TrainingGoal } from '@gymguide/types';
import { Badge, EmptyState, Notice, Panel } from '@gymguide/ui';
import { requirePermission, requireStaff } from '@/server/auth/session';
import { copyProgramToGym, listPrograms } from '@/server/services/programs';

export const metadata: Metadata = { title: 'Programs' };

async function copyAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('content.write');
  const result = await copyProgramToGym(actor, String(formData.get('programId')));
  revalidatePath('/dashboard/programs');
  redirect(
    result.ok && result.programId
      ? `/dashboard/programs/${result.programId}?done=${encodeURIComponent(result.message)}`
      : `/dashboard/programs?error=${encodeURIComponent(result.message)}`,
  );
}

const STATE_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
  published: 'success',
  draft: 'warning',
  in_review: 'warning',
  archived: 'neutral',
};

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requireStaff(), searchParams]);
  const programs = await listPrograms(actor);
  const canAuthor = actor.permissions.includes('content.write');

  const platform = programs.filter((program) => program.isPlatform);
  const gym = programs.filter((program) => !program.isPlatform);

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Programs</h1>
          <p className="small muted">
            The only source of member workouts. Nothing outside this library can be assigned, by the engine or by a
            coach.
          </p>
        </div>
      </header>

      {params.done ? <Notice tone="success">{params.done}</Notice> : null}
      {params.error ? <Notice tone="danger">{params.error}</Notice> : null}

      <Panel title={`This gym’s programs${gym.length ? ` — ${gym.length}` : ''}`} flush>
        {gym.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title="No programs of your own yet"
              body="Take a copy of a platform template below and adapt it. Copies start as drafts — nobody is put on one until you publish it."
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Program</th>
                  <th scope="col">For</th>
                  <th scope="col" className="num">
                    Days
                  </th>
                  <th scope="col" className="num">
                    Weeks
                  </th>
                  <th scope="col" className="num">
                    Members on it
                  </th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {gym.map((program) => (
                  <tr key={program.programId}>
                    <th scope="row">
                      <Link href={`/dashboard/programs/${program.programId}`}>{program.name}</Link>
                      <span className="stack" style={{ gap: 0 }}>
                        <span className="micro muted">{program.summary.slice(0, 90)}…</span>
                      </span>
                    </th>
                    <td className="small">
                      {GOAL_LABELS[program.goal as TrainingGoal] ?? program.goal}
                      <span className="micro muted">
                        {' '}
                        · {EXPERIENCE_LABELS[program.experienceLevel as ExperienceLevel] ?? program.experienceLevel}
                      </span>
                    </td>
                    <td className="num">{program.daysPerWeek}</td>
                    <td className="num">{program.totalWeeks}</td>
                    <td className="num">{program.membersOnIt}</td>
                    <td>
                      <Badge tone={STATE_TONE[program.publishState] ?? 'neutral'}>
                        {program.publishState.replace(/_/g, ' ')}
                      </Badge>
                      {program.approvedByName ? (
                        <span className="micro muted"> approved by {program.approvedByName}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`GymGuide templates — ${platform.length}`} flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Template</th>
                <th scope="col">For</th>
                <th scope="col" className="num">
                  Days
                </th>
                <th scope="col">Needs</th>
                <th scope="col" className="num">
                  Members on it
                </th>
                {canAuthor ? <th scope="col" /> : null}
              </tr>
            </thead>
            <tbody>
              {platform.map((program) => (
                <tr key={program.programId}>
                  <th scope="row">
                    <Link href={`/dashboard/programs/${program.programId}`}>{program.name}</Link>
                    <span className="stack" style={{ gap: 0 }}>
                      <span className="micro muted">
                        {program.lowImpact ? 'low impact · ' : ''}
                        {program.ramadanFriendly ? 'Ramadan friendly · ' : ''}
                        {program.sessionMinutes} min sessions
                      </span>
                    </span>
                  </th>
                  <td className="small">
                    {GOAL_LABELS[program.goal as TrainingGoal] ?? program.goal}
                    <span className="micro muted">
                      {' '}
                      · {EXPERIENCE_LABELS[program.experienceLevel as ExperienceLevel] ?? program.experienceLevel}
                    </span>
                  </td>
                  <td className="num">{program.daysPerWeek}</td>
                  <td className="micro muted">{program.requiresEquipmentCodes.join(', ') || 'nothing special'}</td>
                  <td className="num">{program.membersOnIt}</td>
                  {canAuthor ? (
                    <td className="num">
                      {program.alreadyCopied ? (
                        <span className="micro muted">copied</span>
                      ) : (
                        <form action={copyAction}>
                          <input type="hidden" name="programId" value={program.programId} />
                          <button className="btn btn-secondary btn-sm" type="submit">
                            Copy &amp; adapt
                          </button>
                        </form>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="micro muted">
        GymGuide templates are read-only: editing one here would change what every other gym is running. Take a copy and
        the copy records what it came from.
      </p>
    </div>
  );
}
