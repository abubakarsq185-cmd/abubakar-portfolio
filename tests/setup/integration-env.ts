import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Integration tests run against a real PostgreSQL database with the real
 * migrations and the real seed. They connect as `gymguide_app` — the role the
 * application uses, which cannot bypass row-level security — so a passing
 * isolation test means isolation actually holds.
 *
 *   pnpm db:bootstrap && pnpm test:integration
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

for (const file of ['.env', '.env.local']) {
  const path = join(repoRoot, file);
  if (!existsSync(path)) continue;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

process.env.APP_ENV = 'test';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
