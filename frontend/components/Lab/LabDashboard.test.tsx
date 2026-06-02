import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabDashboard reads useLabDashboardData (samples/wips/dispatches/equipment +
// loading/error) and renders tiles, a "Now Running" list, an "Awaiting Your
// Result" card, and an equipment column. Mock the hook to a controlled value;
// the Page wrapper, cards, pills and icons are presentational and render real.
type DashboardValue = {
  samples: Record<string, unknown>[];
  wips: Record<string, unknown>[];
  dispatches: Record<string, unknown>[];
  equipment: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};
const empty = (): DashboardValue => ({
  samples: [],
  wips: [],
  dispatches: [],
  equipment: [],
  loading: false,
  error: null,
  refresh: vi.fn(),
});
const hook = vi.hoisted(() => ({ value: null as unknown as DashboardValue }));
vi.mock('@/components/Lab/hooks/useLabDashboardData', () => ({ default: () => hook.value }));

// api.auth.cachedUser drives the subtitle; stub it so no real client loads.
const cachedUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { auth: { cachedUser } } }));

import LabDashboard from './LabDashboard';

const dispatch = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  code: 'DSP-0001',
  status: 'running',
  experimentName: 'Thermal cycling',
  equipmentName: 'OVEN-01',
  equipmentId: 10,
  estimatedDurationSeconds: 0,
  dispatchedAtIso: null,
  ...over,
});

const equipmentRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 10,
  name: 'OVEN-01',
  status: 'idle',
  capacity: 4,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = empty();
  cachedUser.mockReturnValue({ username: 'alice' });
});

test('shows em-dash tile values while the first fetch is in flight', () => {
  hook.value = { ...empty(), loading: true };
  renderWithProviders(<LabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Incoming wafers')).toBeInTheDocument();
  // All four tiles render the placeholder dash before any data arrives.
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
});

test('surfaces the hook error in a banner', () => {
  hook.value = { ...empty(), error: 'boom' };
  renderWithProviders(<LabDashboard navigate={vi.fn()} />);
  expect(screen.getByText(/Couldn.t load tile counts: boom/)).toBeInTheDocument();
});

test('renders active dispatches and equipment rows once loaded', () => {
  hook.value = {
    ...empty(),
    dispatches: [dispatch({ id: 5, code: 'DSP-0005', experimentName: 'Burn-in', equipmentName: 'OVEN-01' })],
    equipment: [equipmentRow({ id: 20, name: 'PROBER-02' })],
  };
  renderWithProviders(<LabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('DSP-0005')).toBeInTheDocument();
  expect(screen.getByText('Burn-in')).toBeInTheDocument();
  expect(screen.getByText('PROBER-02')).toBeInTheDocument();
});

test('empty state messages show when there is no data', () => {
  renderWithProviders(<LabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('No active dispatches')).toBeInTheDocument();
  expect(screen.getByText('No equipment defined')).toBeInTheDocument();
});

test('clicking an active dispatch navigates to its detail', () => {
  const navigate = vi.fn();
  hook.value = { ...empty(), dispatches: [dispatch({ id: 9, experimentName: 'Go here' })] };
  renderWithProviders(<LabDashboard navigate={navigate} />);
  fireEvent.click(screen.getByText('Go here'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_dispatch_detail', id: 9 });
});

test('clicking the incoming-wafers tile navigates to the samples view', () => {
  const navigate = vi.fn();
  renderWithProviders(<LabDashboard navigate={navigate} />);
  fireEvent.click(screen.getByText('Incoming wafers'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_samples', tab: 'incoming' });
});

test('renders the Awaiting Your Result card for dispatches needing a result', () => {
  hook.value = {
    ...empty(),
    dispatches: [dispatch({ id: 3, code: 'DSP-0003', status: 'unloaded', experimentName: 'Record me' })],
  };
  renderWithProviders(<LabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Awaiting Your Result')).toBeInTheDocument();
  expect(screen.getByText('Record me')).toBeInTheDocument();
});
