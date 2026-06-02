import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabDispatchList reads useLabDispatches ({ dispatches, loading, error }) and
// renders tabbed dispatch rows grouped by status. Mock the hook to a controlled
// value; the Page wrapper, pills, findExp/formatDuration utils and icons are
// presentational and render for real. No user-action api calls in this screen.
type DispatchesValue = {
  dispatches: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};
const empty = (): DispatchesValue => ({ dispatches: [], loading: false, error: null, refresh: vi.fn() });
const hook = vi.hoisted(() => ({ value: null as unknown as DispatchesValue }));
vi.mock('@/components/Lab/hooks/useLabDispatches', () => ({ default: () => hook.value }));

vi.mock('@/lib/api', () => ({ default: {} }));

import LabDispatchList from './LabDispatchList';

const dispatch = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  code: 'DSP-0001',
  status: 'running',
  experimentId: 99,
  experimentName: 'Thermal cycling',
  equipmentName: 'OVEN-01',
  operator: 'alice',
  wipId: 12,
  estimatedDurationSeconds: 3600,
  dispatchedAt: null,
  dispatchedAtIso: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = empty();
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { ...empty(), loading: true };
  renderWithProviders(<LabDispatchList navigate={vi.fn()} />);
  // "Loading…" renders as both the Page subtitle and the body placeholder.
  expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
});

test('surfaces the hook error in a banner', () => {
  hook.value = { ...empty(), error: 'boom' };
  renderWithProviders(<LabDispatchList navigate={vi.fn()} />);
  expect(screen.getByText(/Couldn.t load dispatches: boom/)).toBeInTheDocument();
});

test('renders a row per dispatch in the active tab once loaded', () => {
  hook.value = {
    ...empty(),
    dispatches: [
      dispatch({ id: 1, code: 'DSP-0001', status: 'running' }),
      dispatch({ id: 2, code: 'DSP-0002', status: 'pending' }),
    ],
  };
  renderWithProviders(<LabDispatchList navigate={vi.fn()} />);
  expect(screen.getByText('DSP-0001')).toBeInTheDocument();
  expect(screen.getByText('DSP-0002')).toBeInTheDocument();
});

test('clicking a dispatch row navigates to its detail', () => {
  const navigate = vi.fn();
  hook.value = { ...empty(), dispatches: [dispatch({ id: 7, code: 'DSP-0007' })] };
  renderWithProviders(<LabDispatchList navigate={navigate} />);
  fireEvent.click(screen.getByText('DSP-0007'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_dispatch_detail', id: 7 });
});

test('default active tab hides closed dispatches; switching to Closed reveals them', () => {
  hook.value = {
    ...empty(),
    dispatches: [
      dispatch({ id: 1, code: 'ACTIVE-1', status: 'running' }),
      dispatch({ id: 2, code: 'DONE-2', status: 'completed' }),
    ],
  };
  renderWithProviders(<LabDispatchList navigate={vi.fn()} />);
  expect(screen.getByText('ACTIVE-1')).toBeInTheDocument();
  expect(screen.queryByText('DONE-2')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Closed'));
  expect(screen.getByText('DONE-2')).toBeInTheDocument();
  expect(screen.queryByText('ACTIVE-1')).not.toBeInTheDocument();
});

test('defaultTab pre-selects the Needs Result view', () => {
  hook.value = {
    ...empty(),
    dispatches: [dispatch({ id: 3, code: 'REC-3', status: 'unloaded' })],
  };
  renderWithProviders(<LabDispatchList navigate={vi.fn()} defaultTab="record" />);
  expect(screen.getByText('REC-3')).toBeInTheDocument();
});

test('shows the empty-state card when a tab has no dispatches', () => {
  hook.value = { ...empty(), dispatches: [dispatch({ status: 'completed' })] };
  renderWithProviders(<LabDispatchList navigate={vi.fn()} />);
  // Default "active" tab matches none of the completed dispatches.
  expect(screen.getByText('No dispatches')).toBeInTheDocument();
});
