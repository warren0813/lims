import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabDispatchDetail reads useLabDispatchDetail -> { dispatch, waferResults,
// loading, error, refresh }. It renders loading / not-found / populated states,
// a lifecycle stepper, dispatch info, recipe params, recorded results, and a
// status-dependent action bar:
//   dispatched/pending -> Abort (confirm) + Start Running (confirm)
//   running            -> Mark Exception (opens Modal) + Mark Unloaded (confirm)
//   unloaded           -> Record Result (opens RecordResultModal)
//   exception          -> Abort Dispatch + Redispatch (confirm)
// Each confirmed action calls the matching api.dispatches.* then refresh().
// The hook and api are mocked; RecordResultModal is mocked to a testid div.
// The inline exception Modal / TextArea render for real. This component is large
// (~775 lines); these tests cover its main branches, not 100%.
const hook = vi.hoisted(() => ({
  value: {
    dispatch: null,
    waferResults: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  } as {
    dispatch: Record<string, unknown> | null;
    waferResults: Record<string, unknown>[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
  },
}));
vi.mock('@/components/Lab/hooks/useLabDispatchDetail', () => ({ default: () => hook.value }));

const start = vi.hoisted(() => vi.fn());
const abort = vi.hoisted(() => vi.fn());
const unload = vi.hoisted(() => vi.fn());
const redispatch = vi.hoisted(() => vi.fn());
const reportException = vi.hoisted(() => vi.fn());
const recordResult = vi.hoisted(() => vi.fn());
const autoComplete = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    dispatches: { start, abort, unload, redispatch, reportException, recordResult, autoComplete },
  },
}));

vi.mock('@/components/Lab/RecordResultModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="record-result-modal" /> : null,
}));

import LabDispatchDetail from './LabDispatchDetail';

const dispatch = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  code: 'DP-0001',
  status: 'dispatched',
  raw_status: 'dispatched',
  wipId: 7,
  experimentName: 'XRD scan',
  equipmentName: 'EQ-1',
  recipeName: 'recipe-a',
  recipeParams: { temperature: '200C', duration: '30m' },
  operator: 'alice',
  estimatedDurationSeconds: 3600,
  dispatchedAt: '2026-05-01 09:30:00',
  dispatchedAtIso: null,
  autoCompleteAtIso: null,
  completedAt: '',
  note: '',
  result: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { dispatch: null, waferResults: [], loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { dispatch: null, waferResults: [], loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('surfaces the hook error in the not-found state', () => {
  hook.value = { dispatch: null, waferResults: [], loading: false, error: 'boom', refresh: vi.fn() };
  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('Dispatch not found')).toBeInTheDocument();
  expect(screen.getByText('boom')).toBeInTheDocument();
});

test('renders the dispatch code, experiment, equipment, and recipe params once loaded', () => {
  hook.value.dispatch = dispatch();
  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('Dispatch DP-0001')).toBeInTheDocument();
  expect(screen.getAllByText('XRD scan').length).toBeGreaterThan(0);
  expect(screen.getAllByText('EQ-1').length).toBeGreaterThan(0);
  expect(screen.getByText('temperature')).toBeInTheDocument();
  expect(screen.getByText('200C')).toBeInTheDocument();
});

test('the WIP breadcrumb/link derives WIP-#### and navigates', () => {
  const navigate = vi.fn();
  hook.value.dispatch = dispatch({ wipId: 7 });
  renderWithProviders(<LabDispatchDetail id={1} navigate={navigate} />);
  const wipLinks = screen.getAllByText('WIP-0007');
  expect(wipLinks.length).toBeGreaterThan(0);
  fireEvent.click(wipLinks[0]);
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_wip_detail', id: 7 });
});

test('a dispatched dispatch can be started after confirmation', async () => {
  const refresh = vi.fn();
  hook.value = { dispatch: dispatch({ status: 'dispatched' }), waferResults: [], loading: false, error: null, refresh };
  start.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Start Running/i }));

  expect(confirmSpy).toHaveBeenCalled();
  expect(start).toHaveBeenCalledWith(1);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  confirmSpy.mockRestore();
});

test('declining the start confirmation does not call the api', () => {
  hook.value.dispatch = dispatch({ status: 'dispatched' });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Start Running/i }));

  expect(start).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('a dispatched dispatch can be aborted after confirmation', async () => {
  const refresh = vi.fn();
  hook.value = { dispatch: dispatch({ status: 'dispatched' }), waferResults: [], loading: false, error: null, refresh };
  abort.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /^Abort$/i }));

  expect(abort).toHaveBeenCalledWith(1);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  confirmSpy.mockRestore();
});

test('a running dispatch can be marked unloaded after confirmation', async () => {
  const refresh = vi.fn();
  hook.value = { dispatch: dispatch({ status: 'running' }), waferResults: [], loading: false, error: null, refresh };
  unload.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Mark Unloaded/i }));

  expect(unload).toHaveBeenCalledWith(1);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  confirmSpy.mockRestore();
});

test('a running dispatch opens the exception modal and reports the exception', async () => {
  const refresh = vi.fn();
  hook.value = { dispatch: dispatch({ status: 'running' }), waferResults: [], loading: false, error: null, refresh };
  reportException.mockResolvedValue(null);

  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Mark Exception/i }));

  const textarea = screen.getByPlaceholderText(/Equipment malfunction/i);
  fireEvent.change(textarea, { target: { value: 'temp spike' } });
  fireEvent.click(screen.getByRole('button', { name: /Confirm Exception/i }));

  expect(reportException).toHaveBeenCalledWith(1, 'temp spike');
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
});

test('an unloaded dispatch opens the Record Result modal', () => {
  hook.value.dispatch = dispatch({ status: 'unloaded' });
  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);

  expect(screen.queryByTestId('record-result-modal')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Record Result/i }));
  expect(screen.getByTestId('record-result-modal')).toBeInTheDocument();
});

test('an execution-exception dispatch can be redispatched after confirmation', async () => {
  const refresh = vi.fn();
  hook.value = {
    dispatch: dispatch({ status: 'exception', raw_status: 'execution_exception' }),
    waferResults: [],
    loading: false,
    error: null,
    refresh,
  };
  redispatch.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Redispatch/i }));

  expect(redispatch).toHaveBeenCalledWith(1);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  confirmSpy.mockRestore();
});

test('renders per-wafer results when present', () => {
  hook.value = {
    dispatch: dispatch({ status: 'completed', result: { comment: 'looks good', recordedAt: '2026-05-02 10:00' } }),
    waferResults: [
      { sampleId: 1, wafer: 'W-0001', size: '8 inch', verdict: 'pass', status: 'done' },
      { sampleId: 2, wafer: 'W-0002', size: '8 inch', verdict: 'fail', status: 'done' },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('looks good')).toBeInTheDocument();
  expect(screen.getByText('W-0001')).toBeInTheDocument();
  expect(screen.getByText('W-0002')).toBeInTheDocument();
  expect(screen.getByText('Per-Wafer Results (2)')).toBeInTheDocument();
});

test('surfaces an action error when the api call rejects', async () => {
  hook.value = { dispatch: dispatch({ status: 'dispatched' }), waferResults: [], loading: false, error: null, refresh: vi.fn() };
  start.mockRejectedValue(new Error('server said no'));
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<LabDispatchDetail id={1} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Start Running/i }));

  expect(await screen.findByText('server said no')).toBeInTheDocument();
  confirmSpy.mockRestore();
});
