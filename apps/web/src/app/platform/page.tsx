import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { formatMoney } from '@gymguide/config';
import { Badge, EmptyState, Notice, Panel, SafetyBanner, Stat } from '@gymguide/ui';
import { requireSession, signOut } from '@/server/auth/session';
import { endSupportAccess, loadPlatformOverview, openSupportAccess } from '@/server/services/platform';

export const metadata: Metadata = { title: 'Platform console' };

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DATETIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  hour12: false,
});

/** Platform admin only. Not a permission — a different kind of account. */
async function requirePlatformAdmin() {
  const session = await requireSession();
  if (!session.actor.isPlatformAdmin) redirect('/dashboard');
  return session;
}

function back(message: string, ok: boolean): never {
  redirect(`/platform?${ok ? 'done' : 'error'}=${encodeURIComponent(message)}`);
}

async function signOutAction(): Promise<void> {
  'use server';
  await signOut();
}

async function openAccessAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePlatformAdmin();
  const result = await openSupportAccess(actor, {
    organizationId: String(formData.get('organizationId')),
    reason: String(formData.get('reason') ?? ''),
    ticketReference: String(formData.get('ticketReference') ?? ''),
    scope: formData.get('scope') === 'read_write' ? 'read_write' : 'read_only',
    hours: Number(formData.get('hours') ?? 2),
  });
  revalidatePath('/platform');
  back(result.message, result.ok);
}

