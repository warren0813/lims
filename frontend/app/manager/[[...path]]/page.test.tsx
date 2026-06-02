import { test, expect, vi } from 'vitest';
import { Suspense } from 'react';
import { renderWithProviders, screen, act } from '@/test/render';

// Routing shell: assert that each URL path segment selects the right screen.
// Mock next/navigation (the shell binds router.push) and stub every child so
// the test exercises only the path → component dispatch, not the screens.
// This is the manager shell, which also nests the lab screens under
// /manager/lab/* — there the lab components are reused with canManage=true.
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
  usePathname: () => '/manager',
  useSearchParams: () => new URLSearchParams(),
}));

// Manager screens.
vi.mock('@/components/Manager/MgrDashboard', () => ({
  default: () => <div data-testid="mgr-dashboard" />,
}));
vi.mock('@/components/Manager/MgrAllRequests', () => ({
  default: () => <div data-testid="mgr-all-requests" />,
}));
vi.mock('@/components/Manager/MgrRequestDetail', () => ({
  default: (props: { id: number }) => (
    <div data-testid="mgr-request-detail" data-id={props.id} />
  ),
}));
vi.mock('@/components/Manager/MgrRecipes', () => ({
  default: () => <div data-testid="mgr-recipes" />,
}));
vi.mock('@/components/Manager/MgrReports', () => ({
  default: () => <div data-testid="mgr-reports" />,
}));

// Lab screens, reused inside the manager shell under /manager/lab/*.
vi.mock('@/components/Lab/LabDashboard', () => ({
  default: () => <div data-testid="lab-dashboard" />,
}));
vi.mock('@/components/Lab/LabSamples', () => ({
  default: () => <div data-testid="lab-samples" />,
}));
vi.mock('@/components/Lab/LabWaferDetail', () => ({
  default: (props: { id: number }) => (
    <div data-testid="lab-wafer-detail" data-id={props.id} />
  ),
}));
vi.mock('@/components/Lab/LabWipList', () => ({
  default: () => <div data-testid="lab-wip-list" />,
}));
vi.mock('@/components/Lab/LabWipDetail', () => ({
  default: (props: { id: number }) => (
    <div data-testid="lab-wip-detail" data-id={props.id} />
  ),
}));
vi.mock('@/components/Lab/LabDispatchList', () => ({
  default: () => <div data-testid="lab-dispatch-list" />,
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

import ManagerPage from './page';

// The shell unwraps `params` with React 19's `use()`, which suspends on first
// render. Drive the render inside an awaited `act` so the resolved params flush
// before we query — otherwise React warns and the Suspense fallback sticks.
async function renderAt(path?: string[]) {
  await act(async () => {
    renderWithProviders(
      <Suspense fallback={null}>
        <ManagerPage params={Promise.resolve({ path })} />
      </Suspense>,
    );
  });
}

// --- Manager branch -------------------------------------------------------

test('renders the manager dashboard at the section root', async () => {
  await renderAt([]);
  expect(screen.getByTestId('mgr-dashboard')).toBeInTheDocument();
});

test('renders the manager dashboard for the explicit dashboard segment', async () => {
  await renderAt(['dashboard']);
  expect(screen.getByTestId('mgr-dashboard')).toBeInTheDocument();
});

test('renders the all-requests list at /requests', async () => {
  await renderAt(['requests']);
  expect(screen.getByTestId('mgr-all-requests')).toBeInTheDocument();
});

test('renders the request detail with the numeric id at /requests/:id', async () => {
  await renderAt(['requests', '3']);
  expect(screen.getByTestId('mgr-request-detail')).toHaveAttribute('data-id', '3');
});

test('renders the recipes screen at /recipes', async () => {
  await renderAt(['recipes']);
  expect(screen.getByTestId('mgr-recipes')).toBeInTheDocument();
});

test('renders the reports screen at /reports', async () => {
  await renderAt(['reports']);
  expect(screen.getByTestId('mgr-reports')).toBeInTheDocument();
});

test('falls back to the manager dashboard for an unknown segment', async () => {
  await renderAt(['nope']);
  expect(screen.getByTestId('mgr-dashboard')).toBeInTheDocument();
});

// --- Nested lab branch (/manager/lab/*) -----------------------------------
// The leading 'lab' segment shifts ids one slot right, so detail ids come
// from seg2 (the 3rd path segment).

test('renders the lab dashboard at /lab', async () => {
  await renderAt(['lab']);
  expect(screen.getByTestId('lab-dashboard')).toBeInTheDocument();
});

test('renders the lab dashboard for the explicit /lab/dashboard segment', async () => {
  await renderAt(['lab', 'dashboard']);
  expect(screen.getByTestId('lab-dashboard')).toBeInTheDocument();
});

test('renders the lab samples list at /lab/samples', async () => {
  await renderAt(['lab', 'samples']);
  expect(screen.getByTestId('lab-samples')).toBeInTheDocument();
});

test('renders the lab wafer detail with the numeric id at /lab/samples/:id', async () => {
  await renderAt(['lab', 'samples', '12']);
  expect(screen.getByTestId('lab-wafer-detail')).toHaveAttribute('data-id', '12');
});

test('renders the lab WIP detail with the numeric id at /lab/wips/:id', async () => {
  await renderAt(['lab', 'wips', '5']);
  expect(screen.getByTestId('lab-wip-detail')).toHaveAttribute('data-id', '5');
});

test('renders the lab dispatch list at /lab/dispatches', async () => {
  await renderAt(['lab', 'dispatches']);
  expect(screen.getByTestId('lab-dispatch-list')).toBeInTheDocument();
});

test('renders the lab equipment screen with canManage=true at /lab/equipment', async () => {
  await renderAt(['lab', 'equipment']);
  expect(screen.getByTestId('lab-equipment')).toHaveAttribute('data-can-manage', 'true');
});
