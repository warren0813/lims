import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';

// CancelRequestModal has no `open` prop — the parent controls mounting, so the
// modal renders its overlay whenever it is mounted. It owns the api call itself:
// on confirm it calls api.requests.cancel(requestId, reason) (mocked), then
// showToast and onCancelled. A non-empty reason is required to confirm.
const cancel = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { cancel } } }));

import CancelRequestModal from './CancelRequestModal';

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders the confirmation copy, zero-padded id, and a required reason field', () => {
  renderWithProviders(<CancelRequestModal requestId={7} onClose={vi.fn()} />);
  expect(screen.getByText('Cancel Request #0007')).toBeInTheDocument();
  expect(screen.getByText(/Cancellation is permanent/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Why is this request being cancelled/i)).toBeInTheDocument();
});

test('the confirm action is gated until a reason is entered', async () => {
  const user = userEvent.setup();
  renderWithProviders(<CancelRequestModal requestId={7} onClose={vi.fn()} />);
  const confirmBtn = screen.getByRole('button', { name: /^Cancel request$/i });
  expect(confirmBtn).toBeDisabled();
  await user.type(screen.getByPlaceholderText(/Why is this request being cancelled/i), 'no longer needed');
  expect(confirmBtn).toBeEnabled();
});

test('a whitespace-only reason keeps the confirm action disabled', async () => {
  const user = userEvent.setup();
  renderWithProviders(<CancelRequestModal requestId={7} onClose={vi.fn()} />);
  await user.type(screen.getByPlaceholderText(/Why is this request being cancelled/i), '    ');
  expect(screen.getByRole('button', { name: /^Cancel request$/i })).toBeDisabled();
});

test('confirming calls api.requests.cancel with the trimmed reason, then toasts and notifies', async () => {
  const onCancelled = vi.fn();
  const showToast = vi.fn();
  const user = userEvent.setup();
  cancel.mockResolvedValue({});
  renderWithProviders(
    <CancelRequestModal requestId={42} onClose={vi.fn()} onCancelled={onCancelled} showToast={showToast} />,
  );
  await user.type(screen.getByPlaceholderText(/Why is this request being cancelled/i), '  duplicate  ');
  fireEvent.click(screen.getByRole('button', { name: /^Cancel request$/i }));
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  expect(cancel).toHaveBeenCalledWith(42, 'duplicate');
  await vi.waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1));
  expect(showToast).toHaveBeenCalledWith('Request #42 cancelled');
});

test('surfaces an api failure as an inline error and does not notify', async () => {
  const onCancelled = vi.fn();
  const user = userEvent.setup();
  cancel.mockRejectedValue(new Error('already closed'));
  renderWithProviders(<CancelRequestModal requestId={9} onClose={vi.fn()} onCancelled={onCancelled} />);
  await user.type(screen.getByPlaceholderText(/Why is this request being cancelled/i), 'oops');
  fireEvent.click(screen.getByRole('button', { name: /^Cancel request$/i }));
  expect(await screen.findByText('already closed')).toBeInTheDocument();
  expect(onCancelled).not.toHaveBeenCalled();
});

test('Keep request invokes onClose without calling the api', () => {
  const onClose = vi.fn();
  renderWithProviders(<CancelRequestModal requestId={7} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /Keep request/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
});
