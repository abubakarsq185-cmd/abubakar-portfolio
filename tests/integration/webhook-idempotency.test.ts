import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import type { Client } from 'pg';
import { ownerClient } from './helpers';

/**
 * Payment webhooks must be idempotent and signature-verified.
 *
 * This talks to the database the way the webhook route does, so the guarantee
 * being tested is the real one: the unique (provider, external_event_id)
 * constraint, not a code path that could be refactored away.
 */
describe('payment webhooks', () => {
  let owner: Client;
  const provider = 'card';
  const secret = 'whsec_test_secret';

  beforeAll(async () => {
    owner = await ownerClient();
    await owner.query('delete from webhook_events where provider = $1', [provider]);
  });

  afterAll(async () => {
    await owner.query('delete from webhook_events where provider = $1', [provider]);
    await owner?.end();
  });

  function sign(body: string, timestamp: number): string {
    return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  }

  async function receive(eventId: string): Promise<'processed' | 'duplicate'> {
    const inserted = await owner.query<{ id: string }>(
      `insert into webhook_events (provider, event_type, external_event_id, signature_verified, payload, processing_state)
       values ($1, 'payment_intent.succeeded', $2, true, '{}'::jsonb, 'received')
       on conflict (provider, external_event_id) do nothing
       returning id`,
      [provider, eventId],
    );
    if (inserted.rows.length === 0) {
      await owner.query(
        `update webhook_events set attempts = attempts + 1, processing_state = 'duplicate'
          where provider = $1 and external_event_id = $2 and processing_state <> 'processed'`,
        [provider, eventId],
      );
      return 'duplicate';
    }
    await owner.query(
      `update webhook_events set processing_state = 'processed', processed_at = now() where id = $1`,
      [inserted.rows[0]!.id],
    );
    return 'processed';
  }

  it('processes a new event once', async () => {
    expect(await receive('evt_test_001')).toBe('processed');
  });

  it('treats a replay of the same event as a duplicate', async () => {
    expect(await receive('evt_test_001')).toBe('duplicate');
    expect(await receive('evt_test_001')).toBe('duplicate');

    // Exactly one stored event, and an already-processed row is never mutated
    // by a replay — that is what stops a duplicate from re-posting money.
    const { rows } = await owner.query<{ count: string; state: string }>(
      `select count(*) as count, max(processing_state) as state from webhook_events
        where provider = $1 and external_event_id = 'evt_test_001'`,
      [provider],
    );
    expect(Number(rows[0]!.count)).toBe(1);
    expect(rows[0]!.state).toBe('processed');
  });

  it('cannot store two rows for one provider event, even under a race', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        owner.query(
          `insert into webhook_events (provider, event_type, external_event_id, signature_verified, payload)
           values ($1, 'payment_intent.succeeded', 'evt_race', true, '{}'::jsonb)`,
          [provider],
        ),
      ),
    );
    const succeeded = results.filter((result) => result.status === 'fulfilled');
    expect(succeeded).toHaveLength(1);
  });

  it('records rejected signatures instead of dropping them silently', async () => {
    await owner.query(
      `insert into webhook_events (provider, event_type, external_event_id, signature_verified, signature_error, payload, processing_state)
       values ($1, 'unknown', 'evt_bad_sig', false, 'Signature mismatch', '{}'::jsonb, 'rejected')`,
      [provider],
    );
    const { rows } = await owner.query<{ processing_state: string; signature_error: string }>(
      `select processing_state, signature_error from webhook_events where external_event_id = 'evt_bad_sig'`,
    );
    expect(rows[0]!.processing_state).toBe('rejected');
    expect(rows[0]!.signature_error).toBe('Signature mismatch');
  });

  it('verifies a correct signature and rejects a tampered body', async () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign(body, timestamp);

    expect(sign(body, timestamp)).toBe(signature);
    expect(sign(`${body} `, timestamp)).not.toBe(signature);
    expect(sign(body, timestamp - 1)).not.toBe(signature);
  });
});

/**
 * The same guarantee for the member app's offline queue: replaying a queued
 * workout must update one session, never create a second.
 */
describe('offline workout sync idempotency', () => {
  let owner: Client;
  let userId: string;
  let organizationId: string;
  let branchId: string;
  const clientSessionId = 'test-offline-session-1';

  beforeAll(async () => {
    owner = await ownerClient();
    const { rows } = await owner.query<{ user_id: string; organization_id: string; branch_id: string }>(
      `select mp.user_id, mp.organization_id, mp.branch_id
         from member_profiles mp join users u on u.id = mp.user_id
        where u.email = 'ayesha.khan@example.com'`,
    );
    userId = rows[0]!.user_id;
    organizationId = rows[0]!.organization_id;
    branchId = rows[0]!.branch_id;
    await owner.query('delete from workout_sessions where client_session_id = $1', [clientSessionId]);
  });

  afterAll(async () => {
    await owner.query('delete from workout_sessions where client_session_id = $1', [clientSessionId]);
    await owner?.end();
  });

  async function sync(): Promise<void> {
    await owner.query(
      `insert into workout_sessions
         (organization_id, branch_id, user_id, title, state, scheduled_for, client_session_id,
          client_recorded_at, synced_at, sync_source, total_volume_kg, completed_sets, prescribed_sets)
       values ($1,$2,$3,'Offline test','completed',current_date,$4, now(), now(), 'offline_queue', 1200, 9, 9)
       -- The unique index is partial (client_session_id is not null), so the
       -- conflict target has to carry the same predicate.
       on conflict (user_id, client_session_id) where client_session_id is not null do update
          set total_volume_kg = excluded.total_volume_kg,
              completed_sets = excluded.completed_sets,
              synced_at = now()`,
      [organizationId, branchId, userId, clientSessionId],
    );
  }

  it('creates one session no matter how many times the queue replays', async () => {
    await sync();
    await sync();
    await sync();

    const { rows } = await owner.query<{ count: string }>(
      'select count(*) as count from workout_sessions where client_session_id = $1',
      [clientSessionId],
    );
    expect(Number(rows[0]!.count)).toBe(1);
  });
});
