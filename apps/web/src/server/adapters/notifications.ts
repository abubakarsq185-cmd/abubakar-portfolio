import 'server-only';
/**
 * Notification channel adapters.
 *
 * Every message — whatever the channel — is written to the `notifications`
 * table first. That row is the record of what the gym told a member and why,
 * and it exists whether or not a provider is connected. The console driver is
 * the default so the product is fully usable (and auditable) offline.
 */
import { serverEnv } from '@gymguide/config/env';
import type { NotificationChannel } from '@gymguide/types';

export interface OutboundMessage {
  channel: NotificationChannel;
  to: { email?: string | null; phone?: string | null; pushToken?: string | null };
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaPath?: string | null;
  category: 'operational' | 'coaching' | 'billing' | 'marketing' | 'safety';
}

export interface DeliveryResult {
  delivered: boolean;
  provider: string;
  providerMessageId: string | null;
  error?: string;
}

export interface NotificationAdapter {
  channel: NotificationChannel;
  provider: string;
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<DeliveryResult>;
}

function consoleAdapter(channel: NotificationChannel): NotificationAdapter {
  return {
    channel,
    provider: 'console',
    isConfigured: () => true,
    async send(message) {
      if (serverEnv().LOG_LEVEL === 'debug') {
        console.info(`[notify:${channel}] ${message.title} — ${message.body.slice(0, 120)}`);
      }
      return { delivered: true, provider: 'console', providerMessageId: null };
    },
  };
}

const smtpAdapter: NotificationAdapter = {
  channel: 'email',
  provider: 'smtp',
  isConfigured: () => Boolean(serverEnv().SMTP_URL),
  async send(message) {
    const env = serverEnv();
    if (!env.SMTP_URL) {
      return { delivered: false, provider: 'smtp', providerMessageId: null, error: 'SMTP_URL is not configured' };
    }
    // Kept as a documented seam: the transport library is chosen at deploy time
    // (nodemailer, SES, Postmark). The contract above is what it must satisfy.
    return {
      delivered: false,
      provider: 'smtp',
      providerMessageId: null,
      error: 'SMTP transport is configured but not wired in this build. See docs/INTEGRATIONS.md.',
    };
  },
};

const twilioAdapter: NotificationAdapter = {
  channel: 'sms',
  provider: 'twilio',
  isConfigured: () =>
    Boolean(serverEnv().TWILIO_ACCOUNT_SID && serverEnv().TWILIO_AUTH_TOKEN && serverEnv().TWILIO_FROM),
  async send(message) {
    const env = serverEnv();
    if (!this.isConfigured()) {
      return { delivered: false, provider: 'twilio', providerMessageId: null, error: 'Twilio credentials are missing' };
    }
    if (!message.to.phone) {
      return { delivered: false, provider: 'twilio', providerMessageId: null, error: 'No phone number on file' };
    }
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          To: message.to.phone,
          From: env.TWILIO_FROM!,
          Body: `${message.title}\n\n${message.body}`,
        }),
      },
    );
    if (!response.ok) {
      return { delivered: false, provider: 'twilio', providerMessageId: null, error: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { sid: string };
    return { delivered: true, provider: 'twilio', providerMessageId: body.sid };
  },
};

const expoPushAdapter: NotificationAdapter = {
  channel: 'push',
  provider: 'expo',
  isConfigured: () => Boolean(serverEnv().EXPO_PUSH_ACCESS_TOKEN),
  async send(message) {
    const env = serverEnv();
    if (!env.EXPO_PUSH_ACCESS_TOKEN) {
      return { delivered: false, provider: 'expo', providerMessageId: null, error: 'EXPO_PUSH_ACCESS_TOKEN is missing' };
    }
    if (!message.to.pushToken) {
      return { delivered: false, provider: 'expo', providerMessageId: null, error: 'No device registered' };
    }
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: message.to.pushToken,
        title: message.title,
        body: message.body,
        data: { path: message.ctaPath ?? '/app' },
      }),
    });
    if (!response.ok) {
      return { delivered: false, provider: 'expo', providerMessageId: null, error: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { data?: { id?: string } };
    return { delivered: true, provider: 'expo', providerMessageId: body.data?.id ?? null };
  },
};

/**
 * WhatsApp is deliberately strict: the Business API only permits template
 * messages outside a 24-hour customer-service window, and the member must have
 * opted in. The automation gate enforces opt-in before we get here.
 */
const whatsappAdapter: NotificationAdapter = {
  channel: 'whatsapp',
  provider: 'meta_cloud',
  isConfigured: () =>
    Boolean(serverEnv().WHATSAPP_PHONE_NUMBER_ID && serverEnv().WHATSAPP_ACCESS_TOKEN),
  async send(message) {
    const env = serverEnv();
    if (!this.isConfigured()) {
      return {
        delivered: false,
        provider: 'meta_cloud',
        providerMessageId: null,
        error: 'WhatsApp is not connected. It also requires approved message templates.',
      };
    }
    if (!message.to.phone) {
      return { delivered: false, provider: 'meta_cloud', providerMessageId: null, error: 'No phone number on file' };
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to.phone.replace('+', ''),
          type: 'text',
          text: { body: `${message.title}\n\n${message.body}` },
        }),
      },
    );
    if (!response.ok) {
      return { delivered: false, provider: 'meta_cloud', providerMessageId: null, error: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { messages?: Array<{ id: string }> };
    return { delivered: true, provider: 'meta_cloud', providerMessageId: body.messages?.[0]?.id ?? null };
  },
};

export function notificationAdapterFor(channel: NotificationChannel): NotificationAdapter {
  const env = serverEnv();
  switch (channel) {
    case 'email':
      return env.NOTIFY_EMAIL_DRIVER === 'smtp' && smtpAdapter.isConfigured() ? smtpAdapter : consoleAdapter('email');
    case 'sms':
      return env.NOTIFY_SMS_DRIVER === 'twilio' && twilioAdapter.isConfigured() ? twilioAdapter : consoleAdapter('sms');
    case 'push':
      return env.NOTIFY_PUSH_DRIVER === 'expo' && expoPushAdapter.isConfigured() ? expoPushAdapter : consoleAdapter('push');
    case 'whatsapp':
      return env.NOTIFY_WHATSAPP_DRIVER === 'meta_cloud' && whatsappAdapter.isConfigured()
        ? whatsappAdapter
        : consoleAdapter('whatsapp');
    case 'in_app':
    default:
      // In-app "delivery" is just the notification row itself.
      return {
        channel: 'in_app',
        provider: 'internal',
        isConfigured: () => true,
        async send() {
          return { delivered: true, provider: 'internal', providerMessageId: null };
        },
      };
  }
}

/** Render a stored template with `{{placeholder}}` substitution. */
export function renderTemplate(template: string, variables: Record<string, string | number | null>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? '' : String(value);
  });
}
