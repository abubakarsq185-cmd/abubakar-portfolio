import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { formatMoney, formatDate } from '@gymguide/config';
import { Badge, EmptyState, Panel, SafetyBanner } from '@gymguide/ui';
import { requirePermission } from '@/server/auth/session';
import { loadFinanceOverview, reconcilePayments } from '@/server/services/billing';
import { availablePaymentMethods } from '@/server/adapters/payments';

export const metadata: Metadata = { title: 'Billing' };

async function reconcileAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('finance.write');
  const ids = formData.getAll('paymentId').map(String).filter(Boolean);
  if (ids.length === 0) return;
  await reconcilePayments(actor, ids, String(formData.get('statementReference') ?? '') || undefined);
  revalidatePath('/dashboard/billing');
}

/** Revenue accounts are credit-balance; showing them negative would confuse. */
const ACCOUNT_LABELS: Record<string, string> = {
  accounts_receivable: 'Accounts receivable',
  cash: 'Cash',
  bank: 'Bank',
  card_clearing: 'Card clearing',
  wallet_clearing: 'Wallet clearing',
  membership_revenue: 'Membership revenue',
  joining_fee_revenue: 'Joining fees',
  class_revenue: 'Class revenue',
  pt_revenue: 'Personal training',
  product_revenue: 'Products',
  discounts: 'Discounts given',
  refunds: 'Refunds',
  tax_payable: 'Tax payable',
  deferred_revenue: 'Payments on account',
  processor_fees: 'Processor fees',
  write_off: 'Written off',
};

export default async function BillingPage() {
  const { actor } = await requirePermission('finance.read');
  const finance = await loadFinanceOverview(actor);
  const methods = availablePaymentMethods();

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Billing</h1>
          <p className="small muted">
            Every figure here comes from the double-entry ledger, not from a payment status column.
          </p>
        </div>
      </header>

      <section className="grid grid-4" aria-label="Financial summary">
        <div className="card stat">
          <span className="stat-label">Collected this month</span>
          <span className="stat-value">{formatMoney(finance.collectedThisMonthMinor, 'PKR', 'en', { compact: true })}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Outstanding</span>
          <span className="stat-value">{formatMoney(finance.outstandingMinor, 'PKR', 'en', { compact: true })}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Overdue</span>
          <span className="stat-value" style={{ color: finance.overdueMinor > 0 ? 'var(--danger)' : undefined }}>
            {formatMoney(finance.overdueMinor, 'PKR', 'en', { compact: true })}
          </span>
          <span className="stat-delta">{finance.overdueInvoices.length} invoices</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Refunded this month</span>
          <span className="stat-value">{formatMoney(finance.refundedThisMonthMinor, 'PKR', 'en', { compact: true })}</span>
        </div>
      </section>

      <div className="grid grid-sidebar">
        <div className="stack stack-6">
          <Panel title="Overdue invoices" flush>
            {finance.overdueInvoices.length === 0 ? (
              <EmptyState title="Nothing overdue" body="Every invoice is either paid or still within its due date." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Invoice</th>
                      <th scope="col" className="num">Balance</th>
                      <th scope="col" className="num">Days late</th>
                      <th scope="col">Reminders</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {finance.overdueInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <Link href={`/dashboard/members/${invoice.userId}`}>
                            <strong>{invoice.memberName}</strong>
                          </Link>
                        </td>
                        <td className="mono small">{invoice.number}</td>
                        <td className="num" style={{ fontWeight: 650 }}>
                          {formatMoney(invoice.balanceMinor)}
                        </td>
                        <td className="num">
                          <Badge tone={invoice.daysOverdue > 14 ? 'danger' : invoice.daysOverdue > 7 ? 'warning' : 'neutral'}>
                            {invoice.daysOverdue}
                          </Badge>
                        </td>
                        <td className="small muted">
                          {invoice.dunningStage === 0 ? 'None sent' : `Stage ${invoice.dunningStage} of 5`}
                        </td>
                        <td>
                          <Link className="btn btn-secondary btn-sm" href={`/dashboard/members/${invoice.userId}#payment`}>
                            Take payment
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Collections by method — this month" flush>
            {finance.byMethod.length === 0 ? (
              <EmptyState title="No payments yet this month" body="Recorded payments appear here immediately." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Method</th>
                      <th scope="col" className="num">Payments</th>
                      <th scope="col" className="num">Gross</th>
                      <th scope="col" className="num">Unreconciled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.byMethod.map((row) => (
                      <tr key={row.method}>
                        <td className="small">{row.method.replace('_', ' ')}</td>
                        <td className="num">{row.count}</td>
                        <td className="num">{formatMoney(row.grossMinor)}</td>
                        <td className="num">
                          {row.unreconciled > 0 ? <Badge tone="warning">{row.unreconciled}</Badge> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {actor.permissions.includes('ledger.read') ? (
            <Panel title="Ledger balances">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col" className="num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.ledgerBalances.map((balance) => (
                      <tr key={balance.account}>
                        <td className="small">{ACCOUNT_LABELS[balance.account] ?? balance.account}</td>
                        <td className="num">{formatMoney(Math.abs(balance.netMinor))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="micro muted" style={{ marginTop: '0.75rem' }}>
                Corrections are new balancing entries — nothing in this journal can be edited or deleted, including by a
                database owner.
              </p>
            </Panel>
          ) : null}
        </div>

        <div className="stack stack-6">
          {finance.unreconciledCount > 0 && actor.permissions.includes('finance.write') ? (
            <Panel title={`Reconciliation (${finance.unreconciledCount})`}>
              <SafetyBanner tone="info" title="Bank transfers need matching">
                A transfer is recorded the moment it is claimed, but stays unreconciled until someone matches it to the
                bank statement. That gap is deliberate — it is how you catch a payment that never arrived.
              </SafetyBanner>
              <form action={reconcileAction} className="stack stack-3" style={{ marginTop: '1rem' }}>
                <label className="label" htmlFor="statementReference">
                  Statement reference
                </label>
                <input
                  id="statementReference"
                  name="statementReference"
                  className="input"
                  placeholder="HBL statement 2026-08"
                />
                <p className="micro muted">
                  Select payments from a member’s profile to reconcile them individually, or use the bulk import once
                  your statement is exported.
                </p>
              </form>
            </Panel>
          ) : null}

          <Panel title="Payment methods">
            <div className="stack stack-3">
              {methods.map((method) => (
                <div key={method.method} className="row-between">
                  <div className="stack" style={{ gap: 0 }}>
                    <strong className="small">{method.label}</strong>
                    <span className="micro muted">{method.note}</span>
                  </div>
                  <Badge tone={method.ready ? 'success' : 'neutral'}>{method.ready ? 'live' : 'needs setup'}</Badge>
                </div>
              ))}
            </div>
            <p className="micro muted" style={{ marginTop: '0.875rem' }}>
              Cash and bank transfer work with no processor at all. The rest need merchant credentials — see
              docs/INTEGRATIONS.md.
            </p>
          </Panel>

          <Panel title="How money is recorded">
            <ol className="small secondary" style={{ paddingLeft: '1.125rem', display: 'grid', gap: '0.5rem' }}>
              <li>An invoice raises accounts receivable and recognises revenue.</li>
              <li>A payment clears the receivable and debits cash, bank or a clearing account.</li>
              <li>Invoice state is recalculated from the amounts — never set by hand.</li>
              <li>Every step writes an audit record naming who did it.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
