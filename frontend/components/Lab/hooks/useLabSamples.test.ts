import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// useLabSamples calls api.samples.list() and api.requests.list() (the latter
// guarded with .catch(() => [])) via Promise.all. It filters out samples with
// `raw_status: 'created'`, then derives `wafers` by joining each sample to its
// request's `urgency` (defaulting to '1w' when no matching request exists).
const samplesList = vi.hoisted(() => vi.fn());
const requestsList = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    samples: { list: samplesList },
    requests: { list: requestsList },
  },
}));

import useLabSamples from './useLabSamples';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with no wafers', () => {
  samplesList.mockReturnValue(new Promise(() => {})); // never settles
  requestsList.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useLabSamples());
  expect(result.current.loading).toBe(true);
  expect(result.current.wafers).toEqual([]);
});

test('filters created samples and joins urgency from requests', async () => {
  samplesList.mockResolvedValue([
    { id: 1, requestId: 50, raw_status: 'ready' },
    { id: 2, requestId: 51, raw_status: 'created' }, // filtered out
    { id: 3, requestId: 999, raw_status: 'ready' }, // no matching request -> default urgency
  ]);
  requestsList.mockResolvedValue([{ id: 50, urgency: '3d' }]);

  const { result } = renderHook(() => useLabSamples());
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.wafers).toEqual([
    { id: 1, requestId: 50, raw_status: 'ready', urgency: '3d' },
    { id: 3, requestId: 999, raw_status: 'ready', urgency: '1w' },
  ]);
  expect(result.current.error).toBeNull();
});

test('falls back to default urgency when requests reject', async () => {
  samplesList.mockResolvedValue([{ id: 1, requestId: 50, raw_status: 'ready' }]);
  requestsList.mockRejectedValue(new Error('requests down'));

  const { result } = renderHook(() => useLabSamples());
  await waitFor(() => expect(result.current.loading).toBe(false));

  // requests guarded -> no error, urgency defaults
  expect(result.current.error).toBeNull();
  expect(result.current.wafers).toEqual([
    { id: 1, requestId: 50, raw_status: 'ready', urgency: '1w' },
  ]);
});

test('captures the error message when samples reject', async () => {
  samplesList.mockRejectedValue(new Error('network down'));
  requestsList.mockResolvedValue([]);

  const { result } = renderHook(() => useLabSamples());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.wafers).toEqual([]);
});

test('refresh re-fetches and replaces the wafers', async () => {
  samplesList.mockResolvedValue([{ id: 1, requestId: 50, raw_status: 'ready' }]);
  requestsList.mockResolvedValue([]);
  const { result } = renderHook(() => useLabSamples());
  await waitFor(() => expect(result.current.loading).toBe(false));

  samplesList.mockResolvedValue([{ id: 9, requestId: 60, raw_status: 'ready' }]);
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() =>
    expect(result.current.wafers).toEqual([
      { id: 9, requestId: 60, raw_status: 'ready', urgency: '1w' },
    ]),
  );
});
