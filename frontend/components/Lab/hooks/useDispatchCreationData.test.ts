import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/render';

// useDispatchCreationData(experimentId) guards a null id (no fetch), otherwise
// calls api.equipment.list() and api.recipes.list() via Promise.all. It filters
// equipment to those whose `capabilities` include a capability with id ===
// experimentId, and recipes to those whose `experimentId` matches. Exposes
// { equipment, recipes, loading, error } (no refresh).
const equipmentList = vi.hoisted(() => vi.fn());
const recipesList = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    equipment: { list: equipmentList },
    recipes: { list: recipesList },
  },
}));

import useDispatchCreationData from './useDispatchCreationData';

beforeEach(() => {
  vi.clearAllMocks();
});

test('skips fetching when experimentId is null', async () => {
  const { result } = renderHook(() => useDispatchCreationData(null));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(equipmentList).not.toHaveBeenCalled();
  expect(recipesList).not.toHaveBeenCalled();
  expect(result.current.equipment).toEqual([]);
  expect(result.current.recipes).toEqual([]);
  expect(result.current.error).toBeNull();
});

test('starts in a loading state for a real experimentId', () => {
  equipmentList.mockReturnValue(new Promise(() => {})); // never settles
  recipesList.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useDispatchCreationData(5));
  expect(result.current.loading).toBe(true);
  expect(result.current.equipment).toEqual([]);
  expect(result.current.recipes).toEqual([]);
});

test('filters equipment by capability id and recipes by experimentId', async () => {
  equipmentList.mockResolvedValue([
    { id: 1, name: 'Furnace', capabilities: [{ id: 5 }, { id: 8 }] }, // match
    { id: 2, name: 'Etcher', capabilities: [{ id: 9 }] }, // no match
    { id: 3, name: 'No caps' }, // capabilities undefined -> excluded
  ]);
  recipesList.mockResolvedValue([
    { id: 100, experimentId: 5 }, // match
    { id: 101, experimentId: 6 }, // no match
  ]);

  const { result } = renderHook(() => useDispatchCreationData(5));
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.equipment).toEqual([
    { id: 1, name: 'Furnace', capabilities: [{ id: 5 }, { id: 8 }] },
  ]);
  expect(result.current.recipes).toEqual([{ id: 100, experimentId: 5 }]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when a request rejects', async () => {
  equipmentList.mockRejectedValue(new Error('network down'));
  recipesList.mockResolvedValue([]);

  const { result } = renderHook(() => useDispatchCreationData(5));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.equipment).toEqual([]);
  expect(result.current.recipes).toEqual([]);
});
