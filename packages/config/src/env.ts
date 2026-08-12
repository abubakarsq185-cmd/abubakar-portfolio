/**
 * Typed, validated environment. Server-only — importing this from a client
 * bundle throws, so secrets can never leak into the browser.
 */
import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().default('GymGuide'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_APP_URL: z.string().min(1).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_SSL: booleanish.default(false),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(8760).default(720),
  REQUIRE_STAFF_MFA: booleanish.default(false),

  STORAGE_DRIVER: z.enum(['local', 's3', 'supabase']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./.storage'),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(86400).default(300),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  PAYMENTS_ENABLED_ADAPTERS: z.string().default('manual'),
  PAYMENTS_DEFAULT_CURRENCY: z.string().length(3).default('PKR'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  JAZZCASH_MERCHANT_ID: z.string().optional(),
  JAZZCASH_PASSWORD: z.string().optional(),
  JAZZCASH_INTEGRITY_SALT: z.string().optional(),
  EASYPAISA_STORE_ID: z.string().optional(),
  EASYPAISA_HASH_KEY: z.string().optional(),
  RAAST_QR_MERCHANT_ID: z.string().optional(),

  NOTIFY_EMAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  NOTIFY_SMS_DRIVER: z.enum(['console', 'twilio']).default('console'),
  NOTIFY_PUSH_DRIVER: z.enum(['console', 'expo']).default('console'),
  NOTIFY_WHATSAPP_DRIVER: z.enum(['console', 'meta_cloud']).default('console'),
  NOTIFY_FROM_EMAIL: z.string().default('no-reply@gymguide.app'),
  SMTP_URL: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  EXPO_PUSH_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  AI_DRIVER: z.enum(['scripted', 'anthropic', 'openai']).default('scripted'),
  AI_MODEL: z.string().default('claude-sonnet-4-5'),
  AI_PROMPT_VERSION: z.string().default('coach-2026-08-01'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_COACH_ENABLED: booleanish.default(true),

  JOB_QUEUE_DRIVER: z.enum(['pg', 'memory']).default('pg'),
  JOB_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
  AUTOMATION_QUIET_HOURS_START: z.string().regex(/^\d{2}:\d{2}$/).default('21:30'),
  AUTOMATION_QUIET_HOURS_END: z.string().regex(/^\d{2}:\d{2}$/).default('07:30'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Karachi'),

  RATE_LIMIT_DRIVER: z.enum(['memory', 'pg']).default('memory'),
  RATE_LIMIT_LOGIN_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(8),
  RATE_LIMIT_API_PER_MINUTE: z.coerce.number().int().min(1).max(10000).default(120),
  WEBHOOK_MAX_SKEW_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().optional(),
  ANALYTICS_DRIVER: z.enum(['console', 'db', 'segment']).default('console'),
  ANALYTICS_WRITE_KEY: z.string().optional(),

  SEED_DEMO_PASSWORD: z.string().default('GymGuide!Demo2026'),
  ALLOW_DEMO_LOGIN_HINTS: booleanish.default(true),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must never be called in the browser.');
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}\n\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the memoised env so a test can swap process.env. */
export function resetServerEnv(): void {
  cached = null;
}

export function enabledPaymentAdapters(env: ServerEnv = serverEnv()): string[] {
  return env.PAYMENTS_ENABLED_ADAPTERS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Integration readiness, surfaced in the platform console so nobody has to
 * guess whether a provider is actually live.
 */
export interface IntegrationReadiness {
  key: string;
  label: string;
  ready: boolean;
  requires: string[];
  note: string;
}

export function integrationReadiness(env: ServerEnv = serverEnv()): IntegrationReadiness[] {
  const has = (...keys: (keyof ServerEnv)[]): boolean => keys.every((k) => Boolean(env[k]));
  return [
    {
      key: 'payments.manual',
      label: 'Cash & bank transfer',
      ready: true,
      requires: [],
      note: 'Fully implemented, including reconciliation and the financial ledger.',
    },
    {
      key: 'payments.card',
      label: 'Card payments',
      ready: has('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'),
      requires: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      note: 'Adapter, webhook verification and idempotency are built. Add live keys to settle money.',
    },
    {
      key: 'payments.wallet',
      label: 'Wallet (JazzCash / Easypaisa)',
      ready: has('JAZZCASH_MERCHANT_ID', 'JAZZCASH_INTEGRITY_SALT') || has('EASYPAISA_STORE_ID', 'EASYPAISA_HASH_KEY'),
      requires: ['JAZZCASH_MERCHANT_ID', 'JAZZCASH_INTEGRITY_SALT'],
      note: 'Hash-signature request/verify flow implemented against the documented contract.',
    },
    {
      key: 'payments.qr',
      label: 'QR payments (Raast)',
      ready: has('RAAST_QR_MERCHANT_ID'),
      requires: ['RAAST_QR_MERCHANT_ID'],
      note: 'Generates a payment intent + QR payload. Settlement needs a live merchant id.',
    },
    {
      key: 'notify.whatsapp',
      label: 'WhatsApp messaging',
      ready: has('WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'),
      requires: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
      note: 'Requires an approved template and member opt-in. Opt-in is enforced in code.',
    },
    {
      key: 'notify.sms',
      label: 'SMS',
      ready: has('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'),
      requires: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'],
      note: 'Console driver writes to the notification ledger until credentials exist.',
    },
    {
      key: 'notify.push',
      label: 'Mobile push',
      ready: Boolean(env.EXPO_PUSH_ACCESS_TOKEN),
      requires: ['EXPO_PUSH_ACCESS_TOKEN'],
      note: 'Expo push adapter. Device tokens are stored per member.',
    },
    {
      key: 'ai.coach',
      label: 'AI coach model',
      ready: env.AI_DRIVER === 'scripted' || has('ANTHROPIC_API_KEY') || has('OPENAI_API_KEY'),
      requires: ['ANTHROPIC_API_KEY'],
      note: 'The scripted driver is deterministic and offline. A live model needs an API key.',
    },
    {
      key: 'door_access',
      label: 'Smart door access',
      ready: false,
      requires: ['hardware vendor credentials'],
      note: 'Not connected. The access-credential API is the integration seam — see docs/INTEGRATIONS.md.',
    },
    {
      key: 'app_stores',
      label: 'App store distribution',
      ready: false,
      requires: ['Apple / Google developer accounts'],
      note: 'The Expo app builds locally; store submission is not configured.',
    },
  ];
}
