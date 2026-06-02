import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';

// ApprovalModal is a controlled modal (`open` gates the shared Modal wrapper)
// that delegates the action to the parent via onSubmit(reason) — it makes NO
// api call itself. The `action` prop picks the APPROVE / RETURN / REJECT variant,
// which decides the title, CTA label, and whether a reason is required.
import ApprovalModal from './ApprovalModal';

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders nothing while closed', () => {
  renderWithProviders(<ApprovalModal open={false} onClose={vi.fn()} action="APPROVE" onSubmit={vi.fn()} />);
  expect(screen.queryByText('Approve request')).not.toBeInTheDocument();
});

test('approve variant shows an optional reason and an enabled Approve action', () => {
  renderWithProviders(<ApprovalModal open onClose={vi.fn()} action="APPROVE" onSubmit={vi.fn()} />);
  expect(screen.getByText('Approve request')).toBeInTheDocument();
  expect(screen.getByText(/Reason \(optional\)/)).toBeInTheDocument();
  // Optional reason -> the action is enabled even with an empty textarea.
  expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
});

test('approve submits the trimmed reason via onSubmit', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<ApprovalModal open onClose={vi.fn()} action="APPROVE" onSubmit={onSubmit} />);
  await user.type(screen.getByRole('textbox'), '  looks good  ');
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(onSubmit).toHaveBeenCalledWith('looks good');
});

test('approve with no reason submits an empty string', () => {
  const onSubmit = vi.fn();
  renderWithProviders(<ApprovalModal open onClose={vi.fn()} action="APPROVE" onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(onSubmit).toHaveBeenCalledWith('');
});

test('return variant requires a reason before the action enables', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<ApprovalModal open onClose={vi.fn()} action="RETURN" onSubmit={onSubmit} />);
  expect(screen.getByText('Return request')).toBeInTheDocument();
  const returnBtn = screen.getByRole('button', { name: 'Return' });
  expect(returnBtn).toBeDisabled();
  await user.type(screen.getByRole('textbox'), 'please add wafer ids');
  expect(returnBtn).toBeEnabled();
  fireEvent.click(returnBtn);
  expect(onSubmit).toHaveBeenCalledWith('please add wafer ids');
});

test('reject variant requires a reason before the action enables', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<ApprovalModal open onClose={vi.fn()} action="REJECT" onSubmit={onSubmit} />);
  expect(screen.getByText('Reject request')).toBeInTheDocument();
  const rejectBtn = screen.getByRole('button', { name: 'Reject' });
  expect(rejectBtn).toBeDisabled();
  await user.type(screen.getByRole('textbox'), 'out of scope');
  fireEvent.click(rejectBtn);
  expect(onSubmit).toHaveBeenCalledWith('out of scope');
});

test('whitespace-only reason keeps the required action disabled', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<ApprovalModal open onClose={vi.fn()} action="REJECT" onSubmit={onSubmit} />);
  await user.type(screen.getByRole('textbox'), '    ');
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
});

test('Cancel invokes onClose without submitting', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  renderWithProviders(<ApprovalModal open onClose={onClose} action="APPROVE" onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});
