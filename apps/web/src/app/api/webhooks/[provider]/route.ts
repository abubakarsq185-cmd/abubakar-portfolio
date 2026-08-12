/**
 * Payment provider webhooks.
 *
 * Two guarantees, both enforced by the database rather than by hope:
 *   1. Signature verification before anything is read as truth.
 *   2. Idempotency — (provider, external_event_id) is unique, so a replayed
 *      event is recorded as a duplicate and never posts money twice.
 */
import { NextResponse } from 'next/server';
import { withOwner } from '@/server/db/pool';
import { paymentAdapterByKey } from '@/server/adapters/payments';
import { applyPaymentToInvoice } from '@/server/services/billing';
import { recordAudit } from '@/server/audit';

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const adapter = paymentAdapterByKey(provider);
  if (!adapter) {
    return NextResponse.json({ ok: false, error: 'Unknown provider' }, { status: 404 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const verification = adapter.verifyWebhook(rawBody, headers);

  if (!verification.valid) {
    // Rejected events are still recorded: a stream of failures is a signal.
    await withOwner((db) =>
      db.query(
        `insert into webhook_events (provider, event_type, external_event_id, signature_verified,
                                     signature_error, payload, processing_state)
         values ($1, 'unknown', $2, false, $3, $4, 'rejected')
         on conflict (provider, external_event_id) do nothing`,
        [provider, `invalid-${Date.now()}`, verification.reason ?? 'unknown', JSON.stringify({ raw: rawBody.slice(0, 2000) })],
      ),
    );
    return NextResponse.json({ ok: false, error: verification.reason ?? 'Invalid signature' }, { status: 400 });
  }

  const eventId = verification.eventId ?? `${provider}-${Date.now()}`;

  const outcome = await withOwner(async (db) => {
    const inserted = await db.query<{ id: string }>(
      `insert into webhook_events (provider, event_type, external_event_id, signature_verified, payload, processing_state)
       values ($1, $2, $3, true, $4, 'received')
       on conflict (provider, external_event_id) do nothing
       returning id`,
      [provider, verification.eventType ?? 'unknown', eventId, JSON.stringify(verification.payload ?? {})],
    );

    if (inserted.rows.length === 0) {
      await db.query(
        `update webhook_events set attempts = attempts + 1, processing_state = 'duplicate'
          where provider = $1 and external_event_id = $2 and processing_state <> 'processed'`,
        [provider, eventId],
      );
      return { duplicate: true as const };
    }

    const webhookEventId = inserted.rows[0]!.id;

    // Only successful payments move money.
    if (verification.eventType === 'payment.succeeded' || verification.eventType === 'payment_intent.succeeded') {
      const providerPaymentId = extractProviderPaymentId(verification.payload);
      if (providerPaymentId) {
        const payment = await db.query<{ id: string; invoice_id: string | null; amount_minor: string; organization_id: string; user_id: string }>(
          `update payments
              set state = 'succeeded', settled_at = now()
            where provider = $1 and provider_payment_id = $2 and state in ('pending','processing')
            returning id, invoice_id, amount_minor, organization_id, user_id`,
          [provider === 'card' ? 'card' : provider, providerPaymentId],
        );
        const row = payment.rows[0];
        if (row?.invoice_id) {
          await applyPaymentToInvoice(db, row.invoice_id, Number(row.amount_minor));
        }
        if (row) {
          await db.query('update webhook_events set resulted_in_payment_id = $1 where id = $2', [row.id, webhookEventId]);
          await recordAudit({
            organizationId: row.organization_id,
            action: 'payment_record',
            entityType: 'payment',
            entityId: row.id,
            subjectUserId: row.user_id,
            summary: `Payment confirmed by ${provider} webhook`,
          });
        }
      }
    }

    await db.query(
      `update webhook_events set processing_state = 'processed', processed_at = now(), attempts = attempts + 1
        where id = $1`,
      [webhookEventId],
    );
    return { duplicate: false as const };
  });

  return NextResponse.json({ ok: true, duplicate: outcome.duplicate });
}

function extractProviderPaymentId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const data = body.data as { object?: { id?: string } } | undefined;
  return data?.object?.id ?? (typeof body.pp_TxnRefNo === 'string' ? body.pp_TxnRefNo : null) ?? (typeof body.transactionId === 'string' ? body.transactionId : null);
}
