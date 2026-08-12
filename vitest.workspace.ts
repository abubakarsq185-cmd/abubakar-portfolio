import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineWorkspace } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

// Order matters: Vite matches aliases by prefix in declaration order, so the
// deeper specifier has to come before the package root or '@gymguide/config'
// would swallow '@gymguide/config/env'.
const alias = {
  '@gymguide/types': resolve(root, 'packages/types/src/index.ts'),
  '@gymguide/config/env': resolve(root, 'packages/config/src/env.ts'),
  '@gymguide/config': resolve(root, 'packages/config/src/index.ts'),
  '@gymguide/domain': resolve(root, 'packages/domain/src/index.ts'),
  '@gymguide/ui': resolve(root, 'packages/ui/src/index.ts'),
  '@': resolve(root, 'apps/web/src'),
  // `server-only` intentionally throws outside a React Server Component.
  // Integration tests call server services directly, so it is stubbed here;
  // the real guard still applies to the application build.
  'server-only': resolve(root, 'tests/setup/server-only-stub.ts'),
};

export default defineWorkspace([
  {
    resolve: { alias },
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
      globals: false,
    },
  },
  {
    resolve: { alias },
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
      environment: 'node',
      globals: false,
      setupFiles: ['tests/setup/integration-env.ts'],
      // Integration tests share one Postgres database, so run them serially.
      // `fileParallelism` is a root-level option and is ignored inside a
      // project; a single fork is the per-project equivalent.
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  },
]);
