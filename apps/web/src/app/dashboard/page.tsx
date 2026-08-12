import Link from 'next/link';
import type { Metadata } from 'next';
import { formatMoney, formatTime } from '@gymguide/config';
import type { StaffQueueItem } from '@gymguide/types';
import { Badge, Panel, EmptyState } from '@gymguide/ui';
import { requireStaff } from '@/server/auth/session';
import { loadDashboard } from '@/server/services/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requireStaff(), searchParams]);
  const data = await loadDashboard(actor);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="stack stack-8">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>
            {greeting}, {actor.fullName.split(' ')[0]}
          </h1>
          <p className="small muted">
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })} · Asia/Karachi
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-secondary btn-sm" href="/dashboard/members">
            Find a member
          </Link>
          <Link className="btn btn-primary btn-sm" href="/dashboard/enrol">
            Enrol a member
          </Link>
        </div>
      </header>

      {params.denied ? (
        <div className="safety-banner warning" role="alert">
          <strong>You do not have access to that screen</strong>
          <p className="small secondary" style={{ marginTop: '0.375rem' }}>
            Your role does not include <code className="mono">{params.denied}</code>. Ask an owner if you need it — they
            can grant it to you individually, and the grant is recorded.
          </p>
        </div>
      ) : null}

      <section className="grid grid-4" aria-label="Key numbers">
        {data.metrics.map((metric) => (
          <Link key={metric.key} href={metric.href ?? '#'} className="card card-hover stat">
            <span className="stat-label">{metric.label}</span>
            <span className="stat-value">{metric.formatted}</span>
            {metric.deltaLabel ? (
              <span className={`stat-delta ${metric.tone === 'positive' ? 'positive' : metric.tone === 'warning' ? 'negative' : ''}`}>
                {metric.deltaLabel}
              </span>
            ) : null}
          </Link>
        ))}
      </section>

      <div className="grid grid-sidebar">
        <div className="stack stack-6">
          {data.queues.escalations.length > 0 ? (
            <Panel
              title="Health escalations"
              action={
                <Link className="btn btn-sm btn-secondary" href="/dashboard/escalations">
                  Open queue
                </Link>
              }
              flush
            >
              <Queue items={data.queues.escalations} emptyTitle="No open escalations" emptyBody="Nothing needs a person right now." />
            </Panel>
          ) : null}

          <Panel
            title="Members who need a call"
            action={<span className="badge">{data.queues.inactiveMembers.length}</span>}
            flush
          >
            <Queue
              items={data.queues.inactiveMembers}
              emptyTitle="Everyone is training"
              emptyBody="No active member has been away for more than ten days."
            />
          </Panel>

          <Panel title="Coaching decisions waiting for you" flush>
            <Queue
              items={data.queues.coachingReview}
              emptyTitle="Nothing to review"
              emptyBody="The engine has not proposed any changes that need a human."
            />
          </Panel>

          {data.queues.paymentFailures.length > 0 ? (
            <Panel
              title="Overdue payments"
              action={
                <Link className="btn btn-sm btn-secondary" href="/dashboard/members?risk=unpaid">
                  See who owes
                </Link>
              }
              flush
            >
              <Queue items={data.queues.paymentFailures} emptyTitle="All settled" emptyBody="No overdue invoices." />
            </Panel>
          ) : null}

          <Panel title="Branch performance" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Branch</th>
                    <th scope="col" className="num">Active</th>
                    <th scope="col" className="num">Inactive</th>
                    <th scope="col" className="num">Check-ins</th>
                    <th scope="col" className="num">Leads</th>
                    <th scope="col" className="num">Collected</th>
                    <th scope="col" className="num">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.branchPerformance.map((branch) => (
                    <tr key={branch.branchId}>
                      <td>
                        <strong>{branch.branchName}</strong>
                      </td>
                      <td className="num">{branch.activeMembers}</td>
                      <td className="num">
                        {branch.inactiveMembers > 0 ? (
                          <span className="badge badge-warning">{branch.inactiveMembers}</span>
                        ) : (
                          branch.inactiveMembers
                        )}
                      </td>
                      <td className="num">{branch.checkInsToday}</td>
                      <td className="num">{branch.openLeads}</td>
                      <td className="num">{formatMoney(branch.collectedThisMonthMinor, 'PKR', 'en', { compact: true })}</td>
                      <td className="num">
                        {branch.overdueMinor > 0 ? (
                          <span style={{ color: 'var(--danger)' }}>
                            {formatMoney(branch.overdueMinor, 'PKR', 'en', { compact: true })}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="stack stack-6">
          <Panel title="Today’s classes" flush>
            {data.todayClasses.length === 0 ? (
              <EmptyState title="No classes today" body="The timetable is clear." />
            ) : (
              <div className="queue">
                {data.todayClasses.map((klass) => (
                  <div key={klass.id} className="queue-item">
                    <div className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                      <span className="queue-title">{klass.name}</span>
                      <span className="queue-sub">
                        {formatTime(klass.startsAt)} · {klass.coachName ?? 'Coach TBC'} · {klass.roomName ?? 'Studio'}
                      </span>
                    </div>
                    <Badge tone={klass.booked >= klass.capacity ? 'warning' : 'neutral'}>
                      {klass.booked}/{klass.capacity}
                      {klass.waitlist > 0 ? ` +${klass.waitlist}` : ''}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Your tasks" flush>
            <Queue items={data.queues.tasks} emptyTitle="Nothing outstanding" emptyBody="Your task list is clear." />
          </Panel>

          <Panel title="New leads" flush>
            <Queue items={data.queues.newLeads} emptyTitle="No new leads" emptyBody="Nothing new in the pipeline." />
          </Panel>

          {data.queues.pendingWaivers.length > 0 ? (
            <Panel title="Waivers not signed" flush>
              <Queue items={data.queues.pendingWaivers} emptyTitle="All signed" emptyBody="Every member has signed." />
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Queue({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: StaffQueueItem[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (items.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return (
    <div className="queue">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="queue-item">
          <div className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
            <span className="queue-title">{item.title}</span>
            <span className="queue-sub">{item.subtitle}</span>
          </div>
          {item.badge ? (
            <Badge tone={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : 'neutral'}>
              {item.badge}
            </Badge>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
