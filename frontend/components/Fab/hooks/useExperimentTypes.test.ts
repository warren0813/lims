import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/render';

// Data hooks read the default `@/lib/api` export and call one resource method.
// Mock just that method with a hoisted spy and drive the loading/data/error
// lifecycle. `renderHook` + `waitFor` come from the shared render helper.
const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { experimentTypes: { list } } }));

import useExperimentTypes from './useExperimentTypes';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty data', () => {
  list.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useExperimentTypes());
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toEqual([]);
});

test('exposes the fetched rows once the request resolves', async () => {
  list.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const { result } = renderHook(() => useExperimentTypes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(list).toHaveBeenCalledTimes(1);
  expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  list.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useExperimentTypes());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('boom');
  expect(result.current.data).toEqual([]);
});
