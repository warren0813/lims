import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Vitest coverage report output (generated, git-ignored).
    'coverage/**',
  ]),
  {
    rules: {
      // The three React Compiler-strict rules below ship with eslint-plugin-react-hooks v6
      // (React 19). The codebase pre-dates React Compiler and intentionally relies on the
      // patterns they flag:
      //   - set-state-in-effect: every data-loading hook uses
      //     `useEffect(() => api.x.list().then(setData))` (~33 sites). Fixing this means
      //     migrating to Suspense + `use()`, which is a separate initiative.
      //   - purity: progress-bar widgets read `Date.now()` during render; a `setInterval`
      //     drives re-renders so the impurity is intentional, not a bug.
      //   - refs: the Tweaks dev panel keeps drag position in refs to avoid re-rendering
      //     on every mousemove tick.
      // Until the codebase is React Compiler-ready, these rules are off project-wide
      // rather than scattered through ~40 inline disable comments.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      // The TypeScript migration introduced `any` in places where we don't yet have
      // proper API response interfaces (Map<any,any> in data hooks, the route shape
      // in FabRoot, etc.). Until we write those interfaces, surface the debt as a
      // warning rather than blocking the lint gate.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow underscore-prefixed destructured names for props that exist for API
      // shape only (e.g. router-provided props the component does not yet consume).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]);

export default eslintConfig;
