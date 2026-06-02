import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabSamples reads useLabSamples ({ wafers, loading, error, refresh }) and
// renders tabbed wafer rows with Receive/Reject actions on incoming wafers.
// Mock the hook to a controlled value and the two api action methods; the
// Page wrapper, pills, deadline utils and icons are presentational (real).
type SamplesValue = {
  wafers: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};
const empty = (): SamplesValue => ({ wafers: [], loading: false, error: null, refresh: vi.fn() });
const hook = vi.hoisted(() => ({ value: null as unknown as SamplesValue }));
vi.mock('@/components/Lab/hooks/useLabSamples', () => ({ default: () => hook.value }));

const receive = vi.hoisted(() => vi.fn());
const rejectReceiving = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { samples: { receive, rejectReceiving } } }));

import LabSamples from './LabSamples';

const wafer = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  wafer: 'W-001',
  size: '8in',
  requestId: 12,
  status: 'received',
  urgency: '1w',
  arrivedAt: '2026-05-01 09:30',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = empty();
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { ...empty(), loading: true };
  renderWithProviders(<LabSamples navigate={vi.fn()} />);
  // "Loading…" renders as both the Page subtitle and the body placeholder.
  expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
});

test('surfaces the hook error in a banner', () => {
  hook.value = { ...empty(), error: 'boom' };
  renderWithProviders(<LabSamples navigate={vi.fn()} />);
  expect(screen.getByText('boom')).toBeInTheDocument();
});

test('renders a row per wafer once loaded', () => {
  hook.value = { ...empty(), wafers: [wafer({ id: 1, wafer: 'W-001' }), wafer({ id: 2, wafer: 'W-002' })] };
  renderWithProviders(<LabSamples navigate={vi.fn()} />);
  expect(screen.getByText('W-001')).toBeInTheDocument();
  expect(screen.getByText('W-002')).toBeInTheDocument();
});

test('clicking a wafer row navigates to that wafer detail', () => {
  const navigate = vi.fn();
  hook.value = { ...empty(), wafers: [wafer({ id: 7, wafer: 'W-007' })] };
  renderWithProviders(<LabSamples navigate={navigate} />);
  fireEvent.click(screen.getByText('W-007'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_wafer', id: 7 });
});

test('switching to a tab with no matching wafers shows the empty-state card', () => {
  hook.value = { ...empty(), wafers: [wafer({ status: 'received' })] };
  renderWithProviders(<LabSamples navigate={vi.fn()} />);
  fireEvent.click(screen.getByText('Rejected'));
  expect(screen.getByText('No wafers in this view')).toBeInTheDocument();
});

test('defaultTab pre-selects a non-default view', () => {
  hook.value = {
    ...empty(),
    wafers: [wafer({ id: 1, wafer: 'IN-1', status: 'incoming' }), wafer({ id: 2, wafer: 'REC-2', status: 'received' })],
  };
  renderWithProviders(<LabSamples navigate={vi.fn()} defaultTab="incoming" />);
  expect(screen.getByText('IN-1')).toBeInTheDocument();
  expect(screen.queryByText('REC-2')).not.toBeInTheDocument();
});

test('Receive action calls api.samples.receive, toasts and refreshes', async () => {
  const refresh = vi.fn();
  const showToast = vi.fn();
  receive.mockResolvedValue(null);
  hook.value = {
    ...empty(),
    wafers: [wafer({ id: 4, wafer: 'W-004', status: 'incoming' })],
    refresh,
  };
  renderWithProviders(<LabSamples navigate={vi.fn()} showToast={showToast} />);
  fireEvent.click(screen.getByText('Receive'));
  expect(receive).toHaveBeenCalledWith(4);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(showToast).toHaveBeenCalledWith('W-004 received');
});

test('Reject action calls api.samples.rejectReceiving', async () => {
  const refresh = vi.fn();
  rejectReceiving.mockResolvedValue(null);
  hook.value = {
    ...empty(),
    wafers: [wafer({ id: 8, wafer: 'W-008', status: 'incoming' })],
    refresh,
  };
  renderWithProviders(<LabSamples navigate={vi.fn()} />);
  fireEvent.click(screen.getByText('Reject'));
  expect(rejectReceiving).toHaveBeenCalledWith(8, '');
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
});
