import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';

// The Inner form fetches experiment types / eligible wafers / equipment from a
// data hook and submits via api.wips.create. Mock BOTH: the hook (controlled
// options via a mutable hoisted holder) and the api default (resolved create).
type HookState = {
  experimentTypes: Record<string, unknown>[];
  pickerSamples: Record<string, unknown>[];
  equipment: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
};
const hook = vi.hoisted(
  () =>
    ({
      value: {
        experimentTypes: [],
        pickerSamples: [],
        equipment: [],
        loading: false,
        error: null,
      } as HookState,
    }) as { value: HookState },
);
vi.mock('@/components/Lab/hooks/useWipCreationData', () => ({ default: () => hook.value }));

const create = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { wips: { create } } }));

import WipCreationModalInner from './WipCreationModalInner';

const experimentTypes: Record<string, unknown>[] = [
  { id: 9, name: 'Etch', labCategory: 'Dry' },
  { id: 10, name: 'Deposit' },
];
const equipment: Record<string, unknown>[] = [
  { id: 1, name: 'Etcher A', capacity: 2, capabilities: [{ id: 9 }] },
];
const pickerSamples: Record<string, unknown>[] = [
  { id: 100, wafer: 'W-100', size: '6"', requestId: 7, expIds: [9], blockReason: null },
  { id: 101, wafer: 'W-101', size: '6"', requestId: 7, expIds: [9], blockReason: null },
  {
    id: 102,
    wafer: 'W-102',
    size: '6"',
    requestId: 8,
    expIds: [9],
    blockReason: 'not_received',
  },
];

const loaded = (): HookState => ({
  experimentTypes,
  pickerSamples,
  equipment,
  loading: false,
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = {
    experimentTypes: [],
    pickerSamples: [],
    equipment: [],
    loading: false,
    error: null,
  };
});

test('renders the experiment-type options and the empty wafer prompt', () => {
  hook.value = loaded();
  renderWithProviders(<WipCreationModalInner onClose={vi.fn()} />);

  expect(screen.getByText('New WIP')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Etch (Dry)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Deposit' })).toBeInTheDocument();
  // Before a type is picked, wafers are not shown.
  expect(screen.getByText(/Pick an experiment type to see eligible wafers/)).toBeInTheDocument();
});

test('shows the loading note while the hook is fetching', () => {
  hook.value = { ...loaded(), loading: true };
  renderWithProviders(<WipCreationModalInner onClose={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('surfaces a hook load error', () => {
  hook.value = { ...loaded(), error: 'fetch failed' };
  renderWithProviders(<WipCreationModalInner onClose={vi.fn()} />);
  expect(screen.getByText('fetch failed')).toBeInTheDocument();
});

test('picking an experiment type reveals eligible wafers (blocked ones disabled)', async () => {
  const user = userEvent.setup();
  hook.value = loaded();
  renderWithProviders(<WipCreationModalInner onClose={vi.fn()} />);

  await user.selectOptions(screen.getByRole('combobox'), '9');

  expect(screen.getByText('W-100')).toBeInTheDocument();
  expect(screen.getByText('W-101')).toBeInTheDocument();
  // not_received wafer is shown but its checkbox is disabled.
  expect(screen.getByText('W-102')).toBeInTheDocument();
  expect(screen.getByText('Not yet received at lab')).toBeInTheDocument();
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes).toHaveLength(3);
  expect(checkboxes[2]).toBeDisabled();
});

test('Create is gated until a type and at least one wafer are selected', async () => {
  const user = userEvent.setup();
  hook.value = loaded();
  renderWithProviders(<WipCreationModalInner onClose={vi.fn()} />);

  const createBtn = screen.getByRole('button', { name: /Create WIP/i });
  expect(createBtn).toBeDisabled();

  await user.selectOptions(screen.getByRole('combobox'), '9');
  expect(createBtn).toBeDisabled(); // type chosen, no wafers yet

  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);
  expect(createBtn).toBeEnabled();
});

test('submits the selected type + samples + trimmed note and fires onSaved', async () => {
  const user = userEvent.setup();
  const onSaved = vi.fn();
  create.mockResolvedValue({ id: 55 });
  hook.value = loaded();
  renderWithProviders(<WipCreationModalInner onClose={vi.fn()} onSaved={onSaved} />);

  await user.selectOptions(screen.getByRole('combobox'), '9');
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]); // W-100 (id 100)
  fireEvent.click(checkboxes[1]); // W-101 (id 101)
  await user.type(screen.getByPlaceholderText(/Anything the operator should know/i), '  batch  ');

  fireEvent.click(screen.getByRole('button', { name: /Create WIP/i }));

  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 55 }));
  expect(create).toHaveBeenCalledWith({
    experimentTypeId: 9,
    sampleIds: [100, 101],
    note: 'batch',
  });
});

test('Cancel invokes onClose without calling the api', () => {
  const onClose = vi.fn();
  hook.value = loaded();
  renderWithProviders(<WipCreationModalInner onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
});
