import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { EXPERIENCE_LABELS, GOAL_LABELS, type ExperienceLevel, type TrainingGoal } from '@gymguide/types';
import { Badge, EmptyState, Notice, Panel, SafetyBanner } from '@gymguide/ui';
import { requirePermission, requireStaff } from '@/server/auth/session';
import {
  PROGRESSION_RULES,
  PROGRESSION_RULE_LABELS,
  loadProgram,
  setProgramPublishState,
  updatePhase,
  updateProgram,
  type ProgressionRule,
} from '@/server/services/programs';

export const metadata: Metadata = { title: 'Program' };

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function backTo(programId: string, message: string, ok: boolean): never {
  redirect(`/dashboard/programs/${programId}?${ok ? 'done' : 'error'}=${encodeURIComponent(message)}`);
}

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

async function saveProgramAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('content.write');
  const programId = String(formData.get('programId'));
  const result = await updateProgram(actor, programId, {
    name: String(formData.get('name') ?? ''),
    summary: String(formData.get('summary') ?? ''),
    daysPerWeek: Number(formData.get('daysPerWeek') ?? 3),
    sessionMinutes: Number(formData.get('sessionMinutes') ?? 45),
    requiresEquipmentCodes: csv(formData.get('requiresEquipmentCodes')),
    lowImpact: formData.get('lowImpact') === 'on',
    ramadanFriendly: formData.get('ramadanFriendly') === 'on',
    contraindications: csv(formData.get('contraindications')),
  });
  revalidatePath(`/dashboard/programs/${programId}`);
  backTo(programId, result.message, result.ok);
}

async function savePhaseAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('content.write');
  const programId = String(formData.get('programId'));
  const result = await updatePhase(actor, String(formData.get('phaseId')), {
    name: String(formData.get('name') ?? ''),
    focus: String(formData.get('focus') ?? ''),
    weeks: Number(formData.get('weeks') ?? 4),
    progressionRule: String(formData.get('progressionRule')) as ProgressionRule,
    deloadAtEnd: formData.get('deloadAtEnd') === 'on',
    memberSummary: String(formData.get('memberSummary') ?? ''),
  });
  revalidatePath(`/dashboard/programs/${programId}`);
  backTo(programId, result.message, result.ok);
}

