import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { Badge, Field, SafetyBanner } from '@gymguide/ui';
import { formatDate } from '@gymguide/config';
import { requireMember, signOut, tenantSessionFor } from '@/server/auth/session';
import { withTenant } from '@/server/db/pool';
import { recordAudit } from '@/server/audit';

export const metadata: Metadata = { title: 'Profile' };

async function updatePreferencesAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const channels = ['in_app', 'push', 'email', 'sms', 'whatsapp'] as const;

  await withTenant(tenantSessionFor(actor), async (db) => {
    for (const channel of channels) {
      await db.query(
        `update notification_preferences
            set coaching_enabled = $1, billing_enabled = $2, marketing_enabled = $3,
                quiet_hours_start = $4, quiet_hours_end = $5,
                opted_in_at = case when $3 and opted_in_at is null then now() else opted_in_at end
          where user_id = $6 and channel = $7::notification_channel`,
        [
          formData.get(`coaching_${channel}`) === 'on',
          formData.get(`billing_${channel}`) === 'on',
          formData.get(`marketing_${channel}`) === 'on',
          String(formData.get('quietStart') ?? '21:30'),
          String(formData.get('quietEnd') ?? '07:30'),
          actor.userId,
          channel,
        ],
      );
    }
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'update',
    entityType: 'notification_preferences',
    subjectUserId: actor.userId,
    summary: 'Member updated their notification preferences',
  });

  revalidatePath('/app/profile');
}

async function requestDataAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const kind = String(formData.get('kind') ?? 'export');

  await withTenant(tenantSessionFor(actor), async (db) => {
    await db.query(
      `insert into data_requests (organization_id, user_id, kind, notes)
       values ($1, $2, $3, 'Requested by the member from the app.')`,
      [actor.organizationId, actor.userId, kind],
    );
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: kind === 'erasure' ? 'erasure_request' : 'export',
    entityType: 'data_request',
    subjectUserId: actor.userId,
    summary: `Member requested a data ${kind}`,
  });

  revalidatePath('/app/profile');
}

async function signOutAction(): Promise<void> {
  'use server';
  await signOut();
}

