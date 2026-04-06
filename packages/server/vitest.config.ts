import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'src/adapters/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/__tests__/**', 'src/adapters/__tests__/**', 'src/adapters/postgres.ts', 'src/adapters/mysql.ts', 'src/adapters/clickhouse.ts', 'src/adapters/externals.d.ts'],
    },
  },
});
