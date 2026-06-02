import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/render';

// EquipmentModal is an `open`-gated controlled modal that both creates and edits
// equipment. It reads its capability options from useLabExperimentTypes (mocked
// to a mutable holder) and submits via api.equipment.create / update /
// setCapabilities (mocked default). Edit mode pre-fills from `initial`.
type HookState = { data: { id: number; name: string }[]; loading: boolean; error: string | null };
const types = vi.hoisted(
  () => ({ value: { data: [], loading: false, error: null } as HookState }),
);
vi.mock('@/components/Lab/hooks/useLabExperimentTypes', () => ({ default: () => types.value }));

const create = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const setCapabilities = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: { equipment: { create, update, setCapabilities } },
}));

import EquipmentModal from './EquipmentModal';

type EditInitial = {
  id: number;
  name?: string;
  model?: string;
  capacity?: number;
  raw_status?: string;
  capabilities?: { id: number }[];
  parameters?: Record<string, unknown>;
};
const editInitial: EditInitial = {
  id: 42,
  name: 'QA-TCT-03',
  model: 'ESPEC ARS-1100',
  capacity: 6,
  raw_status: 'maintenance',
  capabilities: [{ id: 1 }],
  parameters: { max_temp: '125' },
};

beforeEach(() => {
  vi.clearAllMocks();
  types.value = {
    data: [
      { id: 1, name: 'Temperature Cycling Test' },
      { id: 2, name: 'Highly Accelerated Stress Test' },
    ],
    loading: false,
    error: null,
  };
});

test('renders nothing while closed', () => {
  renderWithProviders(<EquipmentModal open={false} onClose={vi.fn()} />);
  expect(screen.queryByText('New Equipment')).not.toBeInTheDocument();
});

test('create mode renders empty fields and the capability options', () => {
  renderWithProviders(<EquipmentModal open onClose={vi.fn()} />);
  expect(screen.getByText('New Equipment')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('e.g. QA-TCT-03')).toHaveValue('');
  expect(screen.getByPlaceholderText('e.g. ESPEC ARS-1100')).toHaveValue('');
  expect(screen.getByText('Temperature Cycling Test')).toBeInTheDocument();
  expect(screen.getByText('Highly Accelerated Stress Test')).toBeInTheDocument();
});

test('edit mode pre-fills fields from the passed equipment', () => {
  renderWithProviders(<EquipmentModal open onClose={vi.fn()} initial={editInitial} />);
  expect(screen.getByText('Edit Equipment QA-TCT-03')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('e.g. QA-TCT-03')).toHaveValue('QA-TCT-03');
  expect(screen.getByPlaceholderText('e.g. ESPEC ARS-1100')).toHaveValue('ESPEC ARS-1100');
  // Status select only renders in edit mode.
  expect(screen.getByRole('combobox')).toHaveValue('maintenance');
  // First capability checkbox is pre-checked from initial.capabilities.
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes[0]).toBeChecked();
  expect(checkboxes[1]).not.toBeChecked();
});

test('the primary action is gated until required fields are valid', () => {
  renderWithProviders(<EquipmentModal open onClose={vi.fn()} />);
  // Name + Model both blank: invalid.
  expect(screen.getByRole('button', { name: /Create Equipment/i })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('e.g. QA-TCT-03'), { target: { value: 'X-1' } });
  // Model still blank: still invalid.
  expect(screen.getByRole('button', { name: /Create Equipment/i })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('e.g. ESPEC ARS-1100'), {
    target: { value: 'Acme 9000' },
  });
  expect(screen.getByRole('button', { name: /Create Equipment/i })).toBeEnabled();
});

test('a valid create submits the camelCase body and then calls onSaved', async () => {
  const onSaved = vi.fn();
  create.mockResolvedValue({});
  renderWithProviders(<EquipmentModal open onClose={vi.fn()} onSaved={onSaved} />);

  fireEvent.change(screen.getByPlaceholderText('e.g. QA-TCT-03'), {
    target: { value: '  X-1  ' },
  });
  fireEvent.change(screen.getByPlaceholderText('e.g. ESPEC ARS-1100'), {
    target: { value: '  Acme 9000  ' },
  });
  // Select the second capability.
  fireEvent.click(screen.getAllByRole('checkbox')[1]);
  fireEvent.click(screen.getByRole('button', { name: /Create Equipment/i }));

  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith({
    name: 'X-1',
    modelName: 'Acme 9000',
    capacity: 1,
    experimentTypeIds: [2],
    parameters: {},
  });
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
});

test('a valid edit calls update with the changed fields and setCapabilities when caps change', async () => {
  const onSaved = vi.fn();
  update.mockResolvedValue({});
  setCapabilities.mockResolvedValue({});
  renderWithProviders(<EquipmentModal open onClose={vi.fn()} onSaved={onSaved} initial={editInitial} />);

  // Toggle on the second capability so caps differ from initial ([1] -> [1, 2]).
  fireEvent.click(screen.getAllByRole('checkbox')[1]);
  fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(update).toHaveBeenCalledWith(42, {
    name: 'QA-TCT-03',
    modelName: 'ESPEC ARS-1100',
    capacity: 6,
    status: 'maintenance',
    parameters: { max_temp: '125' },
  });
  await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith(42, [1, 2]));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
});

test('invalid Parameters JSON blocks submit and surfaces an error', async () => {
  renderWithProviders(<EquipmentModal open onClose={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('e.g. QA-TCT-03'), { target: { value: 'X-1' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. ESPEC ARS-1100'), {
    target: { value: 'Acme 9000' },
  });
  fireEvent.change(screen.getByPlaceholderText('{"key": "value"}'), {
    target: { value: 'not json' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Create Equipment/i }));

  expect(await screen.findByText('Parameters must be valid JSON.')).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

test('Cancel invokes onClose without submitting', () => {
  const onClose = vi.fn();
  renderWithProviders(<EquipmentModal open onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
});