export default async function ProfilePage() {
  const { actor, organizationName } = await requireMember();

  const data = await withTenant(tenantSessionFor(actor), async (db) => {
    const [preferences, consents, requests, membership] = await Promise.all([
      db.query<{ channel: string; coaching_enabled: boolean; billing_enabled: boolean; marketing_enabled: boolean; quiet_hours_start: string; quiet_hours_end: string }>(
        `select channel::text as channel, coaching_enabled, billing_enabled, marketing_enabled,
                quiet_hours_start::text, quiet_hours_end::text
           from notification_preferences where user_id = $1 order by channel`,
        [actor.userId],
      ),
      db.query<{ kind: string; granted: boolean; granted_at: string | null }>(
        `select distinct on (kind) kind::text as kind, granted, granted_at
           from consents where user_id = $1 order by kind, created_at desc`,
        [actor.userId],
      ),
      db.query<{ kind: string; state: string; requested_at: string; due_at: string }>(
        `select kind, state, requested_at, due_at from data_requests
          where user_id = $1 order by requested_at desc limit 5`,
        [actor.userId],
      ),
      db.query<{ plan_name: string; state: string; current_period_end: string }>(
        `select mp.name as plan_name, mm.state::text as state, mm.current_period_end::text
           from member_memberships mm join membership_plans mp on mp.id = mm.membership_plan_id
          where mm.user_id = $1 order by mm.created_at desc limit 1`,
        [actor.userId],
      ),
    ]);
    return {
      preferences: preferences.rows,
      consents: consents.rows,
      requests: requests.rows,
      membership: membership.rows[0] ?? null,
    };
  });

  const quiet = data.preferences[0];

  return (
    <div className="stack stack-6 fade-up">
      <header className="stack stack-2">
        <h1 style={{ fontSize: '1.5rem' }}>Profile</h1>
        <p className="small muted">
          {actor.fullName} · {actor.email ?? 'no email on file'} · {organizationName}
        </p>
      </header>

      {data.membership ? (
        <section className="card stack stack-2">
          <span className="eyebrow">Membership</span>
          <div className="row-between">
            <strong>{data.membership.plan_name}</strong>
            <Badge tone={data.membership.state === 'active' ? 'success' : 'warning'}>{data.membership.state}</Badge>
          </div>
          <p className="small muted">Current period ends {formatDate(data.membership.current_period_end)}</p>
          <p className="micro muted">
            To change or freeze your membership, speak to the front desk or{' '}
            <Link href="/app/support">send the gym a message</Link>.
          </p>
        </section>
      ) : null}

      <form action={updatePreferencesAction} className="card stack stack-4">
        <h2 style={{ fontSize: '1.0625rem' }}>Notifications</h2>
        <p className="small secondary">
          You decide what reaches you and when. Safety messages always come through — those are the ones about your
          health.
        </p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">Coaching</th>
                <th scope="col">Billing</th>
                <th scope="col">Offers</th>
              </tr>
            </thead>
            <tbody>
              {data.preferences.map((preference) => (
                <tr key={preference.channel}>
                  <td className="small">{preference.channel.replace('_', '-')}</td>
                  <td>
                    <input type="checkbox" name={`coaching_${preference.channel}`} defaultChecked={preference.coaching_enabled} aria-label={`Coaching messages by ${preference.channel}`} />
                  </td>
                  <td>
                    <input type="checkbox" name={`billing_${preference.channel}`} defaultChecked={preference.billing_enabled} aria-label={`Billing messages by ${preference.channel}`} />
                  </td>
                  <td>
                    <input type="checkbox" name={`marketing_${preference.channel}`} defaultChecked={preference.marketing_enabled} aria-label={`Offers by ${preference.channel}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-2">
          <Field label="Quiet hours start" htmlFor="quietStart">
            <input id="quietStart" name="quietStart" type="time" className="input" defaultValue={quiet?.quiet_hours_start?.slice(0, 5) ?? '21:30'} />
          </Field>
          <Field label="Quiet hours end" htmlFor="quietEnd">
            <input id="quietEnd" name="quietEnd" type="time" className="input" defaultValue={quiet?.quiet_hours_end?.slice(0, 5) ?? '07:30'} />
          </Field>
        </div>

        <button className="btn btn-primary" type="submit">
          Save preferences
        </button>
      </form>

      <section className="card stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>What you have agreed to</h2>
        {data.consents.map((consent) => (
          <div key={consent.kind} className="row-between small">
            <span className="secondary">{consent.kind.replace(/_/g, ' ')}</span>
            <span className="row">
              <Badge tone={consent.granted ? 'success' : 'neutral'}>{consent.granted ? 'yes' : 'no'}</Badge>
              {consent.granted_at ? <span className="micro muted">{formatDate(consent.granted_at)}</span> : null}
            </span>
          </div>
        ))}
        <p className="micro muted">
          To change any of these, ask at the front desk. Every change is recorded with the date, so your history stays
          accurate.
        </p>
      </section>

      <section className="card stack stack-4">
        <h2 style={{ fontSize: '1.0625rem' }}>Your data</h2>
        <SafetyBanner tone="info" title="It is your information">
          You can ask for a copy of everything the gym holds about you, or ask them to delete it. Financial and safety
          records are kept where the law requires it — the rest is removed.
        </SafetyBanner>

        <div className="row row-wrap">
          <form action={requestDataAction}>
            <input type="hidden" name="kind" value="export" />
            <button className="btn btn-secondary btn-sm" type="submit">
              Request a copy of my data
            </button>
          </form>
          <form action={requestDataAction}>
            <input type="hidden" name="kind" value="erasure" />
            <button className="btn btn-ghost btn-sm" type="submit">
              Request deletion
            </button>
          </form>
        </div>

        {data.requests.length > 0 ? (
          <div className="stack stack-2">
            {data.requests.map((request, index) => (
              <div key={index} className="row-between small">
                <span className="secondary">
                  {request.kind} · requested {formatDate(request.requested_at)}
                </span>
                <Badge tone={request.state === 'completed' ? 'success' : 'warning'}>{request.state}</Badge>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <form action={signOutAction}>
        <button className="btn btn-secondary btn-block" type="submit">
          Sign out
        </button>
      </form>

      <p className="micro muted" style={{ textAlign: 'center' }}>
        GymGuide is not a medical service. It does not diagnose, treat or replace doctors, physiotherapists, dietitians
        or qualified trainers.
      </p>
    </div>
  );
}
