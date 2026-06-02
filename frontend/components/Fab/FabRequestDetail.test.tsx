import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// FabRequestDetail reads three hooks: useRequestDetail (the request),
// useExperimentTypes (lab-category lookup) and useSampleExperimentsForRequest
// (per-wafer experiment rollups). Mock all three to controlled values. The Ship
// action calls api.requests.ship (window.confirm-guarded) then refresh(). The
// CancelRequestModal is an interactive child that fetches on its own, so it's
// stubbed to a testid div — opening it only needs to confirm the stub mounts.
const detail = vi.hoisted(() => ({
  value: {
    data: null as Record<string, unknown> | null,
    loading: false,
    error: null as string | null,
    refresh: vi.fn(),
  },
}));
vi.mock('@/components/Fab/hooks/useRequestDetail', () => ({ default: () => detail.value }));

const expTypes = vi.hoisted(() => ({ value: { data: [] as unknown[] } }));
vi.mock('@/components/Fab/hooks/useExperimentTypes', () => ({ default: () => expTypes.value }));

const sampleExps = vi.hoisted(() => ({ value: { byId: {} as Record<string, unknown> } }));
vi.mock('@/components/Fab/hooks/useSampleExperimentsForRequest', () => ({
  default: () => sampleExps.value,
}));

vi.mock('@/components/Fab/CancelRequestModal', () => ({
  default: () => <div data-testid="cancel-modal" />,
}));

const ship = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { ship } } }));

import FabRequestDetail from './FabRequestDetail';

const requestDetail = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 7,
  title: 'Reliability batch Q2',
  status: 'in_progress',
  rawStatus: 'in_progress',
  urgency: '1w',
  note: '',
  submitted: '2026-05-01 09:30',
  experiment_types: [{ id: 1, name: 'TCT' }],
  samples: [{ id: 100, wafer: 'W001', size: '200mm', status: 'processing', raw_status: 'processing' }],
  history: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  detail.value = { data: null, loading: false, error: null, refresh: vi.fn() };
  expTypes.value = { data: [] };
  sampleExps.value = { byId: {} };
});

test('shows a loading placeholder while detail is loading and no data yet', () => {
  detail.value = { data: null, loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('renders a not-found state on error', () => {
  detail.value = { data: null, loading: false, error: 'gone', refresh: vi.fn() };
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Request not found')).toBeInTheDocument();
  expect(screen.getByText('gone')).toBeInTheDocument();
});

test('renders a not-found state when there is no data and no error', () => {
  detail.value = { data: null, loading: false, error: null, refresh: vi.fn() };
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Request not found')).toBeInTheDocument();
  expect(screen.getByText('This request is no longer available.')).toBeInTheDocument();
});

test('renders the request title, id and overview metrics once loaded', () => {
  detail.value.data = requestDetail();
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Reliability batch Q2')).toBeInTheDocument();
  expect(screen.getByText('#0007')).toBeInTheDocument();
  expect(screen.getByText('Overview')).toBeInTheDocument();
  expect(screen.getByText('Wafers')).toBeInTheDocument();
  // The wafer id renders in both the Wafer Phases and Experiments-by-Wafer cards.
  expect(screen.getAllByText('W001').length).toBeGreaterThan(0);
});

test('renders the note section only when a note is present', () => {
  detail.value.data = requestDetail({ note: 'Handle with care' });
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Note')).toBeInTheDocument();
  expect(screen.getByText('Handle with care')).toBeInTheDocument();
});

test('renders approval history entries when present', () => {
  detail.value.data = requestDetail({
    history: [{ action: 'APPROVE', by: 'manager1', at: '2026-05-02 11:00', note: 'looks good' }],
  });
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Approval History')).toBeInTheDocument();
  expect(screen.getByText('APPROVE')).toBeInTheDocument();
  expect(screen.getByText('manager1')).toBeInTheDocument();
  expect(screen.getByText('looks good')).toBeInTheDocument();
});

test('the breadcrumb navigates back to the request list', () => {
  const navigate = vi.fn();
  detail.value.data = requestDetail();
  renderWithProviders(<FabRequestDetail id={7} navigate={navigate} />);
  fireEvent.click(screen.getByText(/My Requests/i));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_requests' });
});

test('the Ship action confirms, calls api.requests.ship, toasts and refreshes', async () => {
  const refresh = vi.fn();
  const showToast = vi.fn();
  detail.value = {
    data: requestDetail({ rawStatus: 'approved', status: 'in_progress' }),
    loading: false,
    error: null,
    refresh,
  };
  ship.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} showToast={showToast} />);
  fireEvent.click(screen.getByRole('button', { name: /Ship Wafers/i }));

  expect(confirmSpy).toHaveBeenCalled();
  expect(ship).toHaveBeenCalledWith(7);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(showToast).toHaveBeenCalledWith('Wafers shipped');
  confirmSpy.mockRestore();
});

test('declining the Ship confirmation does not call the api', () => {
  detail.value.data = requestDetail({ rawStatus: 'approved', status: 'in_progress' });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Ship Wafers/i }));
  expect(ship).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('opening the cancel action mounts the cancel modal', () => {
  detail.value.data = requestDetail({ status: 'in_progress', rawStatus: 'in_progress' });
  renderWithProviders(<FabRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.queryByTestId('cancel-modal')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Cancel Request/i }));
  expect(screen.getByTestId('cancel-modal')).toBeInTheDocument();
});
