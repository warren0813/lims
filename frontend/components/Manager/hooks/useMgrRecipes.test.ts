import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// Mock the single resource method the hook reads off the default api export.
const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { recipes: { list } } }));

import useMgrRecipes from './useMgrRecipes';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty data', () => {
  list.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useMgrRecipes());
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toEqual([]);
});

test('exposes the fetched rows once the request resolves', async () => {
  list.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const { result } = renderHook(() => useMgrRecipes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  list.mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useMgrRecipes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.data).toEqual([]);
});

test('refresh re-fetches and replaces the data', async () => {
  list.mockResolvedValue([{ id: 1 }]);
  const { result } = renderHook(() => useMgrRecipes());
  await waitFor(() => expect(result.current.loading).toBe(false));

  list.mockResolvedValue([{ id: 9 }]);
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() => expect(result.current.data).toEqual([{ id: 9 }]));
});
