import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { formatDate, formatMoney, formatRelativeDays } from '@gymguide/config';
import { GOAL_LABELS, EXPERIENCE_LABELS } from '@gymguide/types';
import { Avatar, Badge, EmptyState, Panel, ProgressRing, SafetyBanner } from '@gymguide/ui';
import { requirePermission, requireStaff } from '@/server/auth/session';
import { getMemberDetail } from '@/server/services/members';
import { recordPayment } from '@/server/services/billing';
import { parseMoneyToMinor } from '@gymguide/config';
import { RecordPaymentForm } from '@/components/staff/record-payment';

export const metadata: Metadata = { title: 'Member' };

/**
 * Take a payment. Validation, the ledger posting and the audit record all live
 * in the billing service; this only translates a form into its input.
 */
async function recordPaymentAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('finance.write');

  const userId = String(formData.get('userId'));
  const currency = String(formData.get('currency') || 'PKR');
  const amountMinor = parseMoneyToMinor(String(formData.get('amount') ?? ''), currency);

  if (amountMinor === null || amountMinor <= 0) {
    redirect(`/dashboard/members/${userId}?payError=${encodeURIComponent('Enter an amount greater than zero.')}`);
  }

  const result = await recordPayment(actor, {
    userId,
    branchId: String(formData.get('branchId')),
    invoiceId: (formData.get('invoiceId') as string) || null,
    amountMinor,
    currency,
    method: String(formData.get('method')) as 'cash',
    bankReference: (formData.get('bankReference') as string) || undefined,
    depositorName: (formData.get('depositorName') as string) || undefined,
    note: (formData.get('note') as string) || undefined,
    idempotencyKey: String(formData.get('idempotencyKey')),
  });

  if (!result.ok) {
    redirect(`/dashboard/members/${userId}?payError=${encodeURIComponent(result.message)}`);
  }

  revalidatePath(`/dashboard/members/${userId}`);
  redirect(
    `/dashboard/members/${userId}?paid=${encodeURIComponent(
      result.duplicate ? result.message : `Payment recorded. Receipt ${result.receiptNumber ?? ''}.`,
    )}`,
  );
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ paid?: string; payError?: string; enrolled?: string }>;
}) {
  const [{ actor }, { userId }, query] = await Promise.all([requireStaff(), params, searchParams]);
  const detail = await getMemberDetail(actor, userId);
  if (!detail) notFound();

  const { member, profile, program, adherence, billing, health } = detail;

  return (
    <div className="stack stack-6">
      <nav className="small muted">
        <Link href="/dashboard/members">Members</Link> / {member.fullName}
      </nav>

      <header className="page-header">
        <div className="row" style={{ gap: '1rem' }}>
          <Avatar name={member.fullName} large />
          <div className="stack stack-2">
            <h1 style={{ fontSize: '1.625rem' }}>{member.fullName}</h1>
            <p className="small muted">
              {member.memberNumber} · {member.branchName} · joined{' '}
              {profile.joinedOn ? formatDate(profile.joinedOn) : '—'}
              {profile.guardianName ? ` · billed to ${profile.guardianName}` : ''}
            </p>
            <div className="row row-wrap">
              {member.membershipState ? (
                <Badge tone={member.membershipState === 'active' ? 'success' : member.membershipState === 'past_due' ? 'danger' : 'warning'}>
                  {member.planName ?? member.membershipState}
                </Badge>
              ) : (
                <Badge>No membership</Badge>
              )}
              {member.primaryGoal ? <Badge tone="primary">{GOAL_LABELS[member.primaryGoal]}</Badge> : null}
              {member.coachName ? <Badge>Coach: {member.coachName}</Badge> : <Badge tone="warning">No coach</Badge>}
              {member.openHighRiskCount > 0 ? <Badge tone="danger">Health escalation</Badge> : null}
            </div>
          </div>
        </div>
      </header>

      {query.enrolled ? (
        <div className="safety-banner info" role="status">
          <strong>Member enrolled</strong>
          <p className="small secondary" style={{ marginTop: '0.375rem' }}>
            Their membership is active and the first invoice is raised. Take payment below, and they will find their
            plan waiting in the app.
          </p>
        </div>
      ) : null}

      {profile.progressionHoldReason ? (
        <SafetyBanner tone="warning" title="Automatic progression is paused for this member">
          {profile.progressionHoldReason}. The coaching engine will not increase load until the flag is resolved in the{' '}
          <Link href="/dashboard/escalations">escalation queue</Link>.
        </SafetyBanner>
      ) : null}

      <div className="grid grid-sidebar">
        <div className="stack stack-6">
          <Panel title="Training">
            <div className="row row-wrap" style={{ gap: '2rem', alignItems: 'center' }}>
              <ProgressRing value={adherence.percent} caption="4 weeks" label="Adherence" />
              <div className="stack stack-3 grow">
                {program ? (
                  <>
                    <div className="stat">
                      <span className="stat-label">Current program</span>
                      <strong>{program.name}</strong>
                      <span className="small muted">
                        Week {program.week} · started {formatDate(program.startsOn)}
                      </span>
                    </div>
                    <p className="small muted">
                      {adherence.completed} of {adherence.planned} planned sessions completed in the last four weeks.
                    </p>
                  </>
                ) : (
                  <p className="small muted">
                    No active program. Assign one so the member knows what to do — the engine will suggest an approved
                    template based on their goal and this branch’s equipment.
                  </p>
                )}
                <p className="small muted">
                  Experience: {member.experienceLevel ? EXPERIENCE_LABELS[member.experienceLevel] : '—'} · trains{' '}
                  {profile.trainingDaysPerWeek ?? '—'} days a week
                  {profile.ramadanMode ? ' · Ramadan mode on' : ''}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Recent sessions" flush>
            {detail.recentSessions.length === 0 ? (
              <EmptyState title="No sessions yet" body="Sessions appear here as soon as the member logs one." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Session</th>
                      <th scope="col">Date</th>
                      <th scope="col">State</th>
                      <th scope="col" className="num">Sets</th>
                      <th scope="col" className="num">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recentSessions.map((session) => (
                      <tr key={session.id}>
                        <td>{session.title}</td>
                        <td className="small">{formatDate(session.scheduledFor)}</td>
                        <td>
                          <Badge tone={session.state === 'completed' ? 'success' : session.state === 'skipped' ? 'warning' : 'neutral'}>
                            {session.state}
                          </Badge>
                        </td>
                        <td className="num">{session.sets}</td>
                        <td className="num">{Math.round(session.volumeKg).toLocaleString('en-PK')} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {health ? (
            <Panel title="Health" action={<Badge tone="danger">Sensitive · access audited</Badge>}>
              {health.screening ? (
                <div className="stack stack-3">
                  <p className="small muted">
                    Screening completed {formatDate(health.screening.completedAt)}
                    {health.screening.requiresClearance ? ' · medical clearance required' : ''}
                  </p>
                  <div className="row row-wrap">
                    {health.screening.conditions.length === 0 && health.screening.painAreas.length === 0 ? (
                      <span className="small muted">No conditions or pain areas declared.</span>
                    ) : null}
                    {health.screening.conditions.map((condition) => (
                      <Badge key={condition} tone="warning">
                        {condition.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                    {health.screening.painAreas.map((area) => (
                      <Badge key={area}>{area.replace(/_/g, ' ')} pain</Badge>
                    ))}
                  </div>
                  {health.riskFlags.length > 0 ? (
                    <div className="stack stack-2">
                      <strong className="small">Risk flags</strong>
                      {health.riskFlags.map((flag) => (
                        <div key={flag.id} className="row-between small">
                          <span>
                            {flag.kind.replace(/_/g, ' ')} — {flag.detail ?? 'no detail'}
                          </span>
                          <Badge tone={flag.resolvedAt ? 'success' : flag.severity === 'critical' ? 'danger' : 'warning'}>
                            {flag.resolvedAt ? 'resolved' : flag.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="micro muted">
                    GymGuide does not diagnose. Use this to decide who to speak to and whether to refer, not to reach a
                    conclusion.
                  </p>
                </div>
              ) : (
                <EmptyState title="No screening on file" body="Ask the member to complete onboarding in the app." />
              )}
            </Panel>
          ) : null}

          <Panel title="Notes" flush>
            {detail.notes.length === 0 ? (
              <EmptyState title="No notes" body="Notes you add here are visible according to the tier you choose." />
            ) : (
              <div className="queue">
                {detail.notes.map((note) => (
                  <div key={note.id} className="queue-item" style={{ alignItems: 'flex-start' }}>
                    <div className="stack stack-2" style={{ flex: 1 }}>
                      <p className="small">{note.body}</p>
                      <span className="micro muted">
                        {note.authorName ?? 'System'} · {formatDate(note.createdAt)}
                      </span>
                    </div>
                    <Badge tone={note.visibility === 'restricted' ? 'danger' : note.visibility === 'coach_only' ? 'warning' : 'neutral'}>
                      {note.visibility.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="stack stack-6">
          <Panel title="Contact">
            <div className="stack stack-3 small">
              <div className="row-between">
                <span className="muted">Phone</span>
                <span>{member.phone ?? '—'}</span>
              </div>
              <div className="row-between">
                <span className="muted">Email</span>
                <span>{member.email ?? '—'}</span>
              </div>
              <div className="row-between">
                <span className="muted">Last visit</span>
                <span>{formatRelativeDays(member.lastVisitAt)}</span>
              </div>
              <div className="row-between">
                <span className="muted">Last workout</span>
                <span>{formatRelativeDays(member.lastWorkoutAt)}</span>
              </div>
              <div className="row-between">
                <span className="muted">Inactivity risk</span>
                <span>{member.inactivityRiskScore}/100</span>
              </div>
            </div>
          </Panel>

          {billing && actor.permissions.includes('finance.write') ? (
            <Panel title="Take a payment">
              <RecordPaymentForm
                action={recordPaymentAction}
                userId={member.userId}
                branchId={member.branchId}
                currency={member.currency}
                balanceMinor={billing.balanceMinor}
                invoices={billing.invoices
                  .filter((invoice) => invoice.balanceMinor > 0)
                  .map((invoice) => ({ id: invoice.id, number: invoice.number, balanceMinor: invoice.balanceMinor }))}
                message={query.paid ?? null}
                error={query.payError ?? null}
              />
            </Panel>
          ) : null}

          {billing ? (
            <Panel title="Billing" action={billing.balanceMinor > 0 ? <Badge tone="danger">Owes money</Badge> : null}>
              <div className="stack stack-4">
                <div className="stat">
                  <span className="stat-label">Balance</span>
                  <span className="stat-value">{formatMoney(billing.balanceMinor, member.currency)}</span>
                </div>
                <div className="stack stack-2">
                  <strong className="small">Recent invoices</strong>
                  {billing.invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="row-between small">
                      <span className="mono">{invoice.number}</span>
                      <span>
                        {formatMoney(invoice.totalMinor, member.currency)}{' '}
                        <Badge tone={invoice.state === 'paid' ? 'success' : invoice.balanceMinor > 0 ? 'warning' : 'neutral'}>
                          {invoice.state.replace('_', ' ')}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="stack stack-2">
                  <strong className="small">Recent payments</strong>
                  {billing.payments.slice(0, 5).map((payment) => (
                    <div key={payment.id} className="row-between small">
                      <span className="muted">
                        {formatDate(payment.receivedAt)} · {payment.method.replace('_', ' ')}
                      </span>
                      <span>{formatMoney(payment.amountMinor, member.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel title="Consent">
            <div className="stack stack-2 small">
              {detail.consents.map((consent) => (
                <div key={consent.kind} className="row-between">
                  <span className="muted">{consent.kind.replace(/_/g, ' ')}</span>
                  <Badge tone={consent.granted ? 'success' : 'neutral'}>{consent.granted ? 'granted' : 'declined'}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Timeline" flush>
            {detail.timeline.length === 0 ? (
              <EmptyState title="Nothing recorded yet" body="Audited events appear here." />
            ) : (
              <div className="queue">
                {detail.timeline.map((event, index) => (
                  <div key={`${event.at}-${index}`} className="queue-item">
                    <div className="stack" style={{ gap: 0 }}>
                      <span className="small">{event.summary}</span>
                      <span className="micro muted">
                        {event.kind.replace(/_/g, ' ')} · {formatDate(event.at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
