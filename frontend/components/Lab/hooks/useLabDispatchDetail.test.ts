import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// id-taking detail hook. It guards on a null id (no fetch), then on a real id
// fans out: dispatches.get -> recipes.list, then wips.get(wipId), then
// samples.getExperiments per wafer, rolling the per-sample experiment rows up
// into waferResults and joining recipe params onto the dispatch. We mock every
// method it touches and assert the transformed shape.
const dispatchesGet = vi.hoisted(() => vi.fn());
const recipesList = vi.hoisted(() => vi.fn());
const wipsGet = vi.hoisted(() => vi.fn());
const samplesGetExperiments = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    dispatches: { get: dispatchesGet },
    recipes: { list: recipesList },
    wips: { get: wipsGet },
    samples: { getExperiments: samplesGetExperiments },
  },
}));

import useLabDispatchDetail from './useLabDispatchDetail';

beforeEach(() => {
  vi.clearAllMocks();
});

test('with a null id it does not fetch and leaves dispatch empty', async () => {
  const { result } = renderHook(() => useLabDispatchDetail(null));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(dispatchesGet).not.toHaveBeenCalled();
  expect(result.current.dispatch).toBeNull();
  expect(result.current.waferResults).toEqual([]);
  expect(result.current.error).toBeNull();
});

test('with a real id it loads the dispatch and rolls up wafer results', async () => {
  dispatchesGet.mockResolvedValue({ id: 7, wipId: 100, recipeId: 3 });
  recipesList.mockResolvedValue([{ id: 3, params: { temp: 900 } }]);
  wipsGet.mockResolvedValue({
    samples: [
      { id: 51, wafer: 'W1', size: '2in' },
      { id: 52, wafer: 'W2', size: '4in' },
    ],
  });
  samplesGetExperiments.mockImplementation((sampleId: number) => {
    if (sampleId === 51) {
      return Promise.resolve([{ dispatchId: 7, verdict: 'pass', status: 'done' }]);
    }
    // sample 52 has no row matching this dispatch -> nulls
    return Promise.resolve([{ dispatchId: 999, verdict: 'fail', status: 'done' }]);
  });

  const { result } = renderHook(() => useLabDispatchDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(dispatchesGet).toHaveBeenCalledWith(7);
  // recipe params joined onto the dispatch
  expect(result.current.dispatch).toEqual({
    id: 7,
    wipId: 100,
    recipeId: 3,
    recipeParams: { temp: 900 },
  });
  expect(result.current.waferResults).toEqual([
    { sampleId: 51, wafer: 'W1', size: '2in', verdict: 'pass', status: 'done' },
    { sampleId: 52, wafer: 'W2', size: '4in', verdict: null, status: null },
  ]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the dispatch fetch rejects', async () => {
  dispatchesGet.mockRejectedValue(new Error('not found'));
  recipesList.mockResolvedValue([]);
  const { result } = renderHook(() => useLabDispatchDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('not found');
  expect(result.current.dispatch).toBeNull();
});

test('refresh re-fetches and replaces the dispatch', async () => {
  dispatchesGet.mockResolvedValue({ id: 7, wipId: 100, recipeId: 3 });
  recipesList.mockResolvedValue([{ id: 3, params: { temp: 900 } }]);
  wipsGet.mockResolvedValue({ samples: [] });
  const { result } = renderHook(() => useLabDispatchDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  dispatchesGet.mockResolvedValue({ id: 8, wipId: 100, recipeId: 3 });
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() => expect(result.current.dispatch?.id).toBe(8));
});
