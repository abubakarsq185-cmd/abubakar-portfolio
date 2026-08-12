import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineWorkspace } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

const alias = {
  '@gymguide/types': resolve(root, 'packages/types/src/index.ts'),
  '@gymguide/config': resolve(root, 'packages/config/src/index.ts'),
  '@gymguide/config/env': resolve(root, 'packages/config/src/env.ts'),
  '@gymguide/domain': resolve(root, 'packages/domain/src/index.ts'),
  '@gymguide/ui': resolve(root, 'packages/ui/src/index.ts'),
  '@': resolve(root, 'apps/web/src'),
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
      fileParallelism: false,
      pool: 'forks',
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  },
]);
