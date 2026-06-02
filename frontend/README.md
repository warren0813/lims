This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

Unit and component tests run on [Vitest](https://vitest.dev) with
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
under jsdom (the setup Next.js officially recommends).

```bash
npm test           # run the suite once
npm run test:watch # watch mode
npm run coverage    # run with a V8 coverage report + thresholds
```

Conventions:

- **Colocate** tests next to the code: `Button.tsx` → `Button.test.tsx`,
  `addDays.ts` → `addDays.test.ts`. Vitest discovers `**/*.test.{ts,tsx}`
  under `components/` and `lib/`.
- Import the Testing Library surface from `@/test/render` and render with
  `renderWithProviders` — it wraps components in app-wide providers (currently a
  passthrough; new providers plug in there once and every test inherits them).
- Use explicit `import { test, expect, vi } from 'vitest'` (no globals). The
  jest-dom matchers (`toBeInTheDocument`, …) are registered in `vitest.setup.ts`.
- For the two routing-aware components, mock `next/navigation` with the helpers
  in `test/mocks/nextNavigation.ts`.

### Coverage thresholds are a ratchet

`vitest.config.mts` enforces coverage **floors**, not the target. The global
floor sits at ~31% lines: utils, `lib/`, the `ui/` + pill components, the
`app/` route pages, every data hook, and the `lib/api` client are covered; the
large screen components, layouts, and the API proxy route are not yet. The goal
is **80%** — raise the floor numbers as coverage climbs, and never lower them.
Pure utils are locked at ≥95% and the `lib/api` client at ≥90%.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
