/**
 * Password hashing. scrypt from node:crypto — no native dependency, memory-hard,
 * and the parameters are stored in the hash so they can be raised later without
 * invalidating existing passwords.
 *
 * Format: scrypt$N$r$p$keylen$saltBase64$hashBase64
 */
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const PARAMS = { N: 16_384, r: 8, p: 1, keylen: 64 } as const;
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) throw new Error('Password is too short to hash');
  const salt = randomBytes(16);
  const derived = await scrypt(plain.normalize('NFKC'), salt, PARAMS.keylen, { ...PARAMS, maxmem: MAXMEM });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    PARAMS.keylen,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    // Still burn comparable time so a missing account is not detectable by timing.
    await scrypt(plain, randomBytes(16), PARAMS.keylen, { ...PARAMS, maxmem: MAXMEM });
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 7 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, keylen, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64!, 'base64');
  const expected = Buffer.from(hashB64!, 'base64');
  const derived = await scrypt(plain.normalize('NFKC'), salt, Number(keylen), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** True when a stored hash used weaker parameters and should be upgraded on login. */
export function needsRehash(stored: string | null): boolean {
  if (!stored) return true;
  const parts = stored.split('$');
  if (parts.length !== 7 || parts[0] !== 'scrypt') return true;
  return Number(parts[1]) < PARAMS.N || Number(parts[4]) < PARAMS.keylen;
}

/** Opaque, URL-safe tokens for sessions, invites and QR credentials. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Session and invite tokens are stored hashed. They are high-entropy already,
 * so a single SHA-256 is the right tool: it makes a stolen database dump
 * useless without adding scrypt's cost to every authenticated request.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
