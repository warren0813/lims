import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// MgrDashboard reads useMgrDashboardData and renders stat tiles + an "awaiting
// response" list off the submitted requests. Mock the hook to a controlled
// value; TrendChart fetches its own data so mock it to a presentational stub.
const hook = vi.hoisted(() => ({
  value: {
    requests: [] as Record<string, unknown>[],
    equipmentCount: 0,
    loading: false,
    error: null as string | null,
    refresh: vi.fn(),
  },
}));
vi.mock('@/components/Manager/hooks/useMgrDashboardData', () => ({ default: () => hook.value }));

vi.mock('@/components/Manager/TrendChart', () => ({
  default: () => <div data-testid="trend-chart" />,
}));

import MgrDashboard from './MgrDashboard';

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  title: 'Wafer batch A',
  status: 'submitted',
  urgency: '1w',
  created: '2026-05-01 09:30',
  submitted: '2026-05-01 09:30',
  sampleCount: 2,
  samples: [],
  requester: { username: 'alice' },
  history: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = {
    requests: [],
    equipmentCount: 0,
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
});

test('renders the dashboard title and the trend chart placeholder', () => {
  renderWithProviders(<MgrDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
  expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
});

test('shows em-dash placeholders for tile values during the initial load', () => {
  hook.value = { ...hook.value, requests: [], loading: true };
  renderWithProviders(<MgrDashboard navigate={vi.fn()} />);
  // To approve / In Progress / Completed / Equipment all render "—" on first load.
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
});

test('counts submitted / in_progress / completed requests into the tiles', () => {
  hook.value.requests = [
    row({ id: 1, status: 'submitted' }),
    row({ id: 2, status: 'in_progress' }),
    row({ id: 3, status: 'completed' }),
    row({ id: 4, status: 'completed' }),
  ];
  hook.value.equipmentCount = 7;
  renderWithProviders(<MgrDashboard navigate={vi.fn()} />);
  expect(screen.getByText('7')).toBeInTheDocument(); // equipment count
  expect(screen.getByText('In Progress')).toBeInTheDocument();
});

test('lists the submitted requests awaiting a response', () => {
  hook.value.requests = [
    row({ id: 5, title: 'Needs review', status: 'submitted' }),
    row({ id: 6, title: 'Already done', status: 'completed' }),
  ];
  renderWithProviders(<MgrDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Needs review')).toBeInTheDocument();
  expect(screen.queryByText('Already done')).not.toBeInTheDocument();
});

test('shows the all-clear empty state when nothing is awaiting response', () => {
  hook.value.requests = [row({ id: 9, status: 'completed' })];
  renderWithProviders(<MgrDashboard navigate={vi.fn()} />);
  expect(screen.getByText(/All clear/)).toBeInTheDocument();
});

test('clicking an awaiting-response row navigates to that request', () => {
  const navigate = vi.fn();
  hook.value.requests = [row({ id: 42, title: 'Click me', status: 'submitted' })];
  renderWithProviders(<MgrDashboard navigate={navigate} />);
  fireEvent.click(screen.getByText('Click me'));
  expect(navigate).toHaveBeenCalledWith({ page: 'mgr_request', id: 42 });
});

test('the To approve tile navigates to all requests', () => {
  const navigate = vi.fn();
  renderWithProviders(<MgrDashboard navigate={navigate} />);
  fireEvent.click(screen.getByText('To approve'));
  expect(navigate).toHaveBeenCalledWith({ page: 'mgr_all_requests' });
});

test('surfaces the tile-counts error in a banner', () => {
  hook.value = { ...hook.value, error: 'boom' };
  renderWithProviders(<MgrDashboard navigate={vi.fn()} />);
  expect(screen.getByText(/Couldn.t load tile counts: boom/)).toBeInTheDocument();
});
