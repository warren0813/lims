import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabWaferDetail reads useWaferDetail -> { data, loading, error, refresh } where
// `data` is { sample, request, wip, experiments }. It renders loading / error /
// populated states, a lifecycle timeline, and (for incoming wafers) Receive /
// Reject actions that call api.samples.* then refresh(). The data hook,
// useLabExperimentTypes, and the api default are mocked; presentational
// children (Page, Pill, Card, buttons) render for real.
const hook = vi.hoisted(() => ({
  value: { data: null, loading: false, error: null, refresh: vi.fn() } as {
    data: Record<string, unknown> | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
  },
}));
vi.mock('@/components/Lab/hooks/useWaferDetail', () => ({ default: () => hook.value }));
vi.mock('@/components/Lab/hooks/useLabExperimentTypes', () => ({
  default: (): { data: unknown[]; loading: boolean; error: string | null } => ({
    data: [],
    loading: false,
    error: null,
  }),
}));

const receive = vi.hoisted(() => vi.fn());
const rejectReceiving = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { samples: { receive, rejectReceiving } } }));

import LabWaferDetail from './LabWaferDetail';

const sample = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  wafer: 'W-0001',
  size: '8 inch',
  status: 'incoming',
  requestId: 42,
  arrivedAt: '2026-05-01 09:30',
  ...over,
});

const data = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  sample: sample(),
  request: { title: 'Batch A', urgency: '1w' },
  wip: null,
  experiments: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: null, loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { data: null, loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('surfaces the hook error in the not-found state', () => {
  hook.value = { data: null, loading: false, error: 'boom', refresh: vi.fn() };
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('Wafer not found')).toBeInTheDocument();
  expect(screen.getByText('boom')).toBeInTheDocument();
});

test('renders the wafer id, size, and request title once loaded', () => {
  hook.value.data = data();
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} />);
  expect(screen.getAllByText('W-0001').length).toBeGreaterThan(0);
  expect(screen.getByText('8 inch')).toBeInTheDocument();
  expect(screen.getByText(/#0042 — Batch A/)).toBeInTheDocument();
});

test('lists experiments with a done count when present', () => {
  hook.value.data = data({
    experiments: [
      { experimentTypeId: 1, experimentName: 'XRD scan', status: 'done', verdict: 'pass', dispatchId: 5, result: null },
      { experimentTypeId: 2, experimentName: 'SEM imaging', status: 'pending', verdict: null, dispatchId: null, result: null },
    ],
  });
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} />);
  expect(screen.getByText('XRD scan')).toBeInTheDocument();
  expect(screen.getByText('SEM imaging')).toBeInTheDocument();
  expect(screen.getByText('1/2 DONE')).toBeInTheDocument();
});

test('clicking a dispatch-linked experiment navigates to that dispatch', () => {
  const navigate = vi.fn();
  hook.value.data = data({
    experiments: [
      { experimentTypeId: 1, experimentName: 'XRD scan', status: 'running', verdict: null, dispatchId: 9, result: null },
    ],
  });
  renderWithProviders(<LabWaferDetail id={1} navigate={navigate} />);
  fireEvent.click(screen.getByText('XRD scan'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_dispatch_detail', id: 9 });
});

test('incoming wafer receive action calls api.samples.receive then refreshes', async () => {
  const refresh = vi.fn();
  const showToast = vi.fn();
  hook.value = { data: data(), loading: false, error: null, refresh };
  receive.mockResolvedValue(null);
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} showToast={showToast} />);

  fireEvent.click(screen.getByRole('button', { name: /Receive/i }));
  expect(receive).toHaveBeenCalledWith(1);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(showToast).toHaveBeenCalledWith('W-0001 received');
});

test('incoming wafer reject action calls api.samples.rejectReceiving then refreshes', async () => {
  const refresh = vi.fn();
  hook.value = { data: data(), loading: false, error: null, refresh };
  rejectReceiving.mockResolvedValue(null);
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
  expect(rejectReceiving).toHaveBeenCalledWith(1, '');
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
});

test('surfaces an action error when the api call rejects', async () => {
  hook.value = { data: data(), loading: false, error: null, refresh: vi.fn() };
  receive.mockRejectedValue(new Error('server said no'));
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /Receive/i }));
  expect(await screen.findByText('server said no')).toBeInTheDocument();
});

test('a current WIP card links through to the WIP detail', () => {
  const navigate = vi.fn();
  hook.value.data = data({
    sample: sample({ status: 'in_wip' }),
    wip: { id: 7, code: 'WIP-0007', experimentName: 'XRD scan', status: 'in_progress', dispatches: [] },
  });
  renderWithProviders(<LabWaferDetail id={1} navigate={navigate} />);
  fireEvent.click(screen.getByText('WIP-0007'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_wip_detail', id: 7 });
});

test('a non-incoming wafer shows no Receive/Reject actions', () => {
  hook.value.data = data({ sample: sample({ status: 'completed' }) });
  renderWithProviders(<LabWaferDetail id={1} navigate={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Receive/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
});
