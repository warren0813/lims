import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabWipList reads useLabWips -> { wips, loading, error, refresh }. It renders
// loading / error / list / empty states, Active/Completed/All tabs, and a row
// per WIP that navigates to its detail on click. The New WIP button opens
// WipCreationModal (mocked to a testid div — it fetches experiment types). The
// hook and api are mocked; Page / Pill / Card render for real.
const hook = vi.hoisted(() => ({
  value: { wips: [], loading: false, error: null, refresh: vi.fn() } as {
    wips: Record<string, unknown>[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
  },
}));
vi.mock('@/components/Lab/hooks/useLabWips', () => ({ default: () => hook.value }));

vi.mock('@/lib/api', () => ({ default: { wips: {} } }));

vi.mock('@/components/Lab/WipCreationModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="wip-creation-modal" /> : null,
}));

import LabWipList from './LabWipList';

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  code: 'WIP-0001',
  status: 'in_progress',
  experimentId: 1,
  experimentName: 'XRD scan',
  sampleCount: 2,
  dispatchCount: 1,
  created: '2026-05-01 09:30',
  note: '',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { wips: [], loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { wips: [], loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<LabWipList navigate={vi.fn()} />);
  // "Loading…" appears in both the subtitle and the body placeholder.
  expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
});

test('surfaces the hook error in a banner', () => {
  hook.value = { wips: [], loading: false, error: 'boom', refresh: vi.fn() };
  renderWithProviders(<LabWipList navigate={vi.fn()} />);
  expect(screen.getByText(/Couldn't load WIPs: boom/)).toBeInTheDocument();
});

test('renders a row per WIP once loaded', () => {
  hook.value.wips = [
    row({ id: 1, code: 'WIP-0001', experimentName: 'XRD scan' }),
    row({ id: 2, code: 'WIP-0002', experimentName: 'SEM imaging' }),
  ];
  renderWithProviders(<LabWipList navigate={vi.fn()} />);
  expect(screen.getByText('WIP-0001')).toBeInTheDocument();
  expect(screen.getByText('WIP-0002')).toBeInTheDocument();
  expect(screen.getByText('XRD scan')).toBeInTheDocument();
  expect(screen.getByText('SEM imaging')).toBeInTheDocument();
});

test('clicking a row navigates to that WIP detail', () => {
  const navigate = vi.fn();
  hook.value.wips = [row({ id: 7, code: 'WIP-0007' })];
  renderWithProviders(<LabWipList navigate={navigate} />);
  fireEvent.click(screen.getByText('WIP-0007'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_wip_detail', id: 7 });
});

test('the Completed tab filters out active WIPs and shows the empty state', () => {
  hook.value.wips = [row({ id: 1, status: 'in_progress' })];
  renderWithProviders(<LabWipList navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Completed/i }));
  expect(screen.getByText('No WIPs in this view')).toBeInTheDocument();
});

test('the Completed tab shows completed WIPs', () => {
  hook.value.wips = [
    row({ id: 1, code: 'WIP-0001', status: 'in_progress' }),
    row({ id: 2, code: 'WIP-0002', status: 'completed' }),
  ];
  renderWithProviders(<LabWipList navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Completed/i }));
  expect(screen.getByText('WIP-0002')).toBeInTheDocument();
  expect(screen.queryByText('WIP-0001')).not.toBeInTheDocument();
});

test('the empty state shows when there are no WIPs at all', () => {
  hook.value.wips = [];
  renderWithProviders(<LabWipList navigate={vi.fn()} />);
  expect(screen.getByText('No WIPs in this view')).toBeInTheDocument();
});

test('New WIP opens the creation modal', () => {
  hook.value.wips = [row()];
  renderWithProviders(<LabWipList navigate={vi.fn()} />);
  expect(screen.queryByTestId('wip-creation-modal')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /New WIP/i }));
  expect(screen.getByTestId('wip-creation-modal')).toBeInTheDocument();
});
