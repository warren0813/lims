import { vi } from 'vitest';

// Reusable next/navigation mock for the two routing-aware components
// (DispatchResultsReport, RequestStatisticsReport) and any future ones.
//
// Usage — vi.mock factories are hoisted, so build the spies with vi.hoisted:
//
//   const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
//   vi.mock('next/navigation', () => navigationModule(router, { pathname: '/manager/reports' }));
//
// then assert on router.push etc. inside your test.

export type RouterStub = {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
};

export function routerStub(overrides: Partial<RouterStub> = {}): RouterStub {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    ...overrides,
  };
}

export function navigationModule(
  router: Partial<RouterStub> = routerStub(),
  { pathname = '/', searchParams = new URLSearchParams() }: { pathname?: string; searchParams?: URLSearchParams } = {},
) {
  return {
    useRouter: () => router,
    usePathname: () => pathname,
    useSearchParams: () => searchParams,
  };
}
