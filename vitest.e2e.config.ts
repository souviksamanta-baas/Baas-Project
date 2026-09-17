import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    include: ['apps/api/test/e2e/**/*.e2e.spec.ts'],
    testTimeout: 60_000,
  },
});
