import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { ROLE_LABELS, type NotificationChannel, type RoleCode } from '@gymguide/types';
import { Badge, EmptyState, Notice, Panel, SafetyBanner, Stat } from '@gymguide/ui';
import { requirePermission, requireStaff } from '@/server/auth/session';
import { availableNotificationChannels } from '@/server/adapters/notifications';
import {
  MAX_PER_MEMBER_PER_WEEK_CAP,
  TRIGGER_LABELS,
  listAutomations,
  loadAutomationActivity,
  setAutomationActive,
  updateAutomation,
  type TriggerKind,
} from '@/server/services/automations';

export const metadata: Metadata = { title: 'Automations' };

const DATETIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Karachi',
  hour12: false,
});

const ASSIGNABLE_ROLES: RoleCode[] = ['gym_owner', 'branch_manager', 'coach', 'front_desk', 'nutrition_professional'];

function back(message: string, ok: boolean): never {
  redirect(`/dashboard/automations?${ok ? 'done' : 'error'}=${encodeURIComponent(message)}`);
}

async function saveAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('automations.write');
  const role = String(formData.get('taskAssigneeRole') ?? '');
  const result = await updateAutomation(actor, String(formData.get('automationId')), {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    channels: formData.getAll('channels').map(String) as NotificationChannel[],
    respectQuietHours: formData.get('respectQuietHours') === 'on',
    quietHoursStart: String(formData.get('quietHoursStart') ?? '21:30'),
    quietHoursEnd: String(formData.get('quietHoursEnd') ?? '07:30'),
    maxPerMemberPerWeek: Number(formData.get('maxPerMemberPerWeek') ?? 3),
    cooldownHours: Number(formData.get('cooldownHours') ?? 24),
    createsStaffTask: formData.get('createsStaffTask') === 'on',
    taskAssigneeRole: role ? (role as RoleCode) : null,
    isActive: formData.get('isActive') === 'on',
  });
  revalidatePath('/dashboard/automations');
  back(result.message, result.ok);
}

