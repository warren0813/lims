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
        // Progressive ratchet — these are FLOORS, not the target. The 80% line
        // goal is now MET (~81% lines, ~79% statements). Components, hooks, the
        // lib/api client, modals, the Tweaks subsystem, and the app/ route pages
        // are covered. Still uncovered: layouts, the API proxy route, and a few
        // deep timer/effect branches. Keep these floors at/near current coverage
        // so it can't regress; raise them further as the stragglers land. Never
        // lower them. CI fails if coverage drops below the floor.
        lines: 80,
        statements: 78,
        functions: 76,
        branches: 73,
        // Pure utils are fully covered — lock that in so they can't regress.
        'components/**/utils/**': {
          lines: 95,
          functions: 100,
          branches: 85,
          statements: 95,
        },
        // The API client (lib/api/index.ts) is exercised end-to-end via a fetch
        // mock — lock the high coverage so a refactor can't silently drop it.
        'lib/api/**': {
          lines: 90,
          functions: 95,
          branches: 80,
          statements: 90,
        },
      },
    },
  },
});
