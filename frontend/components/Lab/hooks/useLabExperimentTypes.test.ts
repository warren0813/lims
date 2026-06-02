import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/render';

// Mirrors the proven useRequests template. This hook calls one resource method
// (experimentTypes.list), returns its rows under `data`, and exposes no
// refresh, so only the loading/data/error lifecycle is exercised.
const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { experimentTypes: { list } } }));

import useLabExperimentTypes from './useLabExperimentTypes';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty data', () => {
  list.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useLabExperimentTypes());
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toEqual([]);
});

test('exposes the fetched rows once the request resolves', async () => {
  list.mockResolvedValue([{ id: 1, name: 'XRD' }, { id: 2, name: 'SEM' }]);
  const { result } = renderHook(() => useLabExperimentTypes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toEqual([{ id: 1, name: 'XRD' }, { id: 2, name: 'SEM' }]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  list.mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useLabExperimentTypes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.data).toEqual([]);
});
