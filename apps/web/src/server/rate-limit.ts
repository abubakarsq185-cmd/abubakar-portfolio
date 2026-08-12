import 'server-only';
/**
 * Rate limiting.
 *
 * The memory driver is correct for a single instance and is what the demo runs.
 * The `pg` driver uses the database so limits hold across a horizontally scaled
 * deployment — configured with RATE_LIMIT_DRIVER.
 */
import { serverEnv } from '@gymguide/config/env';
import { withOwner } from './db/pool';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

async function pgLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const { rows } = await withOwner((db) =>
    db.query<{ count: string }>(
      `insert into job_queue (kind, payload, dedupe_key, state, run_after)
       values ('rate_limit', $1, $2, 'pending', $3)
       on conflict (kind, dedupe_key) where dedupe_key is not null and state in ('pending','running')
       do update set attempts = job_queue.attempts + 1
       returning attempts + 1 as count`,
      [JSON.stringify({ key }), `${key}:${windowStart.toISOString()}`, windowStart],
    ),
  );
  const count = Number(rows[0]?.count ?? 1);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: windowStart.getTime() + windowMs,
  };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (serverEnv().RATE_LIMIT_DRIVER === 'pg') {
    try {
      return await pgLimit(key, limit, windowMs);
    } catch {
      return memoryLimit(key, limit, windowMs);
    }
  }
  return memoryLimit(key, limit, windowMs);
}

/** Clears in-memory buckets. Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
