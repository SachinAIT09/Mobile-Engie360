import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Pure-library tests only (src/lib); no React rendering. @engie/shared resolves to its source.
export default defineConfig({
  resolve: {
    alias: { '@engie/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
