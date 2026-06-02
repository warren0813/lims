import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// MgrRecipes reads useMgrRecipes and renders one row per recipe with edit /
// delete actions plus a New Recipe button that opens RecipeModal. RecipeModal
// fetches experiment types and owns the create/update calls, so stub it to a
// div exposing its open state and onSaved callback. Delete is window.confirm
// guarded and calls api.recipes.remove directly.
const hook = vi.hoisted(() => ({
  value: {
    data: [] as Record<string, unknown>[],
    loading: false,
    error: null as string | null,
    refresh: vi.fn(),
  },
}));
vi.mock('@/components/Manager/hooks/useMgrRecipes', () => ({ default: () => hook.value }));

const remove = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { recipes: { remove } } }));

vi.mock('@/components/Manager/RecipeModal', () => ({
  default: ({ open, onSaved }: { open: boolean; onSaved?: () => void; onClose: () => void }) =>
    open ? (
      <div data-testid="recipe-modal">
        <button onClick={() => onSaved?.()}>Save Recipe</button>
      </div>
    ) : null,
}));

import MgrRecipes from './MgrRecipes';

const recipe = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  name: 'TCT_Standard_v1',
  description: 'standard reflow',
  experimentId: 10,
  experimentName: 'Thermal Cycle Test',
  params: { temp: '125', cycles: '500' },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: [], loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { data: [], loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<MgrRecipes />);
  // "Loading…" appears in both the Page subtitle and the body placeholder.
  expect(screen.getAllByText('Loading…').length).toBeGreaterThanOrEqual(1);
});

test('renders a row per recipe once loaded', () => {
  hook.value.data = [
    recipe({ id: 1, name: 'Recipe One' }),
    recipe({ id: 2, name: 'Recipe Two' }),
  ];
  renderWithProviders(<MgrRecipes />);
  expect(screen.getByText('Recipe One')).toBeInTheDocument();
  expect(screen.getByText('Recipe Two')).toBeInTheDocument();
});

test('shows the empty-state card when there are no recipes', () => {
  hook.value.data = [];
  renderWithProviders(<MgrRecipes />);
  expect(screen.getByText('No recipes yet')).toBeInTheDocument();
});

test('surfaces the hook error in a banner', () => {
  hook.value = { data: [], loading: false, error: 'boom', refresh: vi.fn() };
  renderWithProviders(<MgrRecipes />);
  expect(screen.getByText(/Couldn.t load recipes: boom/)).toBeInTheDocument();
});

test('the New Recipe button opens the recipe modal', () => {
  renderWithProviders(<MgrRecipes />);
  expect(screen.queryByTestId('recipe-modal')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /New Recipe/i }));
  expect(screen.getByTestId('recipe-modal')).toBeInTheDocument();
});

test('saving in the modal refreshes the list and toasts', () => {
  const refresh = vi.fn();
  const showToast = vi.fn();
  hook.value = { data: [], loading: false, error: null, refresh };
  renderWithProviders(<MgrRecipes showToast={showToast} />);
  fireEvent.click(screen.getByRole('button', { name: /New Recipe/i }));
  fireEvent.click(screen.getByText('Save Recipe'));
  expect(refresh).toHaveBeenCalled();
  expect(showToast).toHaveBeenCalledWith('Recipe created');
  // Modal closes after save.
  expect(screen.queryByTestId('recipe-modal')).not.toBeInTheDocument();
});

test('editing an existing recipe opens the modal then saves with an update toast', () => {
  const refresh = vi.fn();
  const showToast = vi.fn();
  hook.value = { data: [recipe({ id: 5, name: 'Editable' })], loading: false, error: null, refresh };
  renderWithProviders(<MgrRecipes showToast={showToast} />);
  fireEvent.click(screen.getByRole('button', { name: /^Edit$/ }));
  expect(screen.getByTestId('recipe-modal')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Save Recipe'));
  expect(showToast).toHaveBeenCalledWith('Recipe updated');
  expect(refresh).toHaveBeenCalled();
});

test('deleting a recipe confirms, calls api.recipes.remove, then refreshes and toasts', async () => {
  const refresh = vi.fn();
  const showToast = vi.fn();
  hook.value = {
    data: [recipe({ id: 8, name: 'Deletable' })],
    loading: false,
    error: null,
    refresh,
  };
  remove.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<MgrRecipes showToast={showToast} />);
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));

  expect(confirmSpy).toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith(8);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(showToast).toHaveBeenCalledWith('Deletable deleted');
  confirmSpy.mockRestore();
});

test('declining the delete confirm does not call the api', () => {
  hook.value = { data: [recipe({ id: 8 })], loading: false, error: null, refresh: vi.fn() };
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderWithProviders(<MgrRecipes />);
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
  expect(remove).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('surfaces a delete failure in a banner', async () => {
  hook.value = {
    data: [recipe({ id: 8, name: 'Deletable' })],
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
  remove.mockRejectedValue(new Error('cannot delete'));
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<MgrRecipes />);
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));

  await vi.waitFor(() => expect(screen.getByText('cannot delete')).toBeInTheDocument());
  confirmSpy.mockRestore();
});