async function endAccessAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePlatformAdmin();
  const result = await endSupportAccess(actor, String(formData.get('sessionId')));
  revalidatePath('/platform');
  back(result.message, result.ok);
}

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const data = await loadPlatformOverview();
  const money = (minor: number, currency = 'PKR') => formatMoney(minor, currency, 'en');
  const activeSessions = data.supportSessions.filter((session) => session.active);

  return (
    <main className="main" id="main" style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <div className="stack stack-6">
        <header className="page-header">
          <div className="stack stack-2">
            <span className="eyebrow">GymGuide platform</span>
            <h1 style={{ fontSize: '1.75rem' }}>Tenants and subscriptions</h1>
            <p className="small muted">
              Signed in as {actor.fullName}. This console shows aggregate figures about gyms and their subscriptions —
              it has no route to member health data, progress photos or private notes.
            </p>
          </div>
          <form action={signOutAction}>
            <button className="btn btn-ghost btn-sm" type="submit">
              Sign out
            </button>
          </form>
        </header>

        {params.done ? <Notice tone="success">{params.done}</Notice> : null}
        {params.error ? <Notice tone="danger">{params.error}</Notice> : null}

        <section className="grid grid-4" aria-label="Platform summary">
          <Stat label="Paying gyms" value={String(data.totals.tenants)} />
          <Stat label="Branches" value={String(data.totals.branches)} />
          <Stat label="Members served" value={String(data.totals.activeMembers)} />
          <Stat
            label="Recurring revenue"
            value={money(data.totals.mrrMinor)}
            delta="per month, active subscriptions"
          />
        </section>

        {data.totals.overLimitTenants > 0 ? (
          <Notice tone="warning">
            {data.totals.overLimitTenants} gym
            {data.totals.overLimitTenants === 1 ? ' is' : 's are'} over the member limit on their plan. Talk to them
            before metering starts costing them by surprise.
          </Notice>
        ) : null}

        <Panel title="Gyms" flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Gym</th>
                  <th scope="col">Plan</th>
                  <th scope="col" className="num">
                    Branches
                  </th>
                  <th scope="col" className="num">
                    Active members
                  </th>
                  <th scope="col" className="num">
                    Staff
                  </th>
                  <th scope="col">Renews</th>
                  <th scope="col" className="num">
                    Owed to us
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((tenant) => {
                  const overLimit = tenant.memberLimit !== null && tenant.activeMembers > tenant.memberLimit;
                  return (
                    <tr key={tenant.organizationId}>
                      <th scope="row">
                        <span className="stack" style={{ gap: '0.125rem' }}>
                          <span>{tenant.displayName}</span>
                          <span className="micro muted">
                            {tenant.slug} · {tenant.countryCode} · {tenant.currency}
                            {tenant.whiteLabel ? ' · white label' : ''}
                          </span>
                        </span>
                      </th>
                      <td>
                        {tenant.planName ? (
                          <span className="row">
                            <span className="small">{tenant.planName}</span>
                            {tenant.subscriptionState && tenant.subscriptionState !== 'active' ? (
                              <Badge tone="warning">{tenant.subscriptionState.replace(/_/g, ' ')}</Badge>
                            ) : null}
                          </span>
                        ) : (
                          <Badge tone="danger">no subscription</Badge>
                        )}
                        {tenant.billingInterval ? (
                          <span className="micro muted"> {tenant.billingInterval}</span>
                        ) : null}
                      </td>
                      <td className="num">{tenant.branches}</td>
                      <td className="num">
                        {tenant.activeMembers}
                        {tenant.memberLimit !== null ? (
                          <span className={overLimit ? 'micro' : 'micro muted'}>
                            {' '}
                            / {tenant.memberLimit}
                          </span>
                        ) : null}
                        {overLimit ? <Badge tone="warning">over</Badge> : null}
                      </td>
                      <td className="num">
                        {tenant.staffAccounts}
                        {tenant.seatsPurchased !== null ? (
                          <span className="micro muted"> / {tenant.seatsPurchased}</span>
                        ) : null}
                      </td>
                      <td className="small">
                        {tenant.currentPeriodEnd ? DATE.format(new Date(tenant.currentPeriodEnd)) : '—'}
                      </td>
                      <td className="num">
                        {tenant.outstandingPlatformMinor > 0
                          ? money(tenant.outstandingPlatformMinor, tenant.currency)
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid grid-2">
          <Panel title="Subscription plans" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col" className="num">
                      Monthly
                    </th>
                    <th scope="col" className="num">
                      Annual
                    </th>
                    <th scope="col" className="num">
                      Included
                    </th>
                    <th scope="col" className="num">
                      Gyms
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.plans.map((plan) => (
                    <tr key={plan.code}>
                      <th scope="row">
                        <span className="row">
                          {plan.name}
                          {plan.whiteLabel ? <Badge tone="primary">white label</Badge> : null}
                        </span>
                      </th>
                      <td className="num">{money(plan.monthlyPriceMinor)}</td>
                      <td className="num">{money(plan.annualPriceMinor)}</td>
                      <td className="num">
                        <span className="micro muted">
                          {plan.includedBranches} branch{plan.includedBranches === 1 ? '' : 'es'},{' '}
                          {plan.includedMembers} members, {plan.includedStaffSeats} seats
                        </span>
                      </td>
                      <td className="num">{plan.tenants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="System health">
            <div className="stack stack-4">
              <div className="stack stack-2">
                <strong className="small">Background jobs</strong>
                {data.jobQueue.length === 0 ? (
                  <p className="small muted">Queue is empty.</p>
                ) : (
                  <div className="row row-wrap">
                    {data.jobQueue.map((entry) => (
                      <Badge
                        key={entry.state}
                        tone={entry.state === 'failed' ? 'danger' : entry.state === 'pending' ? 'warning' : 'neutral'}
                      >
                        {entry.state}: {entry.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="stack stack-2">
                <strong className="small">Errors, last 14 days</strong>
                {data.errorSummary.length === 0 ? (
                  <p className="small muted">Nothing logged.</p>
                ) : (
                  data.errorSummary.slice(0, 7).map((entry) => (
                    <div key={entry.day} className="row-between">
                      <span className="micro muted">{DATE.format(new Date(`${entry.day}T12:00:00Z`))}</span>
                      <span className="micro">
                        {entry.count} · {entry.topMessage?.slice(0, 48) ?? '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>
        </div>

        <SafetyBanner tone="warning" title="Support access is visible to the gym">
          Opening a session writes a record into that gym&rsquo;s own audit trail, with your name, your reason and how
          long it lasts. Sessions expire on their own. Write access additionally requires the gym to have agreed —
          support cannot grant itself the ability to change a customer&rsquo;s data.
        </SafetyBanner>

        <Panel title="Open a support session">
          <form action={openAccessAction} className="stack stack-4">
            <div className="grid grid-2">
              <label className="stack stack-2">
                <span className="label">Gym</span>
                <select className="select" name="organizationId" required>
                  {data.tenants.map((tenant) => (
                    <option key={tenant.organizationId} value={tenant.organizationId}>
                      {tenant.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="stack stack-2">
                <span className="label">Ticket reference</span>
                <input className="input" name="ticketReference" placeholder="SUP-1042" />
              </label>
            </div>

            <label className="stack stack-2">
              <span className="label">Why do you need access?</span>
              <textarea
                className="textarea"
                name="reason"
                required
                minLength={12}
                rows={2}
                placeholder="Owner reports payments not appearing on the billing screen; checking the webhook ledger."
              />
              <span className="hint">At least 12 characters. The gym owner will read this.</span>
            </label>

            <div className="grid grid-2">
              <label className="stack stack-2">
                <span className="label">Scope</span>
                <select className="select" name="scope" defaultValue="read_only">
                  <option value="read_only">Read only</option>
                  <option value="read_write">Read and write (needs the gym&rsquo;s approval)</option>
                </select>
              </label>

              <label className="stack stack-2">
                <span className="label">Expires after</span>
                <select className="select" name="hours" defaultValue="2">
                  {[1, 2, 4, 8, 24].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours} hour{hours === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
              Open session
            </button>
          </form>
        </Panel>

        <Panel title={`Support access log${activeSessions.length ? ` — ${activeSessions.length} open` : ''}`} flush>
          {data.supportSessions.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                title="No support access has ever been opened"
                body="Every session that is opened appears here and in the gym's own audit trail, permanently."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Gym</th>
                    <th scope="col">Who</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Scope</th>
                    <th scope="col">Window</th>
                    <th scope="col" className="num">
                      Actions
                    </th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {data.supportSessions.map((session) => (
                    <tr key={session.id}>
                      <th scope="row">{session.organizationName}</th>
                      <td className="small">{session.platformUserName}</td>
                      <td className="small secondary" style={{ maxWidth: '22rem' }}>
                        {session.reason}
                        {session.ticketReference ? (
                          <span className="micro muted"> ({session.ticketReference})</span>
                        ) : null}
                      </td>
                      <td>
                        <Badge tone={session.scope === 'read_write' ? 'warning' : 'neutral'}>
                          {session.scope.replace(/_/g, ' ')}
                        </Badge>
                        {session.approvedByOrg ? <Badge tone="success">gym approved</Badge> : null}
                      </td>
                      <td className="micro muted">
                        {DATETIME.format(new Date(session.startedAt))} →{' '}
                        {session.endedAt
                          ? `${DATETIME.format(new Date(session.endedAt))} (closed)`
                          : session.active
                            ? `expires ${DATETIME.format(new Date(session.expiresAt))}`
                            : 'expired'}
                      </td>
                      <td className="num">{session.actionsTaken}</td>
                      <td className="num">
                        {session.active ? (
                          <form action={endAccessAction}>
                            <input type="hidden" name="sessionId" value={session.id} />
                            <button className="btn btn-ghost btn-sm" type="submit">
                              End now
                            </button>
                          </form>
                        ) : (
                          <Badge>{session.endedAt ? 'closed' : 'expired'}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="micro muted">
          Looking for a gym&rsquo;s own screens? Those live behind that gym&rsquo;s accounts, not here.{' '}
          <Link href="/dashboard">Your own dashboard</Link> if you also hold a staff role somewhere.
        </p>
      </div>
    </main>
  );
}
