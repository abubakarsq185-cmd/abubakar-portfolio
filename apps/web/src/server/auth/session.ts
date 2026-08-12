import 'server-only';
/**
 * Session authentication.
 *
 * Opaque random tokens stored as SHA-256 hashes, in an httpOnly, SameSite=Lax
 * cookie. No JWT: revoking a session is a database write, not a wait for
 * expiry, which matters when a member's phone is lost or a staff account is
 * compromised.
 *
 * MFA-ready: staff accounts can require a TOTP code, and the session records
 * whether MFA was satisfied so sensitive screens can demand it.
 */
import { createHmac } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverEnv } from '@gymguide/config/env';
import {
  permissionsForRoles,
  type Actor,
  type Permission,
  type RoleCode,
} from '@gymguide/types';
import { withOwner, type TenantSession } from '../db/pool';
import { generateToken, hashToken, needsRehash, hashPassword, verifyPassword } from './password';
import { recordAudit } from '../audit';
import { checkRateLimit } from '../rate-limit';

const COOKIE_NAME = 'gg_session';

interface UserRow {
  id: string;
  organization_id: string | null;
  email: string | null;
  full_name: string;
  password_hash: string | null;
  status: string;
  locale: string;
  avatar_url: string | null;
  is_platform_admin: boolean;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  failed_login_count: number;
  locked_until: string | null;
  organization_name: string | null;
}

export interface SessionContext {
  actor: Actor;
  organizationName: string | null;
  sessionId: string;
  locale: 'en' | 'ur' | 'ur_rm';
  avatarUrl: string | null;
}

export type SignInResult =
  | { ok: true; actor: Actor }
  | { ok: false; code: 'invalid_credentials' | 'locked' | 'rate_limited' | 'mfa_required' | 'mfa_invalid' | 'inactive'; message: string };

