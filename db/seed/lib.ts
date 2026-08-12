import { createHash } from 'node:crypto';
import type { PoolClient, Client } from 'pg';

/**
 * Deterministic UUIDs (RFC 4122 v5, DNS namespace) so every seed run produces
 * the same ids. Tests and documentation can then reference a known member.
 */
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function uuidFor(name: string): string {
  const nsBytes = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(name, 'utf8')])).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Seeded PRNG so "random" demo history is identical on every machine. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function between(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(between(rng, min, max + 1));
}

export function chance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

// --- dates -----------------------------------------------------------------

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function daysAgo(from: Date, days: number): Date {
  return addDays(from, -days);
}

export function atTime(date: Date, hours: number, minutes = 0): Date {
  const next = new Date(date);
  next.setUTCHours(hours, minutes, 0, 0);
  return next;
}

// --- sql helpers -----------------------------------------------------------

export type Db = Client | PoolClient;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Insert one row from a plain object and return the generated id. */
export async function insert(
  db: Db,
  table: string,
  row: Record<string, unknown>,
  returning = 'id',
): Promise<string> {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);
  const columns = entries.map(([key]) => quoteIdent(key)).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  const values = entries.map(([, value]) => value);
  const sql = `insert into ${quoteIdent(table)} (${columns}) values (${placeholders}) returning ${returning}`;
  const result = await db.query<{ [key: string]: string }>(sql, values);
  return result.rows[0]?.[returning] ?? '';
}

/** Insert many rows efficiently in one statement. */
export async function insertMany(
  db: Db,
  table: string,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(row[column] ?? null);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  const sql = `insert into ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) values ${tuples.join(', ')}`;
  await db.query(sql, values);
}

export function step(label: string): void {
  process.stdout.write(`  ▸ ${label}\n`);
}

export function moneyPkr(rupees: number): number {
  return Math.round(rupees * 100);
}
