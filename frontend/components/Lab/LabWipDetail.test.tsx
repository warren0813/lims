import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabWipDetail reads useLabWipDetail -> { wip, loading, error, refresh }. It
// renders loading / not-found / populated states, a dispatches table, a samples
// list, and a right-hand action that is either "Abort WIP" (confirm-guarded ->
// api.wips.abort) when an active dispatch exists, or "Create Dispatch" (opens
// AddDispatchModal) otherwise. The hook and api are mocked; AddDispatchModal is
// mocked to a testid div (it fetches recipes/equipment). Everything else renders
// for real.
const hook = vi.hoisted(() => ({
  value: { wip: null, loading: false, error: null, refresh: vi.fn() } as {
    wip: Record<string, unknown> | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
  },
}));
vi.mock('@/components/Lab/hooks/useLabWipDetail', () => ({ default: () => hook.value }));

const abort = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { wips: { abort } } }));

vi.mock('@/components/Lab/AddDispatchModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-dispatch-modal" /> : null,
}));

import LabWipDetail from './LabWipDetail';

const dispatch = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 11,
  code: 'DP-0011',
  experimentId: 1,
  experimentName: 'XRD scan',
  recipeName: 'recipe-a',
  equipmentName: 'EQ-1',
  estimatedDurationSeconds: 3600,
  status: 'running',
  raw_status: 'running',
  ...over,
});

const wip = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  code: 'WIP-0001',
  status: 'in_progress',
  experimentId: 1,
  experimentName: 'XRD scan',
  sampleCount: 2,
  created: '2026-05-01 09:30',
  note: '',
  dispatches: [],
  samples: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { wip: null, loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { wip: null, loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<LabWipDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('surfaces the hook error in the not-found state', () => {
  hook.value = { wip: null, loading: false, error: 'boom', refresh: vi.fn() };
  renderWithProviders(<LabWipDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('WIP not found')).toBeInTheDocument();
  expect(screen.getByText('boom')).toBeInTheDocument();
});

test('renders the WIP code and experiment name once loaded', () => {
  hook.value.wip = wip();
  renderWithProviders(<LabWipDetail id={1} navigate={vi.fn()} />);
  expect(screen.getAllByText('WIP-0001').length).toBeGreaterThan(0);
  expect(screen.getAllByText('XRD scan').length).toBeGreaterThan(0);
});

test('shows the empty dispatches state when there are none', () => {
  hook.value.wip = wip({ dispatches: [] });
  renderWithProviders(<LabWipDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText(/No dispatches yet/)).toBeInTheDocument();
});

test('renders a dispatch row and navigates on Manage', () => {
  const navigate = vi.fn();
  hook.value.wip = wip({ dispatches: [dispatch({ id: 11, code: 'DP-0011' })] });
  renderWithProviders(<LabWipDetail id={1} navigate={navigate} />);
  expect(screen.getByText('DP-0011')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Manage'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_dispatch_detail', id: 11 });
});

test('renders sample rows and navigates to the wafer on click', () => {
  const navigate = vi.fn();
  hook.value.wip = wip({
    samples: [{ id: 5, wafer: 'W-0005', size: '8 inch', status: 'in_wip', requestId: 42 }],
  });
  renderWithProviders(<LabWipDetail id={1} navigate={navigate} />);
  fireEvent.click(screen.getByText('W-0005'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_wafer', id: 5 });
});

test('Abort WIP confirms then calls api.wips.abort and refreshes', async () => {
  const refresh = vi.fn();
  hook.value = {
    wip: wip({ dispatches: [dispatch({ status: 'running', raw_status: 'running' })] }),
    loading: false,
    error: null,
    refresh,
  };
  abort.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<LabWipDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Abort WIP/i }));

  expect(confirmSpy).toHaveBeenCalled();
  expect(abort).toHaveBeenCalledWith(1);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  confirmSpy.mockRestore();
});

test('declining the abort confirmation does not call the api', () => {
  hook.value.wip = wip({ dispatches: [dispatch({ status: 'running', raw_status: 'running' })] });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

  renderWithProviders(<LabWipDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Abort WIP/i }));

  expect(abort).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('Create Dispatch opens the AddDispatchModal when no active dispatch exists', () => {
  hook.value.wip = wip({ dispatches: [dispatch({ status: 'completed', raw_status: 'completed' })] });
  renderWithProviders(<LabWipDetail id={1} navigate={vi.fn()} />);

  expect(screen.queryByTestId('add-dispatch-modal')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Create Dispatch/i }));
  expect(screen.getByTestId('add-dispatch-modal')).toBeInTheDocument();
});

test('an execution-exception dispatch shows the warning banner', () => {
  const navigate = vi.fn();
  hook.value.wip = wip({
    dispatches: [dispatch({ id: 11, code: 'DP-0011', status: 'exception', raw_status: 'execution_exception' })],
  });
  renderWithProviders(<LabWipDetail id={1} navigate={navigate} />);
  expect(screen.getByText(/has an execution exception/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /View Dispatch/i }));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_dispatch_detail', id: 11 });
});
