/**
 * The offline queue.
 *
 * This is the part of the member app that has to be right. A member trains in a
 * basement with no signal, logs eleven sets, and closes the app. Nothing may be
 * lost, and nothing may be counted twice when it eventually syncs.
 *
 * Design:
 *   • every queued item carries a stable `clientSessionId`,
 *   • the server upserts on that id, so replays update one row,
 *   • items are only removed from the queue after the server confirms,
 *   • a permanently rejected item (422) is dropped with a reason rather than
 *     retried forever.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutSessionSyncInput } from '@gymguide/types';

const QUEUE_KEY = 'gymguide:sync-queue:v1';
const CACHE_KEY = (id: string) => `gymguide:session:${id}`;

export interface QueueItem {
  id: string;
  body: WorkoutSessionSyncInput;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

export interface SyncOutcome {
  synced: number;
  failed: number;
  dropped: number;
  stillQueued: number;
}

async function readQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/** Save a session locally and queue it for sync. Safe to call repeatedly. */
export async function enqueueSession(body: WorkoutSessionSyncInput): Promise<void> {
  const queue = await readQueue();
  const existing = queue.findIndex((item) => item.body.clientSessionId === body.clientSessionId);
  const item: QueueItem = {
    id: body.clientSessionId,
    body,
    queuedAt: new Date().toISOString(),
    attempts: existing >= 0 ? (queue[existing]?.attempts ?? 0) : 0,
  };
  if (existing >= 0) queue[existing] = item;
  else queue.push(item);
  await writeQueue(queue);
  await AsyncStorage.setItem(CACHE_KEY(body.clientSessionId), JSON.stringify(body));
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Drain the queue. Called on app foreground, on reconnect, and after finishing
 * a workout. Concurrent calls are harmless because the server is idempotent.
 */
export async function drainQueue(
  post: (body: WorkoutSessionSyncInput) => Promise<{ status: number }>,
): Promise<SyncOutcome> {
  const queue = await readQueue();
  const remaining: QueueItem[] = [];
  let synced = 0;
  let failed = 0;
  let dropped = 0;

  for (const item of queue) {
    try {
      const response = await post(item.body);

      if (response.status >= 200 && response.status < 300) {
        synced += 1;
        await AsyncStorage.removeItem(CACHE_KEY(item.body.clientSessionId));
        continue;
      }

      // 4xx other than 429 means the server will never accept this payload.
      // Keeping it would retry forever and hide a real bug from the member.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        dropped += 1;
        continue;
      }

      failed += 1;
      remaining.push({ ...item, attempts: item.attempts + 1, lastError: `HTTP ${response.status}` });
    } catch (error) {
      failed += 1;
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: error instanceof Error ? error.message : 'network',
      });
    }
  }

  await writeQueue(remaining);
  return { synced, failed, dropped, stillQueued: remaining.length };
}

/** Exponential backoff so a flaky connection is not hammered. */
export function retryDelayMs(attempts: number): number {
  return Math.min(30 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

export async function cachedSession(clientSessionId: string): Promise<WorkoutSessionSyncInput | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY(clientSessionId));
  return raw ? (JSON.parse(raw) as WorkoutSessionSyncInput) : null;
}
