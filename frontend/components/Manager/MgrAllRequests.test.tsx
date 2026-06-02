import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// MgrAllRequests reads useMgrRequests, hides drafts, tabs by status, and
// renders one card per request. Mock the hook to a controlled value.
const hook = vi.hoisted(() => ({
  value: {
    data: [] as Record<string, unknown>[],
    loading: false,
    error: null as string | null,
    refresh: vi.fn(),
  },
}));
vi.mock('@/components/Manager/hooks/useMgrRequests', () => ({ default: () => hook.value }));

import MgrAllRequests from './MgrAllRequests';

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
  experiment_types: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: [], loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { data: [], loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<MgrAllRequests navigate={vi.fn()} />);
  // "Loading…" appears in both the Page subtitle and the body placeholder.
  expect(screen.getAllByText('Loading…').length).toBeGreaterThanOrEqual(1);
});

test('renders a card for each non-draft request in the active tab', () => {
  hook.value.data = [
    row({ id: 1, title: 'Pending one', status: 'submitted' }),
    row({ id: 2, title: 'Pending two', status: 'submitted' }),
  ];
  renderWithProviders(<MgrAllRequests navigate={vi.fn()} />);
  expect(screen.getByText('Pending one')).toBeInTheDocument();
  expect(screen.getByText('Pending two')).toBeInTheDocument();
});

test('hides draft requests entirely', () => {
  hook.value.data = [
    row({ id: 1, title: 'A draft', status: 'draft' }),
    row({ id: 2, title: 'Submitted one', status: 'submitted' }),
  ];
  renderWithProviders(<MgrAllRequests navigate={vi.fn()} />);
  expect(screen.queryByText('A draft')).not.toBeInTheDocument();
  expect(screen.getByText('Submitted one')).toBeInTheDocument();
});

test('switching tabs filters the list by status', () => {
  hook.value.data = [
    row({ id: 1, title: 'Pending one', status: 'submitted' }),
    row({ id: 2, title: 'Running one', status: 'in_progress' }),
  ];
  renderWithProviders(<MgrAllRequests navigate={vi.fn()} />);
  // Default tab is "pending" — only the submitted one shows.
  expect(screen.getByText('Pending one')).toBeInTheDocument();
  expect(screen.queryByText('Running one')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('In Progress'));
  expect(screen.getByText('Running one')).toBeInTheDocument();
  expect(screen.queryByText('Pending one')).not.toBeInTheDocument();
});

test('shows the empty-state card when the active tab has no requests', () => {
  hook.value.data = [row({ id: 1, status: 'completed' })];
  renderWithProviders(<MgrAllRequests navigate={vi.fn()} />);
  // Default "pending" tab has nothing.
  expect(screen.getByText('No requests in this view')).toBeInTheDocument();
});

test('clicking a request card navigates to that request detail', () => {
  const navigate = vi.fn();
  hook.value.data = [row({ id: 7, title: 'Clickable', status: 'submitted' })];
  renderWithProviders(<MgrAllRequests navigate={navigate} />);
  fireEvent.click(screen.getByText('Clickable'));
  expect(navigate).toHaveBeenCalledWith({ page: 'mgr_request', id: 7 });
});

test('surfaces the hook error in a banner', () => {
  hook.value = { data: [], loading: false, error: 'boom', refresh: vi.fn() };
  renderWithProviders(<MgrAllRequests navigate={vi.fn()} />);
  expect(screen.getByText(/Couldn.t load requests: boom/)).toBeInTheDocument();
});
