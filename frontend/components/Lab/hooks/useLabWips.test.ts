import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// useLabWips calls a single api.wips.list() and exposes { wips, loading,
// error, refresh } following the standard data-hook lifecycle.
const wipsList = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { wips: { list: wipsList } } }));

import useLabWips from './useLabWips';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty wips', () => {
  wipsList.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useLabWips());
  expect(result.current.loading).toBe(true);
  expect(result.current.wips).toEqual([]);
});

test('exposes the fetched wips once the request resolves', async () => {
  wipsList.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const { result } = renderHook(() => useLabWips());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.wips).toEqual([{ id: 1 }, { id: 2 }]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  wipsList.mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useLabWips());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.wips).toEqual([]);
});

test('refresh re-fetches and replaces the wips', async () => {
  wipsList.mockResolvedValue([{ id: 1 }]);
  const { result } = renderHook(() => useLabWips());
  await waitFor(() => expect(result.current.loading).toBe(false));

  wipsList.mockResolvedValue([{ id: 9 }]);
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() => expect(result.current.wips).toEqual([{ id: 9 }]));
});
