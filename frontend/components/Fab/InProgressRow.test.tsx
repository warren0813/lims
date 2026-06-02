import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// InProgressRow is a controlled expand/collapse row. The collapsed header is
// props-only (id, title, wafer count, submitted date, current phase). When
// `open` flips true it lazily fetches request detail via api.requests.get and
// renders the wafer-phase pipeline / loading / error / empty states off it.
// Mock the api default so the lazy fetch is controllable.
const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { get } } }));

import InProgressRow from './InProgressRow';

const request = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 11,
  title: 'Wafer batch A',
  status: 'in_progress',
  rawStatus: 'in_progress',
  sampleCount: 2,
  samples: [],
  submitted: '2026-05-01 09:30',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ samples: [], status: 'in_progress', rawStatus: 'in_progress' });
});

test('renders the collapsed header with id, title, wafer count and date', () => {
  renderWithProviders(
    <InProgressRow request={request()} navigate={vi.fn()} open={false} onToggle={vi.fn()} />,
  );
  expect(screen.getByText('#11')).toBeInTheDocument();
  expect(screen.getByText('Wafer batch A')).toBeInTheDocument();
  expect(screen.getByText(/2 wafers/)).toBeInTheDocument();
  expect(screen.getByText('2026-05-01')).toBeInTheDocument();
});

test('falls back to a dash when there is no submitted date', () => {
  renderWithProviders(
    <InProgressRow
      request={request({ submitted: null })}
      navigate={vi.fn()}
      open={false}
      onToggle={vi.fn()}
    />,
  );
  // Both the current-phase cell and the (missing) date cell render a dash.
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
});

test('does not fetch detail while collapsed', () => {
  renderWithProviders(
    <InProgressRow request={request()} navigate={vi.fn()} open={false} onToggle={vi.fn()} />,
  );
  expect(get).not.toHaveBeenCalled();
});

test('clicking the header fires onToggle', () => {
  const onToggle = vi.fn();
  renderWithProviders(
    <InProgressRow request={request()} navigate={vi.fn()} open={false} onToggle={onToggle} />,
  );
  fireEvent.click(screen.getByText('Wafer batch A'));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test('fetches request detail and renders the empty-wafers state when expanded', async () => {
  get.mockResolvedValue({ samples: [], status: 'in_progress', rawStatus: 'in_progress' });
  renderWithProviders(
    <InProgressRow request={request()} navigate={vi.fn()} open onToggle={vi.fn()} />,
  );
  expect(get).toHaveBeenCalledWith(11);
  expect(await screen.findByText('No wafers on this request.')).toBeInTheDocument();
});

test('renders a phase row per wafer once detail resolves', async () => {
  get.mockResolvedValue({
    status: 'in_progress',
    rawStatus: 'in_progress',
    samples: [
      { id: 1, wafer: 'W-001', size: '8 inch', status: 'received', raw_status: 'received' },
      { id: 2, wafer: 'W-002', size: '8 inch', status: 'in_wip', raw_status: 'processing' },
    ],
  });
  renderWithProviders(
    <InProgressRow request={request()} navigate={vi.fn()} open onToggle={vi.fn()} />,
  );
  expect(await screen.findByText('W-001')).toBeInTheDocument();
  expect(screen.getByText('W-002')).toBeInTheDocument();
});

test('surfaces a fetch error in the expanded body', async () => {
  get.mockRejectedValue(new Error('network down'));
  renderWithProviders(
    <InProgressRow request={request()} navigate={vi.fn()} open onToggle={vi.fn()} />,
  );
  expect(await screen.findByText('network down')).toBeInTheDocument();
});

test('the Open request action navigates to the request detail', async () => {
  const navigate = vi.fn();
  renderWithProviders(
    <InProgressRow request={request({ id: 99 })} navigate={navigate} open onToggle={vi.fn()} />,
  );
  fireEvent.click(await screen.findByText(/Open request/));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_request', id: 99 });
});
