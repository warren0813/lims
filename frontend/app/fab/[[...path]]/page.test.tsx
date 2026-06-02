import { test, expect, vi } from 'vitest';
import { Suspense } from 'react';
import { renderWithProviders, screen, act } from '@/test/render';

// Routing shell: assert that each URL path segment selects the right screen.
// Mock next/navigation (the shell binds router.push) and stub every child so
// the test exercises only the path → component dispatch, not the screens.
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/fab',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/Fab/FabDashboard', () => ({
  default: () => <div data-testid="fab-dashboard" />,
}));
vi.mock('@/components/Fab/FabRequestList', () => ({
  default: (props: { drafts?: boolean; initialTab?: string; titleOverride?: string }) => (
    <div
      data-testid="fab-request-list"
      data-drafts={String(!!props.drafts)}
      data-tab={props.initialTab ?? ''}
      data-title={props.titleOverride ?? ''}
    />
  ),
}));
vi.mock('@/components/Fab/FabNewRequest', () => ({
  default: () => <div data-testid="fab-new-request" />,
}));
vi.mock('@/components/Fab/FabDraftEdit', () => ({
  default: (props: { id: number }) => <div data-testid="fab-draft-edit" data-id={props.id} />,
}));
vi.mock('@/components/Fab/FabRequestDetail', () => ({
  default: (props: { id: number }) => <div data-testid="fab-request-detail" data-id={props.id} />,
}));

import FabPage from './page';

// The shell unwraps `params` with React 19's `use()`, which suspends on first
// render. Drive the render inside an awaited `act` so the resolved params flush
// before we query — otherwise React warns and the Suspense fallback sticks.
async function renderAt(path?: string[]) {
  await act(async () => {
    renderWithProviders(
      <Suspense fallback={null}>
        <FabPage params={Promise.resolve({ path })} />
      </Suspense>,
    );
  });
}

test('renders the dashboard at the section root', async () => {
  await renderAt([]);
  expect(screen.getByTestId('fab-dashboard')).toBeInTheDocument();
});

test('renders the dashboard for the explicit dashboard segment', async () => {
  await renderAt(['dashboard']);
  expect(screen.getByTestId('fab-dashboard')).toBeInTheDocument();
});

test('renders the request list (tab defaults to all) at /requests', async () => {
  await renderAt(['requests']);
  const list = screen.getByTestId('fab-request-list');
  expect(list).toHaveAttribute('data-drafts', 'false');
  expect(list).toHaveAttribute('data-tab', 'all');
});

test('renders the new-request form at /requests/new', async () => {
  await renderAt(['requests', 'new']);
  expect(screen.getByTestId('fab-new-request')).toBeInTheDocument();
});

test('renders the request detail with the numeric id at /requests/:id', async () => {
  await renderAt(['requests', '42']);
  expect(screen.getByTestId('fab-request-detail')).toHaveAttribute('data-id', '42');
});

test('renders the drafts list at /drafts', async () => {
  await renderAt(['drafts']);
  const list = screen.getByTestId('fab-request-list');
  expect(list).toHaveAttribute('data-drafts', 'true');
  expect(list).toHaveAttribute('data-title', 'Drafts');
});

test('renders the draft editor with the numeric id at /drafts/:id', async () => {
  await renderAt(['drafts', '7']);
  expect(screen.getByTestId('fab-draft-edit')).toHaveAttribute('data-id', '7');
});

test('falls back to the dashboard for an unknown segment', async () => {
  await renderAt(['nope']);
  expect(screen.getByTestId('fab-dashboard')).toBeInTheDocument();
});
