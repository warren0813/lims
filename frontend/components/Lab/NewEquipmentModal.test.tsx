import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import NewEquipmentModal from './NewEquipmentModal';

// NewEquipmentModal is an `open`-gated controlled modal with no data hook and no
// api call: it builds a payload from local form state and hands it to onSubmit.
// Render it open with props, assert fields/validation, and drive submit/cancel.

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders nothing while closed', () => {
  renderWithProviders(<NewEquipmentModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
  expect(screen.queryByText('Add Equipment')).not.toBeInTheDocument();
});

test('renders the form fields and the experiment options when open', () => {
  renderWithProviders(<NewEquipmentModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
  expect(screen.getByText('Add Equipment')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('e.g. QA-TCT-03')).toHaveValue('');
  // Experiment select defaults to the first EXPERIMENTS entry (TCT).
  expect(screen.getByRole('combobox')).toHaveValue('TCT');
  expect(
    screen.getByRole('option', { name: 'Temperature Cycling Test (TCT)' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Final Test (FT)' })).toBeInTheDocument();
});

test('the primary action is gated until a name is entered', () => {
  renderWithProviders(<NewEquipmentModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Create Equipment/i })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('e.g. QA-TCT-03'), { target: { value: 'QA-TCT-03' } });
  expect(screen.getByRole('button', { name: /Create Equipment/i })).toBeEnabled();
});

test('a name that clashes with an existing id blocks submit and warns', () => {
  renderWithProviders(
    <NewEquipmentModal open onClose={vi.fn()} onSubmit={vi.fn()} existingIds={['QA-TCT-03']} />,
  );
  fireEvent.change(screen.getByPlaceholderText('e.g. QA-TCT-03'), { target: { value: 'QA-TCT-03' } });
  expect(screen.getByText('An equipment with this name already exists.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Create Equipment/i })).toBeDisabled();
});

test('zero capacity blocks submit', () => {
  renderWithProviders(<NewEquipmentModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('e.g. QA-TCT-03'), { target: { value: 'X-1' } });
  fireEvent.change(screen.getByPlaceholderText('6'), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: /Create Equipment/i })).toBeDisabled();
});

test('a valid submit hands a normalized payload to onSubmit', () => {
  const onSubmit = vi.fn();
  renderWithProviders(<NewEquipmentModal open onClose={vi.fn()} onSubmit={onSubmit} />);

  fireEvent.change(screen.getByPlaceholderText('e.g. QA-TCT-03'), { target: { value: '  X-1  ' } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'HAST' } });
  fireEvent.change(screen.getByPlaceholderText('6'), { target: { value: '4' } });
  fireEvent.change(
    screen.getByPlaceholderText(/First line becomes the card's model label/i),
    { target: { value: 'Acme 9000\nrugged unit' } },
  );
  // Fill the single parameter row.
  fireEvent.change(screen.getByPlaceholderText(/key \(e\.g\. max_temp\)/i), {
    target: { value: '  max_temp  ' },
  });
  fireEvent.change(screen.getByPlaceholderText(/value \(e\.g\. 125/i), {
    target: { value: '  125  ' },
  });

  fireEvent.click(screen.getByRole('button', { name: /Create Equipment/i }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith({
    id: 'X-1',
    name: 'X-1',
    type: 'HAST',
    model: 'Acme 9000',
    description: 'Acme 9000\nrugged unit',
    capacity: 4,
    params: { max_temp: '125' },
    status: 'idle',
    currentWipId: null,
  });
});

test('Add parameter appends a row and Cancel invokes onClose without submitting', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  renderWithProviders(<NewEquipmentModal open onClose={onClose} onSubmit={onSubmit} />);

  expect(screen.getAllByPlaceholderText(/key \(e\.g\. max_temp\)/i)).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /Add parameter/i }));
  expect(screen.getAllByPlaceholderText(/key \(e\.g\. max_temp\)/i)).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});
