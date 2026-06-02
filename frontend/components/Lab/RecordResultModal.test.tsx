import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';
import RecordResultModal from './RecordResultModal';

// Controlled modal: `open` gates rendering, `onSubmit`/`onClose` are callbacks
// the parent owns (no api call inside). Render with props, assert the fields,
// then drive submit/cancel.
const waferResults = [
  { sampleId: 1, wafer: 'W-001', size: '6"', verdict: 'pass', status: 'completed' },
  { sampleId: 2, wafer: 'W-002', size: '6"', verdict: 'fail', status: 'completed' },
  { sampleId: 3, wafer: 'W-003', size: '6"', verdict: null, status: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders nothing while closed', () => {
  renderWithProviders(
    <RecordResultModal open={false} onClose={vi.fn()} dispatch={{}} onSubmit={vi.fn()} />,
  );
  expect(screen.queryByText('Record Experiment Result')).not.toBeInTheDocument();
});

test('renders the per-wafer verdicts when open', () => {
  renderWithProviders(
    <RecordResultModal
      open
      onClose={vi.fn()}
      dispatch={{}}
      waferResults={waferResults}
      onSubmit={vi.fn()}
    />,
  );
  expect(screen.getByText('Record Experiment Result')).toBeInTheDocument();
  expect(screen.getByText('W-001')).toBeInTheDocument();
  expect(screen.getByText('✓ Pass')).toBeInTheDocument();
  expect(screen.getByText('✗ Fail')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});

test('submits the trimmed comment', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(
    <RecordResultModal open onClose={vi.fn()} dispatch={{}} onSubmit={onSubmit} />,
  );
  await user.type(screen.getByPlaceholderText(/Observations/i), '  ran clean  ');
  fireEvent.click(screen.getByRole('button', { name: /Submit Result/i }));
  expect(onSubmit).toHaveBeenCalledWith({ comment: 'ran clean' });
});

test('Cancel invokes onClose without submitting', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  renderWithProviders(
    <RecordResultModal open onClose={onClose} dispatch={{}} onSubmit={onSubmit} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});
