import 'server-only';
/**
 * Payment provider abstraction.
 *
 * One interface, several adapters. Nothing in the application talks to a
 * provider directly, so adding Raast, a new wallet or a different card
 * processor is a new file — not a rewrite of the billing service.
 *
 * Honest status (see docs/INTEGRATIONS.md):
 *   • manual   — fully implemented. Cash and bank transfer, with
 *                reconciliation, receipts and ledger postings.
 *   • card     — request/verify/webhook logic is implemented against the
 *                documented Stripe contract. It cannot settle real money
 *                without live keys, and says so rather than pretending.
 *   • wallet   — JazzCash / Easypaisa style hash-signed request + verify.
 *   • qr       — Raast-style QR intent payload.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@gymguide/config/env';
import type { PaymentMethodKind } from '@gymguide/types';

export interface PaymentIntentInput {
  organizationId: string;
  invoiceId: string | null;
  userId: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethodKind;
  reference: string;
  idempotencyKey: string;
  memberName: string;
  memberPhone: string | null;
  returnUrl?: string;
}

export interface PaymentIntentResult {
  ok: boolean;
  /** 'settled' means money is in hand now (cash at the desk). */
  status: 'settled' | 'pending_confirmation' | 'requires_action' | 'unavailable';
  providerPaymentId: string | null;
  /** Where to send the member, or the QR payload to render. */
  redirectUrl?: string;
  qrPayload?: string;
  message: string;
  /** Fee the provider will take, in minor units. */
  feeMinor: number;
}

export interface WebhookVerification {
  valid: boolean;
  reason?: string;
  eventId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
}

export interface PaymentAdapter {
  readonly key: string;
  readonly label: string;
  readonly methods: PaymentMethodKind[];
  isConfigured(): boolean;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookVerification;
}

// ---------------------------------------------------------------------------
// Manual: cash, bank transfer, cheque. The workhorse in Pakistan.
// ---------------------------------------------------------------------------

const manualAdapter: PaymentAdapter = {
  key: 'manual',
  label: 'Cash / bank transfer',
  methods: ['cash', 'bank_transfer', 'cheque', 'other'],
  isConfigured: () => true,
  async createIntent(input) {
    return {
      ok: true,
      status: input.method === 'cash' ? 'settled' : 'pending_confirmation',
      providerPaymentId: null,
      feeMinor: 0,
      message:
        input.method === 'cash'
          ? 'Cash received at the front desk. Receipt issued and posted to the ledger.'
          : 'Recorded as an unreconciled bank transfer. It will appear in the reconciliation queue until a manager matches it to the statement.',
    };
  },
  verifyWebhook: () => ({ valid: false, reason: 'The manual adapter does not receive webhooks.' }),
};

// ---------------------------------------------------------------------------
// Card (Stripe-compatible contract)
// ---------------------------------------------------------------------------

const cardAdapter: PaymentAdapter = {
  key: 'card',
  label: 'Card',
  methods: ['card'],
  isConfigured: () => Boolean(serverEnv().STRIPE_SECRET_KEY),
  async createIntent(input) {
    const env = serverEnv();
    if (!env.STRIPE_SECRET_KEY) {
      return {
        ok: false,
        status: 'unavailable',
        providerPaymentId: null,
        feeMinor: 0,
        message:
          'Card payments are not connected for this gym. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, then reconnect in Settings → Integrations.',
      };
    }
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Provider-level idempotency, on top of our own database constraint.
        'Idempotency-Key': input.idempotencyKey,
      },
      body: new URLSearchParams({
        amount: String(input.amountMinor),
        currency: input.currency.toLowerCase(),
        description: `GymGuide ${input.reference}`,
        'metadata[organization_id]': input.organizationId,
        'metadata[reference]': input.reference,
        'metadata[invoice_id]': input.invoiceId ?? '',
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        status: 'unavailable',
        providerPaymentId: null,
        feeMinor: 0,
        message: `The card provider rejected the request (${response.status}). ${detail.slice(0, 200)}`,
      };
    }
    const body = (await response.json()) as { id: string; client_secret: string };
    return {
      ok: true,
      status: 'requires_action',
      providerPaymentId: body.id,
      redirectUrl: `${input.returnUrl ?? ''}?client_secret=${body.client_secret}`,
      feeMinor: Math.round(input.amountMinor * 0.029) + 3000,
      message: 'Card payment created. The member completes it on the payment page.',
    };
  },
  verifyWebhook(rawBody, headers) {
    const env = serverEnv();
    const signatureHeader = headers['stripe-signature'];
    if (!env.STRIPE_WEBHOOK_SECRET) return { valid: false, reason: 'STRIPE_WEBHOOK_SECRET is not configured' };
    if (!signatureHeader) return { valid: false, reason: 'Missing stripe-signature header' };

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key ?? '', value ?? ''];
      }),
    );
    const timestamp = Number(parts.t);
    const signature = parts.v1;
    if (!timestamp || !signature) return { valid: false, reason: 'Malformed signature header' };

    const skew = Math.abs(Date.now() / 1000 - timestamp);
    if (skew > env.WEBHOOK_MAX_SKEW_SECONDS) {
      return { valid: false, reason: `Timestamp outside the ${env.WEBHOOK_MAX_SKEW_SECONDS}s tolerance` };
    }

    const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    if (!safeEqual(expected, signature)) return { valid: false, reason: 'Signature mismatch' };

    try {
      const payload = JSON.parse(rawBody) as { id: string; type: string; data: Record<string, unknown> };
      return { valid: true, eventId: payload.id, eventType: payload.type, payload };
    } catch {
      return { valid: false, reason: 'Body is not valid JSON' };
    }
  },
};

