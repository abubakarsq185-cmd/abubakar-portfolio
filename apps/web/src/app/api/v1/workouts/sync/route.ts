/**
 * Offline workout sync.
 *
 * Used by both the web player and the Expo app. Idempotent by
 * `clientSessionId`, so replaying a queue after days offline updates the same
 * session rather than creating duplicates.
 */
import { NextResponse } from 'next/server';
import { workoutSessionSyncInput } from '@gymguide/types';
import { serverEnv } from '@gymguide/config/env';
import { getSession } from '@/server/auth/session';
import { syncWorkoutSession } from '@/server/services/training';
import { checkRateLimit } from '@/server/rate-limit';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'unauthorized', message: 'Sign in first.' } }, { status: 401 });
  }

  const limit = await checkRateLimit(`sync:${session.actor.userId}`, serverEnv().RATE_LIMIT_API_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'bad_json', message: 'Invalid JSON body.' } }, { status: 400 });
  }

  const parsed = workoutSessionSyncInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'That workout could not be saved.',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  try {
    const result = await syncWorkoutSession(session.actor, parsed.data);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error('[gymguide] workout sync failed', error);
    return NextResponse.json(
      { ok: false, error: { code: 'sync_failed', message: 'We could not save that workout. It is still on your device.' } },
      { status: 500 },
    );
  }
}
