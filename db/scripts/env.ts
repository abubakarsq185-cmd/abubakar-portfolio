import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Minimal dotenv loader so the db scripts have no runtime dependencies. */
function readDotEnv(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export interface DbEnv {
  APP_ENV: string;
  DATABASE_URL: string;
  DATABASE_APP_URL: string;
  SEED_DEMO_PASSWORD: string;
}

export function loadEnv(): DbEnv {
  const fromFile = {
    ...readDotEnv(join(repoRoot, '.env.example')),
    ...readDotEnv(join(repoRoot, '.env')),
    ...readDotEnv(join(repoRoot, '.env.local')),
  };
  const get = (key: string, fallback = ''): string =>
    process.env[key] ?? fromFile[key] ?? fallback;

  return {
    APP_ENV: get('APP_ENV', 'development'),
    DATABASE_URL: get('DATABASE_URL', 'postgres://postgres@localhost:5432/gymguide'),
    DATABASE_APP_URL: get(
      'DATABASE_APP_URL',
      'postgres://gymguide_app:change-me@localhost:5432/gymguide',
    ),
    SEED_DEMO_PASSWORD: get('SEED_DEMO_PASSWORD', 'GymGuide!Demo2026'),
  };
}