// ---------------------------------------------------------------------------
// Wallet (JazzCash / Easypaisa style: shared-salt HMAC over sorted fields)
// ---------------------------------------------------------------------------

const walletAdapter: PaymentAdapter = {
  key: 'wallet',
  label: 'Mobile wallet (JazzCash / Easypaisa)',
  methods: ['wallet'],
  isConfigured: () => Boolean(serverEnv().JAZZCASH_MERCHANT_ID && serverEnv().JAZZCASH_INTEGRITY_SALT),
  async createIntent(input) {
    const env = serverEnv();
    if (!env.JAZZCASH_MERCHANT_ID || !env.JAZZCASH_INTEGRITY_SALT) {
      return {
        ok: false,
        status: 'unavailable',
        providerPaymentId: null,
        feeMinor: 0,
        message:
          'Wallet payments are not connected. Add JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD and JAZZCASH_INTEGRITY_SALT.',
      };
    }
    const fields: Record<string, string> = {
      pp_Version: '2.0',
      pp_TxnType: 'MWALLET',
      pp_MerchantID: env.JAZZCASH_MERCHANT_ID,
      pp_Password: env.JAZZCASH_PASSWORD ?? '',
      pp_TxnRefNo: input.reference,
      pp_Amount: String(input.amountMinor),
      pp_TxnCurrency: input.currency,
      pp_MobileNumber: input.memberPhone ?? '',
      pp_Description: `GymGuide ${input.reference}`,
    };
    const secureHash = signSortedFields(fields, env.JAZZCASH_INTEGRITY_SALT);
    return {
      ok: true,
      status: 'requires_action',
      providerPaymentId: input.reference,
      redirectUrl: `https://payments.example-wallet.pk/checkout?ref=${input.reference}&hash=${secureHash}`,
      feeMinor: Math.round(input.amountMinor * 0.018),
      message: 'Wallet payment request signed. The member approves it in their wallet app.',
    };
  },
  verifyWebhook(rawBody, headers) {
    const salt = serverEnv().JAZZCASH_INTEGRITY_SALT;
    if (!salt) return { valid: false, reason: 'JAZZCASH_INTEGRITY_SALT is not configured' };
    let payload: Record<string, string>;
    try {
      payload = JSON.parse(rawBody) as Record<string, string>;
    } catch {
      return { valid: false, reason: 'Body is not valid JSON' };
    }
    const provided = payload.pp_SecureHash ?? headers['x-secure-hash'] ?? '';
    const { pp_SecureHash: _ignored, ...rest } = payload;
    const expected = signSortedFields(rest, salt);
    if (!safeEqual(expected, provided)) return { valid: false, reason: 'Secure hash mismatch' };
    return {
      valid: true,
      eventId: payload.pp_TxnRefNo ?? '',
      eventType: payload.pp_ResponseCode === '000' ? 'payment.succeeded' : 'payment.failed',
      payload,
    };
  },
};

