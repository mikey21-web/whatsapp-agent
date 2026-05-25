import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/integration/**'],
    setupFiles: ['test/setup.ts'],
    environment: 'node',
    globals: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        execArgv: ['--max-old-space-size=6144'],
      },
    },
    isolate: false,
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
