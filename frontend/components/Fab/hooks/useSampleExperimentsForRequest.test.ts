import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/render';

// Data hooks read the default `@/lib/api` export and call one resource method.
// This hook fans out one `api.samples.getExperiments(id)` call per sample and
// collects the results into a `byId` map keyed by sample id. Mock that method
// with a hoisted spy and drive the loading/data lifecycle. `renderHook` +
// `waitFor` come from the shared render helper.
const getExperiments = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { samples: { getExperiments } } }));

import useSampleExperimentsForRequest from './useSampleExperimentsForRequest';

beforeEach(() => {
  vi.clearAllMocks();
});

test('skips fetching and stays empty when there are no samples', async () => {
  const { result } = renderHook(() => useSampleExperimentsForRequest(null));
  // No ids → effect resets the map and never flips loading on.
  expect(result.current.loading).toBe(false);
  expect(result.current.byId).toEqual({});
  expect(getExperiments).not.toHaveBeenCalled();
});

test('enters a loading state while the sample fetches are in flight', () => {
  getExperiments.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() =>
    useSampleExperimentsForRequest([{ id: 1 }]),
  );
  expect(result.current.loading).toBe(true);
  expect(result.current.byId).toEqual({});
});

test('collects experiments for every sample into a byId map', async () => {
  getExperiments
    .mockResolvedValueOnce([{ id: 'e1' }])
    .mockResolvedValueOnce([{ id: 'e2' }, { id: 'e3' }]);
  const { result } = renderHook(() =>
    useSampleExperimentsForRequest([{ id: 1 }, { id: 2 }]),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getExperiments).toHaveBeenCalledTimes(2);
  expect(getExperiments).toHaveBeenCalledWith(1);
  expect(getExperiments).toHaveBeenCalledWith(2);
  expect(result.current.byId).toEqual({
    '1': [{ id: 'e1' }],
    '2': [{ id: 'e2' }, { id: 'e3' }],
  });
});

test('falls back to an empty list for a sample whose fetch rejects', async () => {
  getExperiments
    .mockResolvedValueOnce([{ id: 'e1' }])
    .mockRejectedValueOnce(new Error('boom'));
  const { result } = renderHook(() =>
    useSampleExperimentsForRequest([{ id: 1 }, { id: 2 }]),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.byId).toEqual({
    '1': [{ id: 'e1' }],
    '2': [],
  });
});