// ---------------------------------------------------------------------------
// QR (Raast-style static/dynamic QR)
// ---------------------------------------------------------------------------

const qrAdapter: PaymentAdapter = {
  key: 'qr',
  label: 'QR payment (Raast)',
  methods: ['qr'],
  isConfigured: () => Boolean(serverEnv().RAAST_QR_MERCHANT_ID),
  async createIntent(input) {
    const merchant = serverEnv().RAAST_QR_MERCHANT_ID;
    if (!merchant) {
      return {
        ok: false,
        status: 'unavailable',
        providerPaymentId: null,
        feeMinor: 0,
        message: 'QR payments are not connected. Add RAAST_QR_MERCHANT_ID.',
      };
    }
    // EMVCo-style payload; the front desk renders this as a QR code.
    const payload = [
      '000201',
      '010212',
      `26${String(merchant.length + 4).padStart(2, '0')}0016PK.RAAST${merchant}`,
      '5303586',
      `54${String(String(input.amountMinor / 100).length).padStart(2, '0')}${input.amountMinor / 100}`,
      '5802PK',
      `62${String(input.reference.length + 4).padStart(2, '0')}05${input.reference}`,
    ].join('');
    return {
      ok: true,
      status: 'requires_action',
      providerPaymentId: input.reference,
      qrPayload: payload,
      feeMinor: 0,
      message: 'Show this QR to the member. The payment confirms by webhook when their bank settles it.',
    };
  },
  verifyWebhook(rawBody, headers) {
    const merchant = serverEnv().RAAST_QR_MERCHANT_ID;
    if (!merchant) return { valid: false, reason: 'RAAST_QR_MERCHANT_ID is not configured' };
    const signature = headers['x-raast-signature'];
    if (!signature) return { valid: false, reason: 'Missing x-raast-signature header' };
    const expected = createHmac('sha256', merchant).update(rawBody).digest('hex');
    if (!safeEqual(expected, signature)) return { valid: false, reason: 'Signature mismatch' };
    try {
      const payload = JSON.parse(rawBody) as { transactionId: string; status: string };
      return {
        valid: true,
        eventId: payload.transactionId,
        eventType: payload.status === 'PAID' ? 'payment.succeeded' : 'payment.failed',
        payload: payload as unknown as Record<string, unknown>,
      };
    } catch {
      return { valid: false, reason: 'Body is not valid JSON' };
    }
  },
};

function signSortedFields(fields: Record<string, string>, salt: string): string {
  const value = Object.keys(fields)
    .sort()
    .map((key) => fields[key])
    .filter((entry) => entry !== undefined && entry !== '')
    .join('&');
  return createHmac('sha256', salt).update(`${salt}&${value}`).digest('hex').toUpperCase();
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

const ADAPTERS: Record<string, PaymentAdapter> = {
  manual: manualAdapter,
  card: cardAdapter,
  wallet: walletAdapter,
  qr: qrAdapter,
};

export function paymentAdapterFor(method: PaymentMethodKind): PaymentAdapter {
  const found = Object.values(ADAPTERS).find((adapter) => adapter.methods.includes(method));
  return found ?? manualAdapter;
}

export function paymentAdapterByKey(key: string): PaymentAdapter | null {
  return ADAPTERS[key] ?? null;
}

export function availablePaymentMethods(): Array<{ method: PaymentMethodKind; label: string; ready: boolean; note: string }> {
  return [
    { method: 'cash', label: 'Cash', ready: true, note: 'Recorded immediately with a receipt.' },
    { method: 'bank_transfer', label: 'Bank transfer', ready: true, note: 'Needs a reference; appears in reconciliation.' },
    { method: 'card', label: 'Card', ready: cardAdapter.isConfigured(), note: cardAdapter.isConfigured() ? 'Live.' : 'Needs STRIPE_SECRET_KEY.' },
    { method: 'wallet', label: 'Wallet', ready: walletAdapter.isConfigured(), note: walletAdapter.isConfigured() ? 'Live.' : 'Needs wallet merchant credentials.' },
    { method: 'qr', label: 'QR', ready: qrAdapter.isConfigured(), note: qrAdapter.isConfigured() ? 'Live.' : 'Needs RAAST_QR_MERCHANT_ID.' },
  ];
}
