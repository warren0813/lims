import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/render';

// Mock the single resource method the hook reads off the default api export.
// This hook has no refresh (effect-only, no useCallback handle).
const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { experimentTypes: { list } } }));

import useMgrExperimentTypes from './useMgrExperimentTypes';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty data', () => {
  list.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useMgrExperimentTypes());
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toEqual([]);
});

test('exposes the fetched rows once the request resolves', async () => {
  list.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const { result } = renderHook(() => useMgrExperimentTypes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  list.mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useMgrExperimentTypes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.data).toEqual([]);
});
