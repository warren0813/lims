import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';
import { navigationModule } from '@/test/mocks/nextNavigation';

// RequestStatisticsReport is routing-aware (imports next/navigation) and
// api-backed: it fetches via api.reports.requestStatistics on Generate and
// pushes to a request detail when a row is clicked. Build the router spy and
// the api mock with vi.hoisted so the vi.mock factories can see them.
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock('next/navigation', () => navigationModule(router));

const requestStatistics = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { reports: { requestStatistics } } }));

import RequestStatisticsReport from './RequestStatisticsReport';

const requestRow = (over: Record<string, unknown> = {}) => ({
  id: 12,
  title: 'Wafer batch A',
  status: 'in_progress',
  urgency: '1w',
  requester: 'alice',
  sample_count: 3,
  experiment_types: ['CMP', 'Etch'],
  submitted_at: '2026-05-02T08:00:00',
  created_at: '2026-05-01T09:30:00',
  updated_at: '2026-05-03T10:00:00',
  ...over,
});

const stats = (over: Record<string, unknown> = {}) => ({
  period: { start_date: '2026-05-17', end_date: '2026-06-15' },
  status_distribution: { in_progress: 1 },
  average_tat_hours: 30,
  total_requests: 1,
  requests: [requestRow()],
  ...over,
});

beforeEach(() => {
  // Pin "today" so defaultDateRange() is deterministic. shouldAdvanceTime keeps
  // real timers ticking under the hood so awaited promises still resolve.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-06-15T12:00:00'));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

test('renders the form controls and no results before generating', () => {
  renderWithProviders(<RequestStatisticsReport />);
  expect(screen.getByText('Request Statistics')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument();
  expect(screen.queryByText('Total Requests')).not.toBeInTheDocument();
  expect(requestStatistics).not.toHaveBeenCalled();
});

test('seeds the date inputs from the default last-30-days window', () => {
  renderWithProviders(<RequestStatisticsReport />);
  expect(screen.getByDisplayValue('2026-05-17')).toBeInTheDocument();
  expect(screen.getByDisplayValue('2026-06-15')).toBeInTheDocument();
});

test('Generate fetches with the selected range and renders the summary + rows', async () => {
  requestStatistics.mockResolvedValue(stats());
  renderWithProviders(<RequestStatisticsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  await vi.waitFor(() =>
    expect(requestStatistics).toHaveBeenCalledWith({
      start_date: '2026-05-17',
      end_date: '2026-06-15',
    }),
  );
  expect(await screen.findByText('Total Requests')).toBeInTheDocument();
  expect(screen.getByText('Average TAT')).toBeInTheDocument();
  // average_tat_hours 30 -> 1.3d, total_requests 1
  expect(screen.getByText('1.3d')).toBeInTheDocument();
  expect(screen.getByText('Wafer batch A')).toBeInTheDocument();
  expect(screen.getByText('#0012')).toBeInTheDocument();
});

test('clicking a result row pushes to that request detail', async () => {
  requestStatistics.mockResolvedValue(stats({ requests: [requestRow({ id: 7, title: 'Clickable' })] }));
  renderWithProviders(<RequestStatisticsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));
  const cell = await screen.findByText('Clickable');

  fireEvent.click(cell);
  expect(router.push).toHaveBeenCalledWith('/manager/requests/7');
});

test('an empty requests array shows the in-period empty state', async () => {
  requestStatistics.mockResolvedValue(stats({ requests: [], total_requests: 0, average_tat_hours: null }));
  renderWithProviders(<RequestStatisticsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('No request details found in this period.')).toBeInTheDocument();
  // null TAT formats as '-'
  expect(screen.getByText('-')).toBeInTheDocument();
});

test('a failed fetch surfaces the error message and clears any prior stats', async () => {
  requestStatistics.mockRejectedValue(new Error('boom'));
  renderWithProviders(<RequestStatisticsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('boom')).toBeInTheDocument();
  expect(screen.queryByText('Total Requests')).not.toBeInTheDocument();
});

test('a quick-range preset re-seeds the date inputs before generating', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderWithProviders(<RequestStatisticsReport />);

  await user.click(screen.getByRole('button', { name: 'Today' }));
  // Both start and end collapse to today's pinned date.
  expect(screen.getAllByDisplayValue('2026-06-15')).toHaveLength(2);
});
