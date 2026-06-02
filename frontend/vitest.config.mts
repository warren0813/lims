import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Component + unit tests run under jsdom; coverage is measured against the
// source we have committed to covering (components/ + lib/), excluding
// generated code, type-only files, and the tests themselves.
//
// 80% global coverage is a progressive goal (see ONBOARDING / memory). The
// per-glob thresholds below lock in what is already covered so it cannot
// regress, while the global numbers track real progress without failing CI
// prematurely.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'components/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'app/**/*.test.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx,mjs}',
        '**/*.d.ts',
        'lib/api/types.gen.ts',
      ],
      thresholds: {
        // Progressive ratchet — these are FLOORS, not the target. Current global
        // coverage is ~11% lines (utils + ui + lib + the app/ route pages now
        // covered; layouts, the API proxy route, data hooks, and the API client
        // are not yet). Raise these numbers as coverage climbs toward the 80%
        // goal; never lower them. CI fails if coverage regresses below the floor.
        lines: 11,
        statements: 11,
        functions: 5,
        branches: 10,
        // Pure utils are fully covered — lock that in so they can't regress.
        'components/**/utils/**': {
          lines: 95,
          functions: 100,
          branches: 85,
          statements: 95,
        },
      },
    },
  },
});
