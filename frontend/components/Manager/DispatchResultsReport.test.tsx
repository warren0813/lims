import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { navigationModule } from '@/test/mocks/nextNavigation';

// DispatchResultsReport is routing-aware (imports next/navigation) and
// api-backed: it fetches via api.reports.dispatchResults on Generate, reads
// out.data, and pushes to a dispatch detail when a row is clicked. Build the
// router spy and the api mock with vi.hoisted so the factories can see them.
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock('next/navigation', () => navigationModule(router));

const dispatchResults = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { reports: { dispatchResults } } }));

import DispatchResultsReport from './DispatchResultsReport';

const dispatchRow = (over: Record<string, unknown> = {}) => ({
  id: 5,
  wip_id: 2,
  status: 'completed',
  equipment: { id: 1, name: 'Etcher-1' },
  experiment_type: { id: 1, name: 'Dry Etch' },
  recipe: { id: 1, name: 'Recipe-A' },
  request_ids: [12],
  request_titles: ['Wafer batch A'],
  sample_count: 4,
  pass_count: 3,
  fail_count: 1,
  operator: 'bob',
  dispatched_at: '2026-05-10T08:00:00',
  completed_at: '2026-05-10T10:00:00',
  duration_seconds: 7200,
  result_comment: 'ok',
  ...over,
});

beforeEach(() => {
  // Pin "today" so defaultDateRange() is deterministic; shouldAdvanceTime keeps
  // real timers running so awaited fetch promises resolve.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-06-15T12:00:00'));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

test('renders the form and no table before generating', () => {
  renderWithProviders(<DispatchResultsReport />);
  expect(screen.getByText('Dispatch Results')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(dispatchResults).not.toHaveBeenCalled();
});

test('Generate fetches the selected range and renders a row per dispatch', async () => {
  dispatchResults.mockResolvedValue({ data: [dispatchRow()] });
  renderWithProviders(<DispatchResultsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  await vi.waitFor(() =>
    expect(dispatchResults).toHaveBeenCalledWith({
      start_date: '2026-05-17',
      end_date: '2026-06-15',
    }),
  );
  expect(await screen.findByText('DP-0005')).toBeInTheDocument();
  expect(screen.getByText('Etcher-1')).toBeInTheDocument();
  expect(screen.getByText('Dry Etch')).toBeInTheDocument();
  // "Completed" is both a column header and the status label; scope to the
  // status pill (the cell content) via the row's own dispatch code anchor.
  const statusCell = screen.getByText('DP-0005').closest('tr')?.querySelectorAll('td')[1];
  expect(statusCell).toHaveTextContent('Completed');
  // duration 7200s -> 2.0h, pass/fail rendered as "3 / 1"
  expect(screen.getByText('2.0h')).toBeInTheDocument();
  expect(screen.getByText('3 / 1')).toBeInTheDocument();
});

test('clicking a dispatch row pushes to that dispatch detail', async () => {
  dispatchResults.mockResolvedValue({ data: [dispatchRow({ id: 9 })] });
  renderWithProviders(<DispatchResultsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));
  const cell = await screen.findByText('DP-0009');

  fireEvent.click(cell);
  expect(router.push).toHaveBeenCalledWith('/manager/lab/dispatches/9');
});

test('an empty data array renders the in-period empty state', async () => {
  dispatchResults.mockResolvedValue({ data: [] });
  renderWithProviders(<DispatchResultsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('No dispatches found in this period.')).toBeInTheDocument();
});

test('a missing data field falls back to an empty table', async () => {
  dispatchResults.mockResolvedValue({});
  renderWithProviders(<DispatchResultsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('No dispatches found in this period.')).toBeInTheDocument();
});

test('a failed fetch surfaces the error and renders no table', async () => {
  dispatchResults.mockRejectedValue(new Error('query failed'));
  renderWithProviders(<DispatchResultsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('query failed')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('null operator and timestamps render as dashes', async () => {
  dispatchResults.mockResolvedValue({
    data: [
      dispatchRow({
        id: 3,
        operator: null,
        dispatched_at: null,
        completed_at: null,
        duration_seconds: null,
        request_titles: [],
      }),
    ],
  });
  renderWithProviders(<DispatchResultsReport />);

  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('DP-0003')).toBeInTheDocument();
  // operator, both timestamps, duration, and request all '-': several dashes present
  expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(4);
});
