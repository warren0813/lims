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
  usePathname: () => '/lab',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/Lab/LabDashboard', () => ({
  default: () => <div data-testid="lab-dashboard" />,
}));
vi.mock('@/components/Lab/LabSamples', () => ({
  default: (props: { defaultTab?: string }) => (
    <div data-testid="lab-samples" data-tab={props.defaultTab ?? ''} />
  ),
}));
vi.mock('@/components/Lab/LabWaferDetail', () => ({
  default: (props: { id: number }) => <div data-testid="lab-wafer-detail" data-id={props.id} />,
}));
vi.mock('@/components/Lab/LabWipList', () => ({
  default: () => <div data-testid="lab-wip-list" />,
}));
vi.mock('@/components/Lab/LabWipDetail', () => ({
  default: (props: { id: number }) => <div data-testid="lab-wip-detail" data-id={props.id} />,
}));
vi.mock('@/components/Lab/LabDispatchList', () => ({
  default: (props: { defaultTab?: string }) => (
    <div data-testid="lab-dispatch-list" data-tab={props.defaultTab ?? ''} />
  ),
}));
vi.mock('@/components/Lab/LabDispatchDetail', () => ({
  default: (props: { id: number }) => (
    <div data-testid="lab-dispatch-detail" data-id={props.id} />
  ),
}));
vi.mock('@/components/Lab/LabEquipment', () => ({
  default: (props: { canManage?: boolean }) => (
    <div data-testid="lab-equipment" data-can-manage={String(props.canManage)} />
  ),
}));

import LabPage from './page';

// The shell unwraps `params` with React 19's `use()`, which suspends on first
// render. Drive the render inside an awaited `act` so the resolved params flush
// before we query — otherwise React warns and the Suspense fallback sticks.
async function renderAt(path?: string[]) {
  await act(async () => {
    renderWithProviders(
      <Suspense fallback={null}>
        <LabPage params={Promise.resolve({ path })} />
      </Suspense>,
    );
  });
}

test('renders the dashboard at the section root', async () => {
  await renderAt([]);
  expect(screen.getByTestId('lab-dashboard')).toBeInTheDocument();
});

test('renders the dashboard for the explicit dashboard segment', async () => {
  await renderAt(['dashboard']);
  expect(screen.getByTestId('lab-dashboard')).toBeInTheDocument();
});

test('renders the samples list (tab defaults to all) at /samples', async () => {
  await renderAt(['samples']);
  expect(screen.getByTestId('lab-samples')).toHaveAttribute('data-tab', 'all');
});

test('renders the wafer detail with the numeric id at /samples/:id', async () => {
  await renderAt(['samples', '12']);
  expect(screen.getByTestId('lab-wafer-detail')).toHaveAttribute('data-id', '12');
});

test('renders the WIP list at /wips', async () => {
  await renderAt(['wips']);
  expect(screen.getByTestId('lab-wip-list')).toBeInTheDocument();
});

test('renders the WIP detail with the numeric id at /wips/:id', async () => {
  await renderAt(['wips', '5']);
  expect(screen.getByTestId('lab-wip-detail')).toHaveAttribute('data-id', '5');
});

test('renders the dispatch list (tab defaults to active) at /dispatches', async () => {
  await renderAt(['dispatches']);
  expect(screen.getByTestId('lab-dispatch-list')).toHaveAttribute('data-tab', 'active');
});

test('renders the dispatch detail with the numeric id at /dispatches/:id', async () => {
  await renderAt(['dispatches', '9']);
  expect(screen.getByTestId('lab-dispatch-detail')).toHaveAttribute('data-id', '9');
});

test('renders the equipment screen with canManage=false at /equipment', async () => {
  await renderAt(['equipment']);
  expect(screen.getByTestId('lab-equipment')).toHaveAttribute('data-can-manage', 'false');
});

test('falls back to the dashboard for an unknown segment', async () => {
  await renderAt(['nope']);
  expect(screen.getByTestId('lab-dashboard')).toBeInTheDocument();
});
