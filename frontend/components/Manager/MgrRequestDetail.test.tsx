import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// MgrRequestDetail reads useMgrRequestDetail and drives the approve / return /
// reject / mark-complete workflow against api.requests.*. Approve and
// mark-complete are window.confirm guarded; return and reject open ApprovalModal
// (mocked to a stub that surfaces onSubmit) and POST the reason.
const hook = vi.hoisted(() => ({
  value: {
    data: null as Record<string, unknown> | null,
    loading: false,
    error: null as string | null,
    refresh: vi.fn(),
  },
}));
vi.mock('@/components/Manager/hooks/useMgrRequestDetail', () => ({ default: () => hook.value }));

const approve = vi.hoisted(() => vi.fn());
const reject = vi.hoisted(() => vi.fn());
const returnRequest = vi.hoisted(() => vi.fn());
const close = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: { requests: { approve, reject, returnRequest, close } },
}));

// ApprovalModal manages its own textarea state; stub it so a test can fire the
// submit callback directly with a reason.
vi.mock('@/components/Manager/ApprovalModal', () => ({
  default: ({
    open,
    action,
    onSubmit,
  }: {
    open: boolean;
    action: string | null;
    onSubmit: (reason: string) => void;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="approval-modal">
        <span>{action}</span>
        <button onClick={() => onSubmit('because reasons')}>Submit Modal</button>
      </div>
    ) : null,
}));

import MgrRequestDetail from './MgrRequestDetail';

const detail = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 7,
  title: 'Wafer batch A',
  status: 'submitted',
  urgency: '1w',
  submitted: '2026-05-01 09:30',
  note: 'handle with care',
  requester: { username: 'alice' },
  samples: [],
  history: [{ action: 'SUBMIT', by: 'alice', at: '2026-05-01 09:30', note: '' }],
  experiment_types: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: null, loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { data: null, loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('renders a not-found state on error', () => {
  hook.value = { data: null, loading: false, error: 'gone', refresh: vi.fn() };
  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getByText('Request not found')).toBeInTheDocument();
  expect(screen.getByText('gone')).toBeInTheDocument();
});

test('renders the request overview once loaded', () => {
  hook.value.data = detail({ title: 'Loaded request' });
  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  expect(screen.getAllByText('Loaded request').length).toBeGreaterThan(0);
  expect(screen.getByText('handle with care')).toBeInTheDocument();
});

test('approving confirms, calls api.requests.approve, then refreshes and toasts', async () => {
  const refresh = vi.fn();
  const showToast = vi.fn();
  hook.value = { data: detail({ status: 'submitted' }), loading: false, error: null, refresh };
  approve.mockResolvedValue(undefined);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} showToast={showToast} />);
  fireEvent.click(screen.getByRole('button', { name: /Approve/i }));

  expect(confirmSpy).toHaveBeenCalled();
  expect(approve).toHaveBeenCalledWith(7);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(showToast).toHaveBeenCalledWith('#7 approved');
  confirmSpy.mockRestore();
});

test('declining the approve confirm does not call the api', () => {
  hook.value.data = detail({ status: 'submitted' });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
  expect(approve).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('returning a request submits the modal reason via api.requests.returnRequest', async () => {
  const refresh = vi.fn();
  hook.value = { data: detail({ status: 'submitted' }), loading: false, error: null, refresh };
  returnRequest.mockResolvedValue(undefined);

  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Return/i }));
  expect(screen.getByTestId('approval-modal')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Submit Modal'));

  expect(returnRequest).toHaveBeenCalledWith(7, 'because reasons');
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
});

test('rejecting a request submits the modal reason via api.requests.reject', async () => {
  const refresh = vi.fn();
  hook.value = { data: detail({ status: 'submitted' }), loading: false, error: null, refresh };
  reject.mockResolvedValue(undefined);

  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
  fireEvent.click(screen.getByText('Submit Modal'));

  expect(reject).toHaveBeenCalledWith(7, 'because reasons');
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
});

test('an in-progress request can be marked complete via api.requests.close', async () => {
  const refresh = vi.fn();
  hook.value = { data: detail({ status: 'in_progress' }), loading: false, error: null, refresh };
  close.mockResolvedValue(undefined);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Mark Complete/i }));

  expect(close).toHaveBeenCalledWith(7);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  confirmSpy.mockRestore();
});

test('surfaces an action failure in a banner', async () => {
  hook.value = {
    data: detail({ status: 'submitted' }),
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
  approve.mockRejectedValue(new Error('server exploded'));
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<MgrRequestDetail id={7} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Approve/i }));

  await vi.waitFor(() => expect(screen.getByText('server exploded')).toBeInTheDocument());
  confirmSpy.mockRestore();
});

test('clicking a sample row navigates to that wafer', () => {
  const navigate = vi.fn();
  hook.value.data = detail({
    status: 'submitted',
    samples: [{ id: 3, wafer: 'W-003', size: '6 inch', expIds: [] }],
  });
  renderWithProviders(<MgrRequestDetail id={7} navigate={navigate} />);
  fireEvent.click(screen.getByText('W-003'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_wafer', id: 3 });
});
