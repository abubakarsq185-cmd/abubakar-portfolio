import type { Metadata } from 'next';
import { Badge, BarChart, EmptyState, LineChart, Panel, ProgressBar, Stat } from '@gymguide/ui';
import { formatMoney } from '@gymguide/config';
import { requirePermission } from '@/server/auth/session';
import { loadReports } from '@/server/services/reports';

export const metadata: Metadata = { title: 'Reports' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  wallet: 'Mobile wallet',
  qr: 'QR',
  cheque: 'Cheque',
  adjustment: 'Adjustment',
};

export default async function ReportsPage() {
  const { actor } = await requirePermission('reports.read');
  const data = await loadReports(actor);
  const money = (minor: number) => formatMoney(minor, data.currency, 'en');

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Reports</h1>
          <p className="small muted">
            {data.branches.length === 1
              ? 'Your branch.'
              : `${data.branches.length} branches, compared side by side.`}{' '}
            Figures follow your access — a branch manager sees their branch, an owner sees the organization.
          </p>
        </div>
      </header>

      <section className="grid grid-4" aria-label="Key numbers">
        <Stat label="Active members" value={String(data.totals.activeMembers)} />
        <Stat
          label="Not seen in 14 days"
          value={String(data.totals.atRiskMembers)}
          delta={data.totals.atRiskMembers > 0 ? 'worth a call' : 'all engaged'}
          tone={data.totals.atRiskMembers > 0 ? 'warning' : 'positive'}
        />
        {data.showsMoney ? (
          <>
            <Stat label="Collected this month" value={money(data.totals.collectedThisMonthMinor)} />
            <Stat
              label="Overdue"
              value={money(data.totals.overdueMinor)}
              tone={data.totals.overdueMinor > 0 ? 'negative' : 'positive'}
            />
          </>
        ) : (
          <Stat label="Median weekly adherence" value={`${data.adherence.medianPercent}%`} />
        )}
      </section>

      <Panel title="Branch performance" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col" className="num">
                  Active
                </th>
                <th scope="col" className="num">
                  At risk
                </th>
                <th scope="col" className="num">
                  Open leads
                </th>
                <th scope="col" className="num">
                  Check-ins today
                </th>
                <th scope="col" className="num">
                  Classes today
                </th>
                {data.showsMoney ? (
                  <>
                    <th scope="col" className="num">
                      Collected (month)
                    </th>
                    <th scope="col" className="num">
                      Overdue
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.branches.map((branch) => (
                <tr key={branch.branchId}>
                  <th scope="row">{branch.branchName}</th>
                  <td className="num">{branch.activeMembers}</td>
                  <td className="num">{branch.inactiveMembers}</td>
                  <td className="num">{branch.openLeads}</td>
                  <td className="num">{branch.checkInsToday}</td>
                  <td className="num">{branch.classesToday}</td>
                  {data.showsMoney ? (
                    <>
                      <td className="num">{money(branch.collectedThisMonthMinor)}</td>
                      <td className="num">{branch.overdueMinor > 0 ? money(branch.overdueMinor) : '—'}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-2">
        {data.showsMoney ? (
          <Panel title="Net revenue by month">
            {data.revenueByMonth.length < 2 ? (
              <EmptyState
                title="Not enough history"
                body="Revenue trends appear once two months of postings exist. Figures come from the ledger, not from payment rows."
              />
            ) : (
              <LineChart
                data={data.revenueByMonth}
                valueSuffix=" PKR"
                ariaLabel="Net revenue by month in rupees, from the ledger"
              />
            )}
          </Panel>
        ) : null}

        <Panel title="Check-ins, last 30 days">
          <BarChart data={data.attendance} ariaLabel="Daily gym check-ins over the last 30 days" />
        </Panel>

        <Panel title="Workout adherence by week">
          {data.adherence.weeks.length === 0 ? (
            <EmptyState title="No sessions yet" body="Adherence appears once members start completing scheduled workouts." />
          ) : (
            <div className="stack stack-3">
              <BarChart
                data={data.adherence.weeks}
                target={80}
                ariaLabel="Average workout adherence percentage by week, against an 80 percent target"
              />
              <p className="micro muted">
                Median {data.adherence.medianPercent}% across {data.adherence.membersTracked} members. The line marks
                the 80% target where the coaching engine stops shortening weeks.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="New members by month">
          <BarChart data={data.joinersByMonth} ariaLabel="New member enrolments by month" />
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title="How long members stay">
          {data.retention.length === 0 ? (
            <EmptyState title="No active members" body="Tenure appears once members are enrolled." />
          ) : (
            <div className="stack stack-4">
              {data.retention.map((row) => (
                <div key={row.bucket} className="stack stack-2">
                  <div className="row-between">
                    <span className="small">{row.bucket}</span>
                    <span className="small muted">{row.members}</span>
                  </div>
                  <ProgressBar
                    value={row.members}
                    max={Math.max(...data.retention.map((item) => item.members))}
                    label={`${row.members} members at ${row.bucket}`}
                  />
                </div>
              ))}
              <p className="micro muted">
                Tenure of currently active members. A gym can hold headcount steady while losing everyone before month
                three, which this shows and a single churn figure hides.
              </p>
            </div>
          )}
        </Panel>

        {data.showsMoney ? (
          <Panel title="Collections by method, last 3 months" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Method</th>
                    <th scope="col" className="num">
                      Payments
                    </th>
                    <th scope="col" className="num">
                      Gross
                    </th>
                    <th scope="col" className="num">
                      Fees
                    </th>
                    <th scope="col" className="num">
                      Unreconciled
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.collectionsByMethod.map((row) => (
                    <tr key={row.method}>
                      <th scope="row">{METHOD_LABELS[row.method] ?? row.method}</th>
                      <td className="num">{row.paymentCount}</td>
                      <td className="num">{money(row.grossMinor)}</td>
                      <td className="num">{row.feesMinor > 0 ? money(row.feesMinor) : '—'}</td>
                      <td className="num">
                        {row.unreconciledCount > 0 ? (
                          <Badge tone="warning">{row.unreconciledCount}</Badge>
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
        ) : null}
      </div>

      <Panel title="Coach workload" flush>
        {data.coaches.length === 0 ? (
          <div className="panel-body">
            <EmptyState title="No coaches assigned" body="Coach workload appears once staff hold the coach role." />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Coach</th>
                  <th scope="col">Branch</th>
                  <th scope="col" className="num">
                    Members
                  </th>
                  <th scope="col" className="num">
                    Check-ins to review
                  </th>
                  <th scope="col" className="num">
                    Open cases
                  </th>
                  <th scope="col" className="num">
                    Open tasks
                  </th>
                  <th scope="col" className="num">
                    Classes (7d)
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.coaches.map((coach) => (
                  <tr key={coach.coachId}>
                    <th scope="row">{coach.coachName}</th>
                    <td>{coach.branchName ?? '—'}</td>
                    <td className="num">{coach.assignedMembers}</td>
                    <td className="num">{coach.checkinsAwaitingReview}</td>
                    <td className="num">{coach.openCases}</td>
                    <td className="num">{coach.openTasks}</td>
                    <td className="num">{coach.classesNext7Days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
