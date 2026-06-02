import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// useWaferDetail(id) guards a null id (no fetch). For a real id it:
//   1. api.samples.get(id)
//   2. Promise.all([api.requests.get(sample.requestId) (guarded -> null),
//                   api.samples.getExperiments(sample.id) (guarded -> [])])
//   3. if sample.hasWip: api.wips.list({status:'in_progress'}), then
//      api.wips.get(row.id) for each row until one whose `samples` contains the
//      sample id is found -> that detail becomes `wip`.
// It assembles { sample, request, wip, experiments } into `data`.
const samplesGet = vi.hoisted(() => vi.fn());
const samplesGetExperiments = vi.hoisted(() => vi.fn());
const requestsGet = vi.hoisted(() => vi.fn());
const wipsList = vi.hoisted(() => vi.fn());
const wipsGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    samples: { get: samplesGet, getExperiments: samplesGetExperiments },
    requests: { get: requestsGet },
    wips: { list: wipsList, get: wipsGet },
  },
}));

import useWaferDetail from './useWaferDetail';

beforeEach(() => {
  vi.clearAllMocks();
});

test('skips fetching when id is null', async () => {
  const { result } = renderHook(() => useWaferDetail(null));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(samplesGet).not.toHaveBeenCalled();
  expect(result.current.data).toBeNull();
  expect(result.current.error).toBeNull();
});

test('starts in a loading state for a real id', () => {
  samplesGet.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useWaferDetail(7));
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBeNull();
});

test('assembles sample, request and experiments without a wip', async () => {
  samplesGet.mockResolvedValue({ id: 7, requestId: 50, hasWip: false });
  requestsGet.mockResolvedValue({ id: 50, urgency: '3d' });
  samplesGetExperiments.mockResolvedValue([{ id: 200 }]);

  const { result } = renderHook(() => useWaferDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(samplesGet).toHaveBeenCalledWith(7);
  expect(requestsGet).toHaveBeenCalledWith(50);
  expect(samplesGetExperiments).toHaveBeenCalledWith(7);
  expect(wipsList).not.toHaveBeenCalled();
  expect(result.current.data).toEqual({
    sample: { id: 7, requestId: 50, hasWip: false },
    request: { id: 50, urgency: '3d' },
    wip: null,
    experiments: [{ id: 200 }],
  });
  expect(result.current.error).toBeNull();
});

test('walks in-progress wips to find the one containing the sample', async () => {
  samplesGet.mockResolvedValue({ id: 7, requestId: 50, hasWip: true });
  requestsGet.mockResolvedValue({ id: 50, urgency: '3d' });
  samplesGetExperiments.mockResolvedValue([]);
  wipsList.mockResolvedValue([{ id: 90 }, { id: 91 }]);
  wipsGet.mockImplementation((wipId: number) => {
    if (wipId === 90) return Promise.resolve({ id: 90, samples: [{ id: 999 }] });
    if (wipId === 91) return Promise.resolve({ id: 91, samples: [{ id: 7 }] });
    return Promise.resolve(null);
  });

  const { result } = renderHook(() => useWaferDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(wipsList).toHaveBeenCalledWith({ status: 'in_progress' });
  expect(result.current.data?.wip).toEqual({ id: 91, samples: [{ id: 7 }] });
  expect(result.current.error).toBeNull();
});

test('falls back to null request when requests.get rejects', async () => {
  samplesGet.mockResolvedValue({ id: 7, requestId: 50, hasWip: false });
  requestsGet.mockRejectedValue(new Error('no request'));
  samplesGetExperiments.mockResolvedValue([]);

  const { result } = renderHook(() => useWaferDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  // guarded -> no error, request resolves to null
  expect(result.current.error).toBeNull();
  expect(result.current.data?.request).toBeNull();
});

test('captures the error message when samples.get rejects', async () => {
  samplesGet.mockRejectedValue(new Error('sample missing'));

  const { result } = renderHook(() => useWaferDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('sample missing');
  expect(result.current.data).toBeNull();
});

test('refresh re-fetches and replaces the data', async () => {
  samplesGet.mockResolvedValue({ id: 7, requestId: 50, hasWip: false });
  requestsGet.mockResolvedValue({ id: 50, urgency: '3d' });
  samplesGetExperiments.mockResolvedValue([]);
  const { result } = renderHook(() => useWaferDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  samplesGet.mockResolvedValue({ id: 7, requestId: 50, hasWip: false, note: 'updated' });
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() =>
    expect(result.current.data?.sample).toEqual({
      id: 7,
      requestId: 50,
      hasWip: false,
      note: 'updated',
    }),
  );
});