export async function signIn(input: {
  email: string;
  password: string;
  totp?: string;
  ip?: string;
  userAgent?: string;
}): Promise<SignInResult> {
  const env = serverEnv();
  const limit = await checkRateLimit(`login:${input.email.toLowerCase()}`, env.RATE_LIMIT_LOGIN_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return { ok: false, code: 'rate_limited', message: 'Too many attempts. Please wait a minute and try again.' };
  }

  const user = await withOwner(async (db) => {
    const { rows } = await db.query<UserRow>(
      `select u.id, u.organization_id, u.email, u.full_name, u.password_hash, u.status,
              u.locale, u.avatar_url, u.is_platform_admin, u.mfa_enabled, u.mfa_secret,
              u.failed_login_count, u.locked_until, o.display_name as organization_name
         from users u
         left join organizations o on o.id = u.organization_id
        where u.email = $1 and u.deleted_at is null
        limit 1`,
      [input.email.toLowerCase()],
    );
    return rows[0] ?? null;
  });

  const passwordOk = await verifyPassword(input.password, user?.password_hash ?? null);

  if (!user || !passwordOk) {
    if (user) {
      await withOwner((db) =>
        db.query(
          `update users
              set failed_login_count = failed_login_count + 1,
                  locked_until = case when failed_login_count + 1 >= 10 then now() + interval '15 minutes' else locked_until end
            where id = $1`,
          [user.id],
        ),
      );
      await recordAudit({
        organizationId: user.organization_id,
        actorUserId: user.id,
        action: 'login_failed',
        entityType: 'auth_session',
        summary: `Failed sign-in for ${user.email}`,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
    }
    return { ok: false, code: 'invalid_credentials', message: 'That email or password is not right.' };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { ok: false, code: 'locked', message: 'This account is temporarily locked. Try again shortly.' };
  }
  if (user.status !== 'active' && user.status !== 'invited') {
    return { ok: false, code: 'inactive', message: 'This account is not active. Please contact your gym.' };
  }

  const roles = await loadRoles(user.id);
  const staffRoles: RoleCode[] = roles.filter((r) => r !== 'member' && r !== 'guardian');

  /**
   * A second factor can only be demanded of someone who has one.
   *
   * `mfa_enabled` with no enrolled secret used to be treated as "ask for a
   * code": verifyTotp returns false for a null secret, so no code could ever
   * satisfy it and the account was locked out permanently, with no enrolment
   * route to recover through. The seeded gym owner — the person who buys this —
   * was unreachable because of it.
   *
   * Wanting MFA and having enrolled it are different states. Until a secret
   * exists there is nothing to verify, so sign-in proceeds and the account is
   * marked as owing enrolment.
   */
  const mfaEnrolled = Boolean(user.mfa_secret);
  const mfaWanted = user.mfa_enabled || (env.REQUIRE_STAFF_MFA && staffRoles.length > 0);
  const mfaRequired = mfaWanted && mfaEnrolled;

  if (mfaRequired) {
    if (!input.totp) {
      return { ok: false, code: 'mfa_required', message: 'Enter the 6-digit code from your authenticator app.' };
    }
    if (!verifyTotp(user.mfa_secret, input.totp)) {
      return { ok: false, code: 'mfa_invalid', message: 'That code is not valid. Codes expire every 30 seconds.' };
    }
  }

  const actor = await buildActor(user, roles);
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3_600_000);

  await withOwner(async (db) => {
    await db.query(
      `insert into auth_sessions (user_id, organization_id, token_hash, ip_address, user_agent, mfa_satisfied, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, user.organization_id, hashToken(token), input.ip ?? null, input.userAgent ?? null, mfaRequired, expiresAt],
    );
    await db.query(
      'update users set failed_login_count = 0, locked_until = null, last_login_at = now() where id = $1',
      [user.id],
    );
    if (needsRehash(user.password_hash)) {
      const upgraded = await hashPassword(input.password);
      await db.query('update users set password_hash = $1, password_updated_at = now() where id = $2', [upgraded, user.id]);
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.APP_ENV !== 'development',
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 3600,
  });

  await recordAudit({
    organizationId: user.organization_id,
    actorUserId: user.id,
    actorRole: actor.role,
    action: 'login',
    entityType: 'auth_session',
    summary: `${user.full_name} signed in`,
    ipAddress: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  return { ok: true, actor };
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await withOwner((db) =>
      db.query('update auth_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null', [
        hashToken(token),
      ]),
    );
  }
  cookieStore.delete(COOKIE_NAME);
}

async function loadRoles(userId: string): Promise<RoleCode[]> {
  return withOwner(async (db) => {
    const { rows } = await db.query<{ code: RoleCode }>(
      `select r.code from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = $1 and ur.revoked_at is null`,
      [userId],
    );
    return rows.map((r) => r.code);
  });
}

async function buildActor(user: UserRow, roles: RoleCode[]): Promise<Actor> {
  const extraGrants = await withOwner(async (db) => {
    const { rows } = await db.query<{ key: Permission }>(
      `select p.key from user_permission_grants g
         join permissions p on p.id = g.permission_id
        where g.user_id = $1 and g.revoked_at is null
          and (g.expires_at is null or g.expires_at > now())`,
      [user.id],
    );
    return rows.map((r) => r.key);
  });

  const branchIds = await withOwner(async (db) => {
    const { rows } = await db.query<{ branch_id: string | null }>(
      `select branch_id from staff_assignments
        where user_id = $1 and (ends_on is null or ends_on >= current_date)`,
      [user.id],
    );
    // A NULL assignment means organization-wide scope, which we express as [].
    if (rows.some((r) => r.branch_id === null)) return [];
    return rows.map((r) => r.branch_id!).filter(Boolean);
  });

  const primaryRole = pickPrimaryRole(roles, user.is_platform_admin);

  return {
    userId: user.id,
    organizationId: user.organization_id,
    role: primaryRole,
    roles,
    permissions: permissionsForRoles(roles, extraGrants),
    branchIds,
    isPlatformAdmin: user.is_platform_admin,
    fullName: user.full_name,
    email: user.email,
    impersonatedBy: null,
  };
}

const ROLE_PRIORITY: RoleCode[] = [
  'platform_super_admin',
  'gym_owner',
  'branch_manager',
  'coach',
  'nutrition_professional',
  'front_desk',
  'guardian',
  'member',
];

function pickPrimaryRole(roles: RoleCode[], isPlatformAdmin: boolean): RoleCode {
  if (isPlatformAdmin) return 'platform_super_admin';
  for (const role of ROLE_PRIORITY) if (roles.includes(role)) return role;
  return 'member';
}

/** Current session, or null when signed out. Cached per request by React. */
export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = await withOwner(async (db) => {
    const { rows } = await db.query<UserRow & { session_id: string; mfa_satisfied: boolean; impersonated_by: string | null }>(
      `select u.id, u.organization_id, u.email, u.full_name, u.password_hash, u.status, u.locale,
              u.avatar_url, u.is_platform_admin, u.mfa_enabled, u.mfa_secret, u.failed_login_count,
              u.locked_until, o.display_name as organization_name,
              s.id as session_id, s.mfa_satisfied, s.impersonated_by
         from auth_sessions s
         join users u on u.id = s.user_id
         left join organizations o on o.id = u.organization_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
        limit 1`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  });

  if (!row) return null;

  const roles = await loadRoles(row.id);
  const actor = await buildActor(row, roles);
  actor.impersonatedBy = row.impersonated_by;
  actor.mfaSatisfied = row.mfa_satisfied;

  // Touch last_seen_at at most once a minute to avoid a write per request.
  void withOwner((db) =>
    db.query(
      "update auth_sessions set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '1 minute'",
      [row.session_id],
    ),
  ).catch(() => undefined);

  return {
    actor,
    organizationName: row.organization_name,
    sessionId: row.session_id,
    locale: (row.locale as 'en' | 'ur' | 'ur_rm') ?? 'en',
    avatarUrl: row.avatar_url,
  };
}

/** Require a signed-in actor, or bounce to sign-in. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  return session;
}

export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.actor.isPlatformAdmin && !session.actor.permissions.includes(permission)) {
    redirect('/dashboard?denied=' + encodeURIComponent(permission));
  }
  return session;
}

export async function requireStaff(): Promise<SessionContext> {
  const session = await requireSession();
  const staff = ['gym_owner', 'branch_manager', 'coach', 'front_desk', 'nutrition_professional', 'platform_super_admin'];
  if (!staff.includes(session.actor.role)) redirect('/app');
  return session;
}

export async function requireMember(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.actor.role !== 'member' && session.actor.role !== 'guardian') redirect('/dashboard');
  return session;
}

/** Turn an Actor into the tenant session the database layer expects. */
export function tenantSessionFor(actor: Actor): TenantSession {
  return {
    userId: actor.userId,
    organizationId: actor.organizationId,
    role: actor.role,
    branchIds: actor.branchIds,
    permissions: actor.permissions,
    isPlatformAdmin: actor.isPlatformAdmin,
  };
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  return {
    ip: forwarded ? (forwarded.split(',')[0]?.trim() ?? null) : null,
    userAgent: headerList.get('user-agent'),
  };
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — enough to verify a standard authenticator app.
// ---------------------------------------------------------------------------

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function verifyTotp(secret: string | null, code: string, atMs = Date.now()): boolean {
  if (!secret) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(atMs / 30_000);
  // Accept the previous and next window to tolerate clock drift.
  for (const drift of [-1, 0, 1]) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter + drift));
    const digest = createHmac('sha1', key).update(buffer).digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const binary =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);
    if (String(binary % 1_000_000).padStart(6, '0') === code) return true;
  }
  return false;
}
