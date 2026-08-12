/**
 * A member reporting pain or a symptom. This is the most important endpoint in
 * the product: it must always succeed, always escalate, and never diagnose.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RISK_KINDS } from '@gymguide/types';
import { getSession } from '@/server/auth/session';
import { reportMemberRisk } from '@/server/services/safety';

const bodySchema = z.object({
  kind: z.enum(RISK_KINDS),
  detail: z.string().trim().max(1000).optional(),
  workoutSessionId: z.string().uuid().nullish(),
  exerciseId: z.string().uuid().nullish(),
  discomfortLevel: z.number().int().min(0).max(10).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'unauthorized', message: 'Sign in first.' } }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'validation_failed', message: 'Tell us what you are feeling.' } },
      { status: 422 },
    );
  }

  const result = await reportMemberRisk(session.actor, {
    memberUserId: session.actor.userId,
    kind: parsed.data.kind,
    detail: parsed.data.detail,
    discomfortLevel: parsed.data.discomfortLevel,
    workoutSessionId: parsed.data.workoutSessionId ?? undefined,
    source: 'workout_log',
  });

  return NextResponse.json({ ok: true, data: result });
}
