import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // JSX as Next compiles it, with no React import needed.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    // Every unit test in the app; Playwright specs under tests/e2e run separately via test:e2e.
    include: ['{app,components,hooks,lib}/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', '.next-build/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.{ts,tsx}'],
      exclude: ['lib/**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'json-summary', 'lcov'],
    },
  },
});
