# Integrations: what is live, what needs credentials

Everything here is either genuinely implemented or a documented seam. Nothing
pretends to work.

## Payments

| Adapter | Status | Needs | Notes |
| --- | --- | --- | --- |
| **Cash** | **Live** | Nothing | Recorded at the desk, receipt issued, posted to the ledger immediately. |
| **Bank transfer** | **Live** | Nothing | Requires a reference, lands unreconciled, appears in the reconciliation queue until a manager matches it to a statement. |
| **Cheque** | **Live** | Nothing | Treated as a bank transfer for reconciliation. |
| Card (Stripe contract) | Adapter complete | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payment-intent creation with provider-level idempotency, HMAC webhook verification with timestamp skew checking, and event deduplication are all implemented and tested. Cannot settle money without live keys, and the interface says so. |
| Wallet (JazzCash / Easypaisa) | Adapter complete | `JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT` *or* `EASYPAISA_STORE_ID`, `EASYPAISA_HASH_KEY` | Sorted-field HMAC signing on request and verification on callback, per the documented contract. Needs a merchant account. |
| QR (Raast) | Adapter complete | `RAAST_QR_MERCHANT_ID` | Generates an EMVCo-style payload the front desk renders as a QR. Settlement arrives by webhook. |

Cash and bank transfer are first-class rather than a fallback because that is
how most Pakistani gyms are actually paid. A gym can run the whole product,
including the financial ledger and reconciliation, with no processor at all.

**Adding a provider** means implementing `PaymentAdapter` in
`apps/web/src/server/adapters/payments.ts`:

```ts
interface PaymentAdapter {
  key: string;
  label: string;
  methods: PaymentMethodKind[];
  isConfigured(): boolean;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookVerification;
}
```

The billing service, the ledger and the reconciliation queue do not change.

## Notifications

| Channel | Default | Live driver | Needs |
| --- | --- | --- | --- |
| In-app | **Live** | internal | Nothing |
| Push | console | Expo | `EXPO_PUSH_ACCESS_TOKEN` and a registered device |
| Email | console | SMTP | `SMTP_URL`; the transport library is chosen at deploy time |
| SMS | console | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| WhatsApp | console | Meta Cloud API | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, **plus approved message templates** and member opt-in |

The `console` driver is not a stub in the dishonest sense: every message, on
every channel, is written to the `notifications` table with its category,
template, state and suppression reason *before* any provider is called. That row
is the record of what the gym told a member and why, and it exists whether or not
a provider is connected.

WhatsApp is the strictest. Outside a 24-hour customer-service window the
Business API only permits approved templates, and GymGuide additionally refuses
to send without a recorded opt-in. The demo seed contains a WhatsApp
notification suppressed with the reason "No opt-in recorded for whatsapp".

## AI

| Driver | Status | Needs |
| --- | --- | --- |
| `scripted` | **Default, live, offline** | Nothing |
| `anthropic` | Implemented | `ANTHROPIC_API_KEY` |
| `openai` | Interface only | `OPENAI_API_KEY` |

The scripted driver is deterministic and makes no network calls. It answers from
the same approved content a live model would receive, through the same tool
contract, with the same output validation. That makes the demo honest and the
tests reliable, and it means a gym with no AI budget still gets a coach that can
explain their plan.

The Anthropic driver falls back to the scripted driver on any provider error —
a model outage must never break a member's app.

Regardless of driver: requests are classified before the call, output is
validated after, and every turn is logged with model, prompt version, tool
calls, sources and safety verdict. Member data is never used for external model
training.

## Smart-door access

**Not connected. No vendor integration exists.**

What exists is the seam. `access_credentials` holds rotating per-member tokens
(QR, barcode, RFID, PIN, NFC) stored as hashes with issue, expiry and revocation
timestamps. A door controller verifies a token through the integration API and
receives an allow/deny plus a check-in record. It never reads member records
directly.

To connect one you need the vendor's controller API credentials and a webhook
endpoint. `integration_connections` stores the configuration and a pointer to
the secret — `credential_ref` holds an environment variable name or KMS key id,
never the secret itself.

## Wearables

Not built. `metric_logs.source` already distinguishes `member`, `staff`,
`device` and `import`, so device-sourced weight, steps, sleep and heart rate
have a home when an integration is added.

## Accounting and POS

Not built. The ledger is designed to export: `ledger_entries` is a standard
double-entry journal with account, direction, amount, currency and date, which
is what an accounting export needs.

## App stores

Not configured. The Expo app builds and runs locally. Signing credentials, EAS
configuration and store listings are absent rather than faked. See
`apps/mobile/README.md`.

## Checking status at runtime

`integrationReadiness()` in `packages/config/src/env.ts` returns every
integration with a `ready` flag, the environment variables it needs, and an
honest note. The platform console renders it, so nobody has to read this file to
find out whether card payments will actually work today.
