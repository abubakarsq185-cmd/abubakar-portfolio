import Link from 'next/link';
import type { Metadata } from 'next';
import { formatMoney, formatRelativeDays } from '@gymguide/config';
import { GOAL_LABELS } from '@gymguide/types';
import { Avatar, Badge, EmptyState } from '@gymguide/ui';
import { requireStaff } from '@/server/auth/session';
import { listMembers } from '@/server/services/members';

export const metadata: Metadata = { title: 'Members' };

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'at_risk', label: 'At risk' },
  { key: 'unpaid', label: 'Owes money' },
  { key: 'escalation', label: 'Health escalation' },
];

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; risk?: string; page?: string; stage?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requireStaff(), searchParams]);

  const result = await listMembers(actor, {
    search: params.q,
    risk: params.risk as 'at_risk' | undefined,
    lifecycleStage: params.stage,
    page: Number(params.page ?? 1),
  });

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Members</h1>
          <p className="small muted">
            {result.total} {result.total === 1 ? 'member' : 'members'} in your scope
            {actor.permissions.includes('members.read.assigned') && !actor.permissions.includes('members.read.all')
              ? ' — your assigned caseload'
              : ''}
          </p>
        </div>
        <Link className="btn btn-primary btn-sm" href="/dashboard/enrol">
          Enrol a member
        </Link>
      </header>

      <form className="row row-wrap" style={{ gap: '0.75rem' }} action="/dashboard/members">
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search name, member number, phone or email"
          aria-label="Search members"
          style={{ maxWidth: '360px' }}
        />
        <select className="select" name="risk" defaultValue={params.risk ?? ''} aria-label="Filter" style={{ maxWidth: '200px' }}>
          {FILTERS.map((filter) => (
            <option key={filter.key} value={filter.key}>
              {filter.label}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Apply
        </button>
      </form>

      <section className="panel">
        {result.rows.length === 0 ? (
          <EmptyState
            title="No members match"
            body="Try a different search, or clear the filters to see everyone in your scope."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Goal</th>
                  <th scope="col">Coach</th>
                  <th scope="col">Membership</th>
                  <th scope="col">Last session</th>
                  <th scope="col" className="num">Risk</th>
                  {actor.permissions.includes('finance.read') ? <th scope="col" className="num">Balance</th> : null}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((member) => (
                  <tr key={member.userId}>
                    <td>
                      <Link href={`/dashboard/members/${member.userId}`} className="row" style={{ gap: '0.75rem' }}>
                        <Avatar name={member.fullName} />
                        <span className="stack" style={{ gap: 0 }}>
                          <strong>{member.fullName}</strong>
                          <span className="micro muted">
                            {member.memberNumber} · {member.branchName}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="small">{member.primaryGoal ? GOAL_LABELS[member.primaryGoal] : '—'}</td>
                    <td className="small">{member.coachName ?? <span className="muted">Unassigned</span>}</td>
                    <td>
                      {member.membershipState ? (
                        <Badge
                          tone={
                            member.membershipState === 'active'
                              ? 'success'
                              : member.membershipState === 'past_due'
                                ? 'danger'
                                : member.membershipState === 'frozen'
                                  ? 'warning'
                                  : 'neutral'
                          }
                        >
                          {member.membershipState.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <span className="muted small">None</span>
                      )}
                      <div className="micro muted">{member.planName ?? ''}</div>
                    </td>
                    <td className="small">{formatRelativeDays(member.lastWorkoutAt)}</td>
                    <td className="num">
                      {member.openHighRiskCount > 0 ? (
                        <Badge tone="danger">health</Badge>
                      ) : member.inactivityRiskScore >= 45 ? (
                        <Badge tone="warning">{member.inactivityRiskScore}</Badge>
                      ) : (
                        <span className="muted">{member.inactivityRiskScore}</span>
                      )}
                    </td>
                    {actor.permissions.includes('finance.read') ? (
                      <td className="num">
                        {member.balanceDueMinor > 0 ? (
                          <span style={{ color: 'var(--danger)', fontWeight: 650 }}>
                            {formatMoney(member.balanceDueMinor, member.currency)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {result.total > result.pageSize ? (
        <nav className="row" aria-label="Pagination">
          {Array.from({ length: Math.ceil(result.total / result.pageSize) }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              className={page === result.page ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'}
              href={`/dashboard/members?page=${page}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
            >
              {page}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
