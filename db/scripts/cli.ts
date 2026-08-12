#!/usr/bin/env tsx
/**
 * GymGuide database CLI.
 *
 *   pnpm db:up      apply pending migrations
 *   pnpm db:reset   drop and recreate the schema (development only)
 *   pnpm db:seed    load the Apex Fitness Lahore demo tenant
 *
 * Uses DATABASE_URL (owner) for DDL. After migrating it makes sure the
 * application role from DATABASE_APP_URL can log in, because the RLS
 * integration tests connect as that non-privileged role.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { loadEnv } from './env.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      filename    text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now(),
      duration_ms integer not null default 0
    )
  `);
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function up(): Promise<void> {
  const env = loadEnv();
  const client = await connect(env.DATABASE_URL);
  try {
    await ensureMigrationTable(client);
    const { rows } = await client.query<{ filename: string; checksum: string }>(
      'select filename, checksum from schema_migrations',
    );
    const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

    let count = 0;
    for (const filename of migrationFiles()) {
      const sql = readFileSync(join(migrationsDir, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);
      const previous = applied.get(filename);

      if (previous) {
        if (previous !== checksum) {
          throw new Error(
            `Migration ${filename} changed after being applied (${previous} → ${checksum}). ` +
              'Add a new migration instead of editing history.',
          );
        }
        continue;
      }

      const started = Date.now();
      process.stdout.write(`  ▸ ${filename} … `);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into schema_migrations (filename, checksum, duration_ms) values ($1, $2, $3)',
          [filename, checksum, Date.now() - started],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        process.stdout.write('failed\n');
        throw error;
      }
      process.stdout.write(`ok (${Date.now() - started}ms)\n`);
      count += 1;
    }

    await ensureAppRole(client, env.DATABASE_APP_URL);
    console.log(count === 0 ? 'Schema already up to date.' : `Applied ${count} migration(s).`);
  } finally {
    await client.end();
  }
}

/**
 * The app role is created NOLOGIN by migration 0009 (migrations must not know
 * secrets). Here we give it the password from DATABASE_APP_URL so the running
 * app — and the RLS tests — can connect as a non-privileged role.
 */
async function ensureAppRole(client: Client, appUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(appUrl);
  } catch {
    return;
  }
  const role = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');
  if (!role || role === 'postgres') return;

  const exists = await client.query('select 1 from pg_roles where rolname = $1', [role]);
  if (exists.rowCount === 0) {
    await client.query(`create role ${quoteIdent(role)} login`);
  }
  if (password) {
    await client.query(`alter role ${quoteIdent(role)} with login password ${quoteLiteral(password)}`);
  } else {
    await client.query(`alter role ${quoteIdent(role)} with login`);
  }
  await client.query(`alter role ${quoteIdent(role)} nobypassrls nosuperuser`);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName) {
    await client.query(`grant connect on database ${quoteIdent(dbName)} to ${quoteIdent(role)}`);
  }
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function reset(): Promise<void> {
  const env = loadEnv();
  if (env.APP_ENV === 'production') {
    throw new Error('Refusing to reset a production database.');
  }
  const client = await connect(env.DATABASE_URL);
  try {
    await client.query('drop schema if exists app cascade');
    await client.query('drop schema if exists public cascade');
    await client.query('create schema public');
    await client.query('grant all on schema public to public');
    console.log('Schema dropped and recreated.');
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  switch (command) {
    case 'up':
      await up();
      break;
    case 'reset':
      await reset();
      break;
    case 'seed': {
      const { seed } = await import('../seed/seed.js');
      await seed();
      break;
    }
    default:
      console.error(`Unknown command: ${command}\nUsage: cli.ts <up|reset|seed>`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
