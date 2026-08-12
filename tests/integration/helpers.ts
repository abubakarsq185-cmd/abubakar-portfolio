import { Client } from 'pg';

export interface ActorContext {
  userId: string;
  organizationId: string | null;
  role: string;
  branchIds: string[];
  permissions: string[];
  isPlatformAdmin: boolean;
}

/** Owner connection: migrations, fixtures and assertions that must see everything. */
export async function ownerClient(): Promise<Client> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

/**
 * Application connection. This is the important one: it authenticates as
 * `gymguide_app`, which is NOT a superuser and does NOT have BYPASSRLS.
 */
export async function appClient(): Promise<Client> {
  const client = new Client({ connectionString: process.env.DATABASE_APP_URL });
  await client.connect();
  const { rows } = await client.query<{ superuser: boolean; bypassrls: boolean }>(
    `select current_setting('is_superuser')::boolean as superuser, rolbypassrls as bypassrls
       from pg_roles where rolname = current_user`,
  );
  if (rows[0]?.superuser || rows[0]?.bypassrls) {
    throw new Error(
      'The integration tests are connected as a privileged role, so they would prove nothing. ' +
        'Point DATABASE_APP_URL at the gymguide_app role.',
    );
  }
  return client;
}

/** Run a query the way the application does: inside a tenant-scoped transaction. */
export async function asActor<T>(
  client: Client,
  actor: ActorContext,
  fn: (db: Client) => Promise<T>,
): Promise<T> {
  await client.query('begin');
  try {
    await client.query(
      `select set_config('app.user_id', $1, true),
              set_config('app.organization_id', $2, true),
              set_config('app.role', $3, true),
              set_config('app.branch_ids', $4, true),
              set_config('app.permissions', $5, true),
              set_config('app.is_platform_admin', $6, true)`,
      [
        actor.userId,
        actor.organizationId ?? '',
        actor.role,
        actor.branchIds.join(','),
        actor.permissions.join(','),
        actor.isPlatformAdmin ? 'true' : 'false',
      ],
    );
    return await fn(client);
  } finally {
    await client.query('rollback');
  }
}

/** Build an actor from a seeded account, using the real role → permission map. */
export async function actorFor(owner: Client, email: string): Promise<ActorContext> {
  const { rows } = await owner.query<{
    id: string;
    organization_id: string | null;
    is_platform_admin: boolean;
    role: string;
    permissions: string[];
    branch_ids: (string | null)[];
  }>(
    `select u.id, u.organization_id, u.is_platform_admin,
            (select r.code::text from user_roles ur join roles r on r.id = ur.role_id
              where ur.user_id = u.id and ur.revoked_at is null
              order by case r.code
                when 'gym_owner' then 1 when 'branch_manager' then 2 when 'coach' then 3
                when 'nutrition_professional' then 4 when 'front_desk' then 5
                when 'guardian' then 6 else 7 end
              limit 1) as role,
            coalesce((select array_agg(distinct p.key::text)
               from user_roles ur
               join role_permissions rp on rp.role_id = ur.role_id
               join permissions p on p.id = rp.permission_id
              where ur.user_id = u.id and ur.revoked_at is null), '{}') as permissions,
            coalesce((select array_agg(sa.branch_id) from staff_assignments sa where sa.user_id = u.id), '{}') as branch_ids
       from users u
      where u.email = $1`,
    [email],
  );
  const row = rows[0];
  if (!row) throw new Error(`No seeded account for ${email}. Run: pnpm db:bootstrap`);

  // A NULL branch assignment means organization-wide scope, expressed as [].
  const branchIds = row.branch_ids.some((id) => id === null)
    ? []
    : row.branch_ids.filter((id): id is string => Boolean(id));

  return {
    userId: row.id,
    organizationId: row.organization_id,
    role: row.is_platform_admin ? 'platform_super_admin' : (row.role ?? 'member'),
    branchIds,
    permissions: row.permissions,
    isPlatformAdmin: row.is_platform_admin,
  };
}

export async function userIdFor(owner: Client, email: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>('select id from users where email = $1', [email]);
  if (!rows[0]) throw new Error(`No user ${email}`);
  return rows[0].id;
}

/**
 * Create a throwaway second tenant so cross-organization isolation can be
 * tested for real rather than assumed.
 */
export async function createRivalTenant(owner: Client): Promise<{
  organizationId: string;
  branchId: string;
  ownerUserId: string;
  memberUserId: string;
  cleanup: () => Promise<void>;
}> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const org = await owner.query<{ id: string }>(
    `insert into organizations (slug, legal_name, display_name)
     values ($1, 'Rival Fitness Ltd', 'Rival Fitness') returning id`,
    [`rival-${suffix}`],
  );
  const organizationId = org.rows[0]!.id;

  const branch = await owner.query<{ id: string }>(
    `insert into branches (organization_id, code, name, city) values ($1, 'RV1', 'Rival Main', 'Karachi') returning id`,
    [organizationId],
  );
  const branchId = branch.rows[0]!.id;

  const ownerUser = await owner.query<{ id: string }>(
    `insert into users (organization_id, email, full_name, status) values ($1, $2, 'Rival Owner', 'active') returning id`,
    [organizationId, `owner-${suffix}@rival.test`],
  );
  const ownerUserId = ownerUser.rows[0]!.id;
  await owner.query(
    `insert into user_roles (user_id, role_id, organization_id) select $1, id, $2 from roles where code = 'gym_owner'`,
    [ownerUserId, organizationId],
  );
  await owner.query(
    `insert into staff_assignments (organization_id, user_id, branch_id, job_title) values ($1, $2, null, 'Owner')`,
    [organizationId, ownerUserId],
  );

  const memberUser = await owner.query<{ id: string }>(
    `insert into users (organization_id, email, full_name, status) values ($1, $2, 'Rival Member', 'active') returning id`,
    [organizationId, `member-${suffix}@rival.test`],
  );
  const memberUserId = memberUser.rows[0]!.id;
  await owner.query(
    `insert into user_roles (user_id, role_id, organization_id) select $1, id, $2 from roles where code = 'member'`,
    [memberUserId, organizationId],
  );
  await owner.query(
    `insert into member_profiles (organization_id, branch_id, user_id, member_number, lifecycle_stage, joined_on)
     values ($1, $2, $3, $4, 'active', current_date)`,
    [organizationId, branchId, memberUserId, `RV-${suffix}`],
  );
  await owner.query(
    `insert into health_screenings (organization_id, user_id, answers, reported_conditions)
     values ($1, $2, '{"secret": true}'::jsonb, '{rival_condition}')`,
    [organizationId, memberUserId],
  );

  return {
    organizationId,
    branchId,
    ownerUserId,
    memberUserId,
    cleanup: async () => {
      await owner.query('delete from organizations where id = $1', [organizationId]);
    },
  };
}
