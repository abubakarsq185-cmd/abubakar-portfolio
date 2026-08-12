import 'server-only';
/**
 * Database access.
 *
 * Two pools with different privileges:
 *   • appPool  — the request pool. Connects as a role WITHOUT BYPASSRLS, and
 *                every query runs inside a transaction that sets the tenant
 *                GUCs row-level security reads. This is the pool that serves
 *                users.
 *   • ownerPool — a narrow, privileged pool used only for operations that must
 *                happen before an actor exists (looking up a session token,
 *                verifying a login) or that are deliberately cross-tenant
 *                (platform administration).
 *
 * If DATABASE_APP_URL is not configured we fall back to the owner connection
 * and log a loud warning, because that silently disables RLS.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { serverEnv } from '@gymguide/config/env';

let appPool: Pool | null = null;
let ownerPool: Pool | null = null;
let rlsVerified = false;

function createPool(connectionString: string): Pool {
  const env = serverEnv();
  return new Pool({
    connectionString,
    max: env.DATABASE_POOL_MAX,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
    application_name: 'gymguide-web',
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  });
}

export function getOwnerPool(): Pool {
  if (!ownerPool) ownerPool = createPool(serverEnv().DATABASE_URL);
  return ownerPool;
}

export function getAppPool(): Pool {
  if (appPool) return appPool;
  const env = serverEnv();
  if (!env.DATABASE_APP_URL) {
    console.warn(
      '[gymguide] DATABASE_APP_URL is not set — falling back to the owner connection. ' +
        'Row-level security will NOT be enforced. Set DATABASE_APP_URL before deploying.',
    );
    appPool = getOwnerPool();
    return appPool;
  }
  appPool = createPool(env.DATABASE_APP_URL);
  return appPool;
}

/**
 * Startup assertion: the application role must not be able to bypass RLS.
 * Runs once, on the first tenant query.
 */
async function assertRlsEnforced(client: PoolClient): Promise<void> {
  if (rlsVerified) return;
  const { rows } = await client.query<{ superuser: boolean; bypassrls: boolean; role: string }>(
    `select current_setting('is_superuser')::boolean as superuser,
            rolbypassrls as bypassrls,
            current_user as role
       from pg_roles where rolname = current_user`,
  );
  const row = rows[0];
  if (row && (row.superuser || row.bypassrls)) {
    const message =
      `[gymguide] SECURITY: the application connects as "${row.role}", which can bypass ` +
      'row-level security. Point DATABASE_APP_URL at the gymguide_app role.';
    if (serverEnv().APP_ENV === 'production') throw new Error(message);
    console.warn(message);
  }
  rlsVerified = true;
}

export interface TenantSession {
  userId: string;
  organizationId: string | null;
  role: string;
  /** Empty array means organization-wide scope. */
  branchIds: readonly string[];
  permissions: readonly string[];
  isPlatformAdmin: boolean;
}

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

/**
 * Run `fn` inside a transaction scoped to one actor. The GUCs set here are what
 * every RLS policy reads, so a bug in application code still cannot read
 * another tenant's rows.
 */
export async function withTenant<T>(
  session: TenantSession,
  fn: (db: Queryable) => Promise<T>,
): Promise<T> {
  const client = await getAppPool().connect();
  try {
    await assertRlsEnforced(client);
    await client.query('begin');
    await client.query(
      `select set_config('app.user_id', $1, true),
              set_config('app.organization_id', $2, true),
              set_config('app.role', $3, true),
              set_config('app.branch_ids', $4, true),
              set_config('app.permissions', $5, true),
              set_config('app.is_platform_admin', $6, true)`,
      [
        session.userId,
        session.organizationId ?? '',
        session.role,
        session.branchIds.join(','),
        session.permissions.join(','),
        session.isPlatformAdmin ? 'true' : 'false',
      ],
    );
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Privileged query. Only for pre-authentication work and platform tooling. */
export async function withOwner<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getOwnerPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Convenience for a single tenant-scoped read. */
export async function tenantQuery<T extends QueryResultRow = QueryResultRow>(
  session: TenantSession,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withTenant(session, async (db) => {
    const result = await db.query<T>(sql, params);
    return result.rows;
  });
}

export async function closePools(): Promise<void> {
  await Promise.all([appPool?.end(), ownerPool && ownerPool !== appPool ? ownerPool.end() : undefined]);
  appPool = null;
  ownerPool = null;
  rlsVerified = false;
}
