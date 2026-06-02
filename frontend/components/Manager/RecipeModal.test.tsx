import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';

// RecipeModal is a controlled modal (`open` gates the shared Modal wrapper) that
// owns its own create/update calls — it does NOT delegate to a parent. It reads
// experiment types from useMgrExperimentTypes (mocked to a mutable holder) and,
// on submit, calls api.recipes.create / api.recipes.update (mocked) then onSaved.
type TypesState = {
  data: { id: number; name: string }[];
  loading: boolean;
  error: string | null;
};
const typesHook = vi.hoisted(
  () => ({ value: { data: [], loading: false, error: null } as TypesState }),
);
vi.mock('@/components/Manager/hooks/useMgrExperimentTypes', () => ({
  default: () => typesHook.value,
}));

const create = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { recipes: { create, update } } }));

import RecipeModal from './RecipeModal';

const experimentTypes = [
  { id: 10, name: 'Thermal Cycle Test' }, // not a known slug -> free-form JSON params
  { id: 20, name: 'Final Test' }, // maps to slug "ft" -> schema-driven params
];

const editInitial: Record<string, unknown> = {
  id: 5,
  name: 'TCT_Standard_v1',
  description: 'standard reflow',
  experimentId: 10,
  experimentName: 'Some Custom Experiment',
  params: { temp: '125', cycles: '500' },
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  typesHook.value = { data: experimentTypes, loading: false, error: null };
});

test('renders nothing while closed', () => {
  renderWithProviders(<RecipeModal open={false} onClose={vi.fn()} />);
  expect(screen.queryByText('New Recipe')).not.toBeInTheDocument();
});

test('renders the create form with name, type, description and params fields', () => {
  renderWithProviders(<RecipeModal open onClose={vi.fn()} />);
  expect(screen.getByText('New Recipe')).toBeInTheDocument();
  expect(screen.getByText('Name')).toBeInTheDocument();
  expect(screen.getByText('Experiment Type')).toBeInTheDocument();
  expect(screen.getByText('Description')).toBeInTheDocument();
  expect(screen.getByText('Parameters')).toBeInTheDocument();
  // The selectable experiment types are present as options.
  expect(screen.getByRole('option', { name: 'Thermal Cycle Test' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Final Test' })).toBeInTheDocument();
});

test('the primary action is gated until a name is entered', async () => {
  const user = userEvent.setup();
  renderWithProviders(<RecipeModal open onClose={vi.fn()} />);
  const createBtn = screen.getByRole('button', { name: /Create Recipe/i });
  expect(createBtn).toBeDisabled();
  await user.type(screen.getByPlaceholderText(/TCT_Standard_Reflow/i), 'My Recipe');
  expect(createBtn).toBeEnabled();
});

test('create submits api.recipes.create with the trimmed payload then calls onSaved', async () => {
  const onSaved = vi.fn();
  const user = userEvent.setup();
  create.mockResolvedValue({});
  renderWithProviders(<RecipeModal open onClose={vi.fn()} onSaved={onSaved} />);
  await user.type(screen.getByPlaceholderText(/TCT_Standard_Reflow/i), '  My Recipe  ');
  // First type "Thermal Cycle Test" (id 10) has no schema -> free-form JSON box.
  fireEvent.click(screen.getByRole('button', { name: /Create Recipe/i }));
  await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith({
    name: 'My Recipe',
    description: '',
    experimentTypeId: 10,
    parameters: {},
  });
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(update).not.toHaveBeenCalled();
});

test('create rejects invalid JSON parameters with an inline error and no api call', async () => {
  const user = userEvent.setup();
  renderWithProviders(<RecipeModal open onClose={vi.fn()} />);
  await user.type(screen.getByPlaceholderText(/TCT_Standard_Reflow/i), 'Bad Params');
  const jsonBox = screen.getByPlaceholderText('{"key": "value"}');
  await user.clear(jsonBox);
  await user.type(jsonBox, 'not json');
  fireEvent.click(screen.getByRole('button', { name: /Create Recipe/i }));
  expect(await screen.findByText('Parameters must be valid JSON.')).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

test('edit mode locks the experiment type and updates via api.recipes.update', async () => {
  const onSaved = vi.fn();
  update.mockResolvedValue({});
  renderWithProviders(<RecipeModal open onClose={vi.fn()} onSaved={onSaved} initial={editInitial} />);
  expect(screen.getByText('Edit Recipe')).toBeInTheDocument();
  // The type is locked (shown as text, not a select).
  expect(screen.getByText('(locked)')).toBeInTheDocument();
  // Name is prefilled from the initial recipe.
  expect(screen.getByDisplayValue('TCT_Standard_v1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
  await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(update).toHaveBeenCalledWith(5, {
    name: 'TCT_Standard_v1',
    description: 'standard reflow',
    parameters: { temp: '125', cycles: '500' },
  });
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(create).not.toHaveBeenCalled();
});

test('surfaces an api failure as an inline error banner', async () => {
  const user = userEvent.setup();
  create.mockRejectedValue(new Error('name already taken'));
  renderWithProviders(<RecipeModal open onClose={vi.fn()} />);
  await user.type(screen.getByPlaceholderText(/TCT_Standard_Reflow/i), 'Dup');
  fireEvent.click(screen.getByRole('button', { name: /Create Recipe/i }));
  expect(await screen.findByText('name already taken')).toBeInTheDocument();
});

test('Cancel invokes onClose without calling the api', () => {
  const onClose = vi.fn();
  renderWithProviders(<RecipeModal open onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