async function toggleAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('automations.write');
  const result = await setAutomationActive(
    actor,
    String(formData.get('automationId')),
    formData.get('active') === 'yes',
  );
  revalidatePath('/dashboard/automations');
  back(result.message, result.ok);
}

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requireStaff(), searchParams]);
  const [automations, activity] = await Promise.all([listAutomations(actor), loadAutomationActivity(actor)]);
  const canEdit = actor.permissions.includes('automations.write');
  const channels = availableNotificationChannels();
  const notReady = channels.filter((channel) => !channel.ready);

  const active = automations.filter((automation) => automation.isActive);

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Automations</h1>
          <p className="small muted">
            {active.length} of {automations.length} switched on. These are messages to real people who did not ask to
            hear from you today.
          </p>
        </div>
      </header>

      {params.done ? <Notice tone="success">{params.done}</Notice> : null}
      {params.error ? <Notice tone="danger">{params.error}</Notice> : null}

      <section className="grid grid-4" aria-label="Last 30 days">
        <Stat label="Sent" value={String(activity.totals.sent)} />
        <Stat
          label="Skipped"
          value={String(activity.totals.skipped)}
          delta={activity.totals.skipped > activity.totals.sent ? 'more skipped than sent' : undefined}
          tone={activity.totals.skipped > activity.totals.sent ? 'warning' : 'neutral'}
        />
        <Stat
          label="Failed"
          value={String(activity.totals.failed)}
          tone={activity.totals.failed > 0 ? 'negative' : 'positive'}
        />
        <Stat label="Channels live" value={`${channels.filter((c) => c.ready).length} / ${channels.length}`} />
      </section>

      {notReady.length > 0 ? (
        <SafetyBanner tone="warning" title="Some channels are logged, not delivered">
          {notReady.map((channel) => `${channel.label}: ${channel.note}`).join(' ')} Messages on those channels are
          recorded so the history is honest, but nobody receives them.
        </SafetyBanner>
      ) : null}

      <div className="stack stack-4">
        {automations.map((automation) => (
          <article key={automation.automationId} className="card stack stack-4">
            <div className="row-between row-wrap">
              <div className="stack stack-2">
                <div className="row">
                  <strong style={{ fontSize: '1.0625rem' }}>{automation.name}</strong>
                  <Badge tone={automation.isActive ? 'success' : 'neutral'}>
                    {automation.isActive ? 'on' : 'off'}
                  </Badge>
                  {automation.isMarketing ? <Badge tone="warning">marketing</Badge> : null}
                  {automation.isUrgent ? <Badge tone="primary">urgent</Badge> : null}
                  {automation.createsStaffTask ? <Badge>creates a staff task</Badge> : null}
                </div>
                <p className="small muted">
                  When: {TRIGGER_LABELS[automation.triggerKind as TriggerKind] ?? automation.triggerKind} · to{' '}
                  {automation.audience} · via {automation.channels.join(', ')}
                </p>
                {automation.description ? <p className="small secondary">{automation.description}</p> : null}
                <p className="micro muted">
                  At most {automation.maxPerMemberPerWeek}/week, {automation.cooldownHours}h between sends
                  {automation.respectQuietHours
                    ? ` · quiet ${automation.quietHoursStart}–${automation.quietHoursEnd}`
                    : ' · sends at any hour'}
                  {automation.requiresOptIn ? ' · needs opt-in' : ''}
                  {automation.taskAssigneeRole ? ` · task to ${ROLE_LABELS[automation.taskAssigneeRole]}` : ''}
                </p>
                {automation.unavailableChannels.length > 0 ? (
                  <p className="micro muted">
                    <Badge tone="warning">
                      {automation.unavailableChannels.join(', ')} logged only
                    </Badge>
                  </p>
                ) : null}
              </div>

              <div className="stack stack-2" style={{ minWidth: '170px', alignItems: 'flex-end' }}>
                <span className="micro muted">
                  {automation.stats.sent} sent · {automation.stats.skipped} skipped
                  {automation.stats.failed > 0 ? ` · ${automation.stats.failed} failed` : ''}
                </span>
                {automation.stats.lastRanAt ? (
                  <span className="micro muted">last {DATETIME.format(new Date(automation.stats.lastRanAt))}</span>
                ) : (
                  <span className="micro muted">never run</span>
                )}
                {canEdit ? (
                  <form action={toggleAction}>
                    <input type="hidden" name="automationId" value={automation.automationId} />
                    <input type="hidden" name="active" value={automation.isActive ? 'no' : 'yes'} />
                    <button className="btn btn-ghost btn-sm" type="submit">
                      {automation.isActive ? 'Switch off' : 'Switch on'}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            {canEdit ? (
              <details className="disclosure">
                <summary className="small">Edit</summary>
                <form action={saveAction} className="stack stack-4" style={{ marginTop: '0.75rem' }}>
                  <input type="hidden" name="automationId" value={automation.automationId} />

                  <label className="stack stack-2">
                    <span className="label">Name</span>
                    <input className="input" name="name" defaultValue={automation.name} required minLength={3} />
                  </label>

                  <label className="stack stack-2">
                    <span className="label">What it is for</span>
                    <input
                      className="input"
                      name="description"
                      defaultValue={automation.description ?? ''}
                      placeholder="Nudge members who booked but have not been in for a week."
                    />
                  </label>

                  <fieldset className="stack stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label">Channels</legend>
                    {channels.map((channel) => (
                      <label key={channel.channel} className="checkbox-row">
                        <input
                          type="checkbox"
                          name="channels"
                          value={channel.channel}
                          defaultChecked={automation.channels.includes(channel.channel)}
                        />
                        <span>
                          <strong className="small">
                            {channel.label}
                            {channel.ready ? '' : ' — logged only'}
                          </strong>
                          <span className="hint">{channel.note}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>

                  <div className="grid grid-2">
                    <label className="stack stack-2">
                      <span className="label">Most per member per week</span>
                      <input
                        className="input"
                        type="number"
                        name="maxPerMemberPerWeek"
                        min="1"
                        max={MAX_PER_MEMBER_PER_WEEK_CAP}
                        defaultValue={automation.maxPerMemberPerWeek}
                        required
                      />
                      <span className="hint">
                        Capped at {MAX_PER_MEMBER_PER_WEEK_CAP}. Lower is always allowed; the ceiling is not
                        negotiable.
                      </span>
                    </label>

                    <label className="stack stack-2">
                      <span className="label">Hours between sends</span>
                      <input
                        className="input"
                        type="number"
                        name="cooldownHours"
                        min="1"
                        max="720"
                        defaultValue={automation.cooldownHours}
                        required
                      />
                    </label>
                  </div>

                  <div className="grid grid-2">
                    <label className="stack stack-2">
                      <span className="label">Quiet from</span>
                      <input
                        className="input"
                        type="time"
                        name="quietHoursStart"
                        defaultValue={automation.quietHoursStart}
                        required
                      />
                    </label>
                    <label className="stack stack-2">
                      <span className="label">Quiet until</span>
                      <input
                        className="input"
                        type="time"
                        name="quietHoursEnd"
                        defaultValue={automation.quietHoursEnd}
                        required
                      />
                    </label>
                  </div>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      name="respectQuietHours"
                      defaultChecked={automation.respectQuietHours}
                      disabled={automation.isUrgent}
                    />
                    <span>
                      <strong className="small">Hold until quiet hours are over</strong>
                      <span className="hint">
                        {automation.isUrgent
                          ? 'Not applicable: this trigger is urgent by nature and is never held back.'
                          : 'A nudge about a missed workout at 2am costs you a member.'}
                      </span>
                    </span>
                  </label>

                  {automation.isMarketing ? (
                    <Notice tone="info">
                      This trigger is marketing, so explicit opt-in is always required and cannot be turned off here.
                      Consent is the member&rsquo;s to give, in their own notification preferences.
                    </Notice>
                  ) : null}

                  <label className="checkbox-row">
                    <input type="checkbox" name="createsStaffTask" defaultChecked={automation.createsStaffTask} />
                    <span>
                      <strong className="small">Also create a task for staff</strong>
                      <span className="hint">For anything that needs a person, not just a message.</span>
                    </span>
                  </label>

                  <label className="stack stack-2">
                    <span className="label">Task goes to</span>
                    <select className="select" name="taskAssigneeRole" defaultValue={automation.taskAssigneeRole ?? ''}>
                      <option value="">— nobody —</option>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="checkbox-row">
                    <input type="checkbox" name="isActive" defaultChecked={automation.isActive} />
                    <span>
                      <strong className="small">Switched on</strong>
                      <span className="hint">Off means nothing is evaluated and nothing is sent.</span>
                    </span>
                  </label>

                  <button className="btn btn-primary btn-sm" type="submit" style={{ alignSelf: 'flex-start' }}>
                    Save automation
                  </button>
                </form>
              </details>
            ) : null}
          </article>
        ))}
      </div>

      <div className="grid grid-2">
        <Panel title="Why messages were skipped">
          {activity.skipReasons.length === 0 ? (
            <EmptyState title="Nothing skipped" body="Every message that was evaluated in the last 30 days was sent." />
          ) : (
            <div className="stack stack-3">
              {activity.skipReasons.map((reason) => (
                <div key={reason.reason} className="row-between">
                  <span className="small">{reason.reason.replace(/_/g, ' ')}</span>
                  <span className="small muted">{reason.count}</span>
                </div>
              ))}
              <p className="micro muted">
                Worth reading. An automation quietly skipping most of its audience because they never opted in is
                something to know now, not to discover from a complaint.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Recent activity" flush>
          {activity.recent.length === 0 ? (
            <div className="panel-body">
              <EmptyState title="Nothing yet" body="Runs appear here as automations fire." />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Automation</th>
                    <th scope="col">Member</th>
                    <th scope="col">Outcome</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.recent.map((run, index) => (
                    <tr key={`${run.automationName}-${run.ranAt}-${index}`}>
                      <th scope="row" className="small">
                        {run.automationName}
                      </th>
                      <td className="small">{run.memberName ?? '—'}</td>
                      <td>
                        <Badge
                          tone={
                            run.state === 'sent'
                              ? 'success'
                              : run.state === 'failed'
                                ? 'danger'
                                : run.state === 'skipped'
                                  ? 'warning'
                                  : 'neutral'
                          }
                        >
                          {run.state}
                        </Badge>
                        {run.skipReason ? (
                          <span className="micro muted"> {run.skipReason.replace(/_/g, ' ')}</span>
                        ) : null}
                      </td>
                      <td className="micro muted">{DATETIME.format(new Date(run.ranAt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <p className="micro muted">
        Members control their own channels, frequency, quiet hours and marketing consent in their profile. Nothing here
        overrides that — an automation configured to send five emails a week still sends none to someone who turned
        email off.
      </p>
    </div>
  );
}
