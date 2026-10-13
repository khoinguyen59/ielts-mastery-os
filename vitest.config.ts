import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/backend/**/*.test.ts'],
    exclude: ['repos/**', 'node_modules/**', 'dist/**', 'ai_engine/**'],
    environment: 'node'
  }
});
