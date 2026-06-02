import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';

// The Inner form fetches its equipment + recipe options from a data hook and
// submits via api.wips.createDispatch. Mock BOTH: the hook (controlled options
// via a mutable hoisted holder) and the api default (resolved create method).
// Everything else (Modal, buttons, selects) renders for real.
type HookState = {
  equipment: Record<string, unknown>[];
  recipes: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
};
const hook = vi.hoisted(
  () =>
    ({
      value: { equipment: [], recipes: [], loading: false, error: null } as HookState,
    }) as { value: HookState },
);
vi.mock('@/components/Lab/hooks/useDispatchCreationData', () => ({ default: () => hook.value }));

const createDispatch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { wips: { createDispatch } } }));

import AddDispatchModalInner from './AddDispatchModalInner';

const wip = { id: 12, experimentId: 9, experimentName: 'Etch run', sampleCount: 3 };

const equipment: Record<string, unknown>[] = [
  { id: 1, name: 'Etcher A', model: 'X100', status: 'idle', capabilities: [{ id: 9 }] },
  { id: 2, name: 'Etcher B', model: 'X200', status: 'maintenance', capabilities: [{ id: 9 }] },
];
const recipes: Record<string, unknown>[] = [
  { id: 11, name: 'Recipe Alpha', experimentId: 9, params: { temp_c: 200, gas: 'Ar' } },
  { id: 12, name: 'Recipe Beta', experimentId: 9, params: {} },
];

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { equipment: [], recipes: [], loading: false, error: null };
});

test('renders the WIP header summary and the loaded options', () => {
  hook.value = { equipment, recipes, loading: false, error: null };
  renderWithProviders(<AddDispatchModalInner onClose={vi.fn()} wip={wip} />);

  expect(screen.getByText('Add Dispatch')).toBeInTheDocument();
  expect(screen.getByText('WIP-0012')).toBeInTheDocument();
  expect(screen.getByText('Etch run')).toBeInTheDocument();
  // Options come from the hook data.
  expect(screen.getByRole('option', { name: /Etcher A · X100/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Recipe Alpha/ })).toBeInTheDocument();
});

test('shows the loading note while the hook is fetching', () => {
  hook.value = { equipment: [], recipes: [], loading: true, error: null };
  renderWithProviders(<AddDispatchModalInner onClose={vi.fn()} wip={wip} />);
  expect(screen.getByText(/Loading equipment \+ recipes…/)).toBeInTheDocument();
});

test('surfaces a hook load error', () => {
  hook.value = { equipment: [], recipes: [], loading: false, error: 'kaboom' };
  renderWithProviders(<AddDispatchModalInner onClose={vi.fn()} wip={wip} />);
  expect(screen.getByText('kaboom')).toBeInTheDocument();
});

test('the Create button is gated until equipment + recipe are picked', async () => {
  const user = userEvent.setup();
  hook.value = { equipment, recipes, loading: false, error: null };
  renderWithProviders(<AddDispatchModalInner onClose={vi.fn()} wip={wip} />);

  const createBtn = screen.getByRole('button', { name: /Create Dispatch/i });
  expect(createBtn).toBeDisabled();

  const [equipmentSelect, recipeSelect] = screen.getAllByRole('combobox');
  await user.selectOptions(equipmentSelect, '1');
  expect(createBtn).toBeDisabled(); // recipe still missing

  await user.selectOptions(recipeSelect, '11');
  expect(createBtn).toBeEnabled();
});

test('does not call the api when required fields are missing', () => {
  hook.value = { equipment, recipes, loading: false, error: null };
  renderWithProviders(<AddDispatchModalInner onClose={vi.fn()} wip={wip} />);
  // Button is disabled, but a forced click must still not fire the api.
  fireEvent.click(screen.getByRole('button', { name: /Create Dispatch/i }));
  expect(createDispatch).not.toHaveBeenCalled();
});

test('submits the snake-case-mapped body and fires onCreated on resolve', async () => {
  const user = userEvent.setup();
  const onCreated = vi.fn();
  createDispatch.mockResolvedValue({ id: 99 });
  hook.value = { equipment, recipes, loading: false, error: null };
  renderWithProviders(
    <AddDispatchModalInner onClose={vi.fn()} wip={wip} onCreated={onCreated} />,
  );

  const [equipmentSelect, recipeSelect] = screen.getAllByRole('combobox');
  await user.selectOptions(equipmentSelect, '1');
  await user.selectOptions(recipeSelect, '11');
  await user.type(screen.getByPlaceholderText(/Seconds — leave blank if unknown/i), '600');
  await user.type(screen.getByPlaceholderText(/Anything the operator should know/i), '  go  ');

  fireEvent.click(screen.getByRole('button', { name: /Create Dispatch/i }));

  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  expect(createDispatch).toHaveBeenCalledWith(12, {
    equipmentId: 1,
    recipeId: 11,
    estimatedDurationSeconds: 600,
    note: 'go',
  });
});

test('a duration preset chip fills the estimate field', async () => {
  const user = userEvent.setup();
  createDispatch.mockResolvedValue({ id: 1 });
  hook.value = { equipment, recipes, loading: false, error: null };
  renderWithProviders(<AddDispatchModalInner onClose={vi.fn()} wip={wip} />);

  fireEvent.click(screen.getByRole('button', { name: '1m' }));
  const durationField = screen.getByPlaceholderText(/Seconds — leave blank if unknown/i);
  expect(durationField).toHaveValue(60);

  const [equipmentSelect, recipeSelect] = screen.getAllByRole('combobox');
  await user.selectOptions(equipmentSelect, '1');
  await user.selectOptions(recipeSelect, '11');
  fireEvent.click(screen.getByRole('button', { name: /Create Dispatch/i }));

  await vi.waitFor(() => expect(createDispatch).toHaveBeenCalled());
  expect(createDispatch).toHaveBeenCalledWith(12, {
    equipmentId: 1,
    recipeId: 11,
    estimatedDurationSeconds: 60,
    note: '',
  });
});

test('Cancel invokes onClose without calling the api', () => {
  const onClose = vi.fn();
  hook.value = { equipment, recipes, loading: false, error: null };
  renderWithProviders(<AddDispatchModalInner onClose={onClose} wip={wip} />);
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(createDispatch).not.toHaveBeenCalled();
});
