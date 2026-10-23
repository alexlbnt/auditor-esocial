import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'scripts/lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/fixtures/**'],
      reporter: ['text', 'html'],
      // RNF-24: pelo menos 90% de linhas em src/core (e em src/core/rules).
      thresholds: { lines: 90 },
    },
  },
});
