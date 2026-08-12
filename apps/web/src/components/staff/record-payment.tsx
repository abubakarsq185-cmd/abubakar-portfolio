import { randomUUID } from 'node:crypto';
import { formatMoney } from '@gymguide/config';
import { Field, Notice } from '@gymguide/ui';
import { availablePaymentMethods } from '@/server/adapters/payments';

export interface OpenInvoice {
  id: string;
  number: string;
  balanceMinor: number;
}

/**
 * The front desk's money form.
 *
 * The idempotency key is generated when the page renders and travels in a
 * hidden field, so a double-clicked button or a refreshed POST resolves to the
 * same payment instead of taking a member's money twice. The database enforces
 * it with a unique index; this just makes the happy path pleasant.
 */
export function RecordPaymentForm({
  action,
  userId,
  branchId,
  currency,
  invoices,
  balanceMinor,
  message,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  branchId: string;
  currency: string;
  invoices: OpenInvoice[];
  balanceMinor: number;
  message?: string | null;
  error?: string | null;
}) {
  const methods = availablePaymentMethods();
  const suggested = invoices[0]?.balanceMinor ?? balanceMinor;

  return (
    <form action={action} className="stack stack-4" id="payment">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="idempotencyKey" value={randomUUID()} />

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {invoices.length > 0 ? (
        <Field label="Against invoice" htmlFor="invoiceId">
          <select id="invoiceId" name="invoiceId" className="select" defaultValue={invoices[0]?.id}>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number} — {formatMoney(invoice.balanceMinor, currency)} outstanding
              </option>
            ))}
            <option value="">No invoice (payment on account)</option>
          </select>
        </Field>
      ) : (
        <p className="small muted">
          Nothing outstanding. A payment recorded now is held on account rather than counted as revenue.
        </p>
      )}

      <div className="grid grid-2">
        <Field label={`Amount (${currency})`} htmlFor="amount" required hint="Enter rupees, not paisa.">
          <input
            id="amount"
            name="amount"
            className="input"
            inputMode="decimal"
            required
            defaultValue={suggested > 0 ? (suggested / 100).toString() : ''}
          />
        </Field>
        <Field label="Method" htmlFor="method" required>
          <select id="method" name="method" className="select" required defaultValue="cash">
            {methods.map((method) => (
              <option key={method.method} value={method.method} disabled={!method.ready}>
                {method.label}
                {method.ready ? '' : ' — not connected'}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-2">
        <Field
          label="Bank reference"
          htmlFor="bankReference"
          hint="Required for bank transfers so it can be reconciled later."
        >
          <input id="bankReference" name="bankReference" className="input" placeholder="HBL-402931" />
        </Field>
        <Field label="Paid by" htmlFor="depositorName" hint="If someone else paid — a parent or an employer.">
          <input id="depositorName" name="depositorName" className="input" />
        </Field>
      </div>

      <Field label="Note" htmlFor="note">
        <input id="note" name="note" className="input" placeholder="Paid at the desk after the evening class." />
      </Field>

      <button className="btn btn-primary" type="submit">
        Record payment
      </button>
      <p className="micro muted">
        A receipt number is issued and the ledger is posted immediately. This action is audited under your name.
      </p>
    </form>
  );
}
