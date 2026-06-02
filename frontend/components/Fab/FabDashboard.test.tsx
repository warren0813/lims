import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// FabDashboard reads useRequests and derives in-progress / drafts / attention /
// waiting-approval buckets plus a recent-activity timeline. Mock the hook to a
// controlled value (mutated per test). InProgressRow is a real child that lazily
// fetches request detail via api.requests.get when expanded, so the api default
// needs a resolved get(); everything else (FabPage, tiles, cards, pills) is
// presentational and renders for real.
const hook = vi.hoisted(() => ({
  value: { data: [] as unknown[], loading: false, error: null as string | null },
}));
vi.mock('@/components/Fab/hooks/useRequests', () => ({ default: () => hook.value }));

const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { get } } }));

import FabDashboard from './FabDashboard';

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  title: 'Wafer batch A',
  status: 'in_progress',
  rawStatus: 'in_progress',
  urgency: '1w',
  created: '2026-05-01 09:30',
  updated: '2026-05-01 09:30',
  submitted: '2026-05-01 09:30',
  sampleCount: 2,
  samples: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: [], loading: false, error: null };
  get.mockResolvedValue({ samples: [], status: 'in_progress', rawStatus: 'in_progress' });
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { data: [], loading: true, error: null };
  renderWithProviders(<FabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('surfaces the hook error in a banner', () => {
  hook.value = { data: [], loading: false, error: 'boom' };
  renderWithProviders(<FabDashboard navigate={vi.fn()} />);
  expect(screen.getByText(/Failed to load requests: boom/)).toBeInTheDocument();
});

test('renders the four stat tiles with counts derived from requests', () => {
  hook.value.data = [
    row({ id: 1, status: 'submitted', rawStatus: 'pending_approval' }),
    row({ id: 2, status: 'in_progress', rawStatus: 'in_progress' }),
    row({ id: 3, status: 'returned', rawStatus: 'returned', title: 'Returned one' }),
    row({ id: 4, status: 'draft', rawStatus: 'draft', title: 'Draft one' }),
  ];
  renderWithProviders(<FabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Waiting Approval')).toBeInTheDocument();
  // "In Progress" labels the tile, the section banner and the activity pill.
  expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  // "Needs Attention" labels both the tile and the attention card banner.
  expect(screen.getAllByText('Needs Attention').length).toBeGreaterThan(0);
  // "Drafts" labels both the tile and the drafts card banner.
  expect(screen.getAllByText('Drafts').length).toBeGreaterThan(0);
});

test('renders an in-progress row for each in_progress request', () => {
  hook.value.data = [
    row({ id: 11, title: 'Active alpha', status: 'in_progress', rawStatus: 'in_progress' }),
    row({ id: 12, title: 'Active beta', status: 'in_progress', rawStatus: 'in_progress' }),
  ];
  renderWithProviders(<FabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Active alpha')).toBeInTheDocument();
  expect(screen.getByText('Active beta')).toBeInTheDocument();
});

test('the New Request action navigates to the new-request form', () => {
  const navigate = vi.fn();
  renderWithProviders(<FabDashboard navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: /^New Request$/i }));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_new' });
});

test('a stat tile navigates to its filtered request list', () => {
  const navigate = vi.fn();
  hook.value.data = [row({ id: 1, status: 'submitted', rawStatus: 'pending_approval' })];
  renderWithProviders(<FabDashboard navigate={navigate} />);
  fireEvent.click(screen.getByText('Waiting Approval'));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_requests', tab: 'all' });
});

test('clicking a needs-attention row opens that request detail', () => {
  const navigate = vi.fn();
  hook.value.data = [
    row({ id: 42, title: 'Needs fixing', status: 'returned', rawStatus: 'returned' }),
  ];
  renderWithProviders(<FabDashboard navigate={navigate} />);
  fireEvent.click(screen.getByText('Needs fixing'));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_request', id: 42 });
});

test('clicking a draft row opens the draft editor', () => {
  const navigate = vi.fn();
  hook.value.data = [
    row({ id: 9, title: 'Draft to continue', status: 'draft', rawStatus: 'draft' }),
  ];
  renderWithProviders(<FabDashboard navigate={navigate} />);
  fireEvent.click(screen.getByText('Draft to continue'));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_draft_edit', id: 9 });
});

test('empty buckets render their friendly empty-state copy', () => {
  hook.value.data = [];
  renderWithProviders(<FabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Nothing flagged. Good work.')).toBeInTheDocument();
  expect(screen.getByText('No drafts saved.')).toBeInTheDocument();
});

test('builds a recent-activity entry from request status', () => {
  hook.value.data = [
    row({
      id: 5,
      title: 'Shipped batch',
      status: 'in_progress',
      rawStatus: 'sample_shipped',
      updated: '2026-05-02 10:00',
    }),
  ];
  renderWithProviders(<FabDashboard navigate={vi.fn()} />);
  expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  expect(screen.getByText('Shipped')).toBeInTheDocument();
  expect(screen.getByText(/Shipped batch — samples shipped to lab/)).toBeInTheDocument();
});
