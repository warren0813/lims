import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// Mirrors the proven useRequests template: one hoisted spy for the single
// resource method this hook calls, driven through the loading/data/error
// lifecycle plus a refresh re-fetch.
const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { equipment: { list } } }));

import useLabEquipment from './useLabEquipment';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty equipment', () => {
  list.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useLabEquipment());
  expect(result.current.loading).toBe(true);
  expect(result.current.equipment).toEqual([]);
});

test('exposes the fetched equipment once the request resolves', async () => {
  list.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const { result } = renderHook(() => useLabEquipment());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.equipment).toEqual([{ id: 1 }, { id: 2 }]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  list.mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useLabEquipment());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.equipment).toEqual([]);
});

test('refresh re-fetches and replaces the equipment', async () => {
  list.mockResolvedValue([{ id: 1 }]);
  const { result } = renderHook(() => useLabEquipment());
  await waitFor(() => expect(result.current.loading).toBe(false));

  list.mockResolvedValue([{ id: 9 }]);
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() => expect(result.current.equipment).toEqual([{ id: 9 }]));
});