async function publishAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('content.write');
  const programId = String(formData.get('programId'));
  const result = await setProgramPublishState(actor, programId, formData.get('publish') === 'yes');
  revalidatePath(`/dashboard/programs/${programId}`);
  revalidatePath('/dashboard/programs');
  backTo(programId, result.message, result.ok);
}

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const [{ actor }, { programId }, query] = await Promise.all([requireStaff(), params, searchParams]);
  const program = await loadProgram(actor, programId);
  if (!program) notFound();

  const canAuthor = actor.permissions.includes('content.write') && program.editable;
  const published = program.publishState === 'published';

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <Link className="micro muted" href="/dashboard/programs">
            ← All programs
          </Link>
          <div className="row">
            <h1 style={{ fontSize: '1.75rem' }}>{program.name}</h1>
            <Badge tone={published ? 'success' : 'warning'}>{program.publishState.replace(/_/g, ' ')}</Badge>
            {program.isPlatform ? <Badge>GymGuide template</Badge> : null}
          </div>
          <p className="small muted">
            {GOAL_LABELS[program.goal as TrainingGoal] ?? program.goal} ·{' '}
            {EXPERIENCE_LABELS[program.experienceLevel as ExperienceLevel] ?? program.experienceLevel} ·{' '}
            {program.daysPerWeek} days a week · {program.sessionMinutes} minutes · {program.totalWeeks} weeks
            {program.version !== null ? ` · version ${program.version}` : ''}
            {program.derivedFromName ? ` · copied from “${program.derivedFromName}”` : ''}
          </p>
        </div>
      </header>

      {query.done ? <Notice tone="success">{query.done}</Notice> : null}
      {query.error ? <Notice tone="danger">{query.error}</Notice> : null}

      {program.isPlatform ? (
        <Notice tone="info">
          This is a GymGuide template, shared by every gym on the platform, so it is read-only here. Take a copy from
          the programs list and adapt that — the copy records what it came from.
        </Notice>
      ) : null}

      {program.missingEquipment.length > 0 ? (
        <SafetyBanner tone="warning" title="Your gym does not have everything this program needs">
          Missing: {program.missingEquipment.join(', ')}. The matcher treats missing equipment as close to
          disqualifying, so members will be handed to a coach rather than matched to this. Either remove the
          requirement or record the equipment against a branch.
        </SafetyBanner>
      ) : null}

      <div className="grid grid-2">
        <Panel title="What it is for">
          <div className="stack stack-3">
            <p className="small secondary">{program.summary}</p>
            <div className="row row-wrap">
              {program.lowImpact ? <Badge tone="primary">low impact</Badge> : null}
              {program.ramadanFriendly ? <Badge tone="primary">Ramadan friendly</Badge> : null}
              <Badge>{program.intent.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="stack stack-2">
              <span className="micro muted">
                Needs: {program.requiresEquipmentCodes.join(', ') || 'nothing in particular'}
              </span>
              {program.contraindications.length > 0 ? (
                <span className="micro muted">Not for: {program.contraindications.join(', ')}</span>
              ) : null}
              <span className="micro muted">{program.membersOnIt} member(s) on it right now</span>
              {program.approvedByName ? (
                <span className="micro muted">
                  Approved by {program.approvedByName}
                  {program.approvedAt ? ` on ${program.approvedAt.slice(0, 10)}` : ''}
                </span>
              ) : null}
            </div>
          </div>
        </Panel>

        {canAuthor ? (
          <Panel title={published ? 'Withdraw from the library' : 'Publish'}>
            <form action={publishAction} className="stack stack-3">
              <input type="hidden" name="programId" value={program.programId} />
              <input type="hidden" name="publish" value={published ? 'no' : 'yes'} />
              <p className="small secondary">
                {published
                  ? 'Withdrawing stops new members being matched to this. Anyone already on it keeps their plan — pulling it out mid-block would be worse than letting the block finish.'
                  : 'Publishing puts your name on it as the approver and makes it available to the matcher and to coaches. A program with no phases or no training days cannot be published.'}
              </p>
              <button className={published ? 'btn btn-ghost' : 'btn btn-primary'} type="submit" style={{ alignSelf: 'flex-start' }}>
                {published ? 'Withdraw' : 'Approve and publish'}
              </button>
            </form>
          </Panel>
        ) : null}
      </div>

      {canAuthor ? (
        <Panel title="Edit the program">
          <form action={saveProgramAction} className="stack stack-4">
            <input type="hidden" name="programId" value={program.programId} />

            <label className="stack stack-2">
              <span className="label">Name</span>
              <input className="input" name="name" defaultValue={program.name} required minLength={3} />
            </label>

            <label className="stack stack-2">
              <span className="label">Summary shown to members</span>
              <textarea className="textarea" name="summary" rows={3} required minLength={20} defaultValue={program.summary} />
              <span className="hint">Plain language. This is what a member reads before they start.</span>
            </label>

            <div className="grid grid-2">
              <label className="stack stack-2">
                <span className="label">Days a week</span>
                <input
                  className="input"
                  type="number"
                  name="daysPerWeek"
                  min="1"
                  max="7"
                  defaultValue={program.daysPerWeek}
                  required
                />
              </label>
              <label className="stack stack-2">
                <span className="label">Minutes per session</span>
                <input
                  className="input"
                  type="number"
                  name="sessionMinutes"
                  min="15"
                  max="180"
                  step="5"
                  defaultValue={program.sessionMinutes}
                  required
                />
              </label>
            </div>

            <label className="stack stack-2">
              <span className="label">Equipment needed</span>
              <input
                className="input"
                name="requiresEquipmentCodes"
                defaultValue={program.requiresEquipmentCodes.join(', ')}
                placeholder="dumbbell, cable, bench"
              />
              <span className="hint">
                Comma separated. Ask for less rather than more — a program requiring a rack excludes every member at a
                branch without one.
              </span>
            </label>

            <label className="stack stack-2">
              <span className="label">Not suitable for</span>
              <input
                className="input"
                name="contraindications"
                defaultValue={program.contraindications.join(', ')}
                placeholder="back_problem, heart_condition"
              />
              <span className="hint">
                Comma separated condition codes. The matcher treats these as disqualifying, not as a warning.
              </span>
            </label>

            <label className="checkbox-row">
              <input type="checkbox" name="lowImpact" defaultChecked={program.lowImpact} />
              <span>
                <strong className="small">Low impact</strong>
                <span className="hint">No jumping or running. Required for members who asked for it.</span>
              </span>
            </label>

            <label className="checkbox-row">
              <input type="checkbox" name="ramadanFriendly" defaultChecked={program.ramadanFriendly} />
              <span>
                <strong className="small">Works while fasting</strong>
                <span className="hint">Shorter sessions, lower volume, suitable after iftar.</span>
              </span>
            </label>

            <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
              Save program
            </button>
          </form>
        </Panel>
      ) : null}

      <Panel title={`Phases${program.phases.length ? ` — ${program.phases.length}` : ''}`}>
        {program.phases.length === 0 ? (
          <EmptyState
            title="No phases yet"
            body="A program needs at least one phase with training days before it can be published — otherwise a member would be matched to nothing."
          />
        ) : (
          <div className="stack stack-5">
            {program.phases.map((phase) => {
              const pattern = phase.days.filter((day) => day.weekNumber === 1);
              return (
                <article key={phase.phaseId} className="card stack stack-4">
                  <div className="row-between row-wrap">
                    <div className="stack stack-2">
                      <div className="row">
                        <strong>{phase.name}</strong>
                        <Badge>{phase.weeks} weeks</Badge>
                        {phase.deloadAtEnd ? <Badge tone="primary">deload at end</Badge> : null}
                      </div>
                      <span className="micro muted">{phase.focus}</span>
                    </div>
                    <span className="micro muted">
                      {PROGRESSION_RULE_LABELS[phase.progressionRule as ProgressionRule] ?? phase.progressionRule}
                    </span>
                  </div>

                  {phase.memberSummary ? <p className="small secondary">{phase.memberSummary}</p> : null}

                  <div className="row row-wrap">
                    {DAY_NAMES.map((label, index) => {
                      const day = pattern.find((entry) => entry.dayNumber === index + 1);
                      const training = day && !day.isRestDay && day.workoutName;
                      return (
                        <div
                          key={label}
                          className="stack stack-2"
                          style={{ minWidth: '7.5rem', gap: '0.25rem' }}
                        >
                          <span className="micro muted">{label}</span>
                          {training ? (
                            <Badge tone="primary">{day!.workoutName}</Badge>
                          ) : (
                            <span className="micro muted">rest</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canAuthor ? (
                    <details className="disclosure">
                      <summary className="small">Edit this phase</summary>
                      <form action={savePhaseAction} className="stack stack-3" style={{ marginTop: '0.75rem' }}>
                        <input type="hidden" name="programId" value={program.programId} />
                        <input type="hidden" name="phaseId" value={phase.phaseId} />

                        <div className="grid grid-2">
                          <label className="stack stack-2">
                            <span className="label">Phase name</span>
                            <input className="input" name="name" defaultValue={phase.name} required />
                          </label>
                          <label className="stack stack-2">
                            <span className="label">Focus</span>
                            <input className="input" name="focus" defaultValue={phase.focus} required />
                          </label>
                        </div>

                        <div className="grid grid-2">
                          <label className="stack stack-2">
                            <span className="label">Weeks</span>
                            <input
                              className="input"
                              type="number"
                              name="weeks"
                              min="1"
                              max="26"
                              defaultValue={phase.weeks}
                              required
                            />
                          </label>
                          <label className="stack stack-2">
                            <span className="label">How weights move</span>
                            <select className="select" name="progressionRule" defaultValue={phase.progressionRule}>
                              {PROGRESSION_RULES.map((rule) => (
                                <option key={rule} value={rule}>
                                  {PROGRESSION_RULE_LABELS[rule]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="stack stack-2">
                          <span className="label">What the member is told about this phase</span>
                          <textarea
                            className="textarea"
                            name="memberSummary"
                            rows={2}
                            defaultValue={phase.memberSummary ?? ''}
                            placeholder="Four weeks getting the movements right. We add reps before weight, so nothing ever jumps."
                          />
                        </label>

                        <label className="checkbox-row">
                          <input type="checkbox" name="deloadAtEnd" defaultChecked={phase.deloadAtEnd} />
                          <span>
                            <strong className="small">Deload at the end of this phase</strong>
                            <span className="hint">A lighter week before the next block.</span>
                          </span>
                        </label>

                        <button className="btn btn-primary btn-sm" type="submit" style={{ alignSelf: 'flex-start' }}>
                          Save phase
                        </button>
                      </form>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <p className="micro muted">
        The coaching engine applies each phase&rsquo;s progression rule; it does not invent exercises. Every automatic
        change it makes records the rule and the before and after values, which members see on their Plan screen.
      </p>
    </div>
  );
}
