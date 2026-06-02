import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/render';

// Mock the single resource method the hook reads off the default api export.
// useMgrTrend is parameterised (metric, days) and re-fetches when either dep
// changes, so we also cover the rerender path.
const trends = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { reports: { trends } } }));

import useMgrTrend from './useMgrTrend';

const sample = { metric: 'requests_per_day', days: 30, points: [{ date: '2026-01-01', count: 3 }] };

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with null data', () => {
  trends.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useMgrTrend());
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBeNull();
});

test('passes the default metric and days to the api', async () => {
  trends.mockResolvedValue(sample);
  const { result } = renderHook(() => useMgrTrend());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(trends).toHaveBeenCalledWith({ metric: 'requests_per_day', days: 30 });
});

test('exposes the trend payload once the request resolves', async () => {
  trends.mockResolvedValue(sample);
  const { result } = renderHook(() => useMgrTrend('utilization', 7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(trends).toHaveBeenCalledWith({ metric: 'utilization', days: 7 });
  expect(result.current.data).toEqual(sample);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  trends.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useMgrTrend());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('boom');
  expect(result.current.data).toBeNull();
});

test('re-fetches when the metric or days argument changes', async () => {
  const first = { ...sample, metric: 'a', days: 7 };
  const second = { ...sample, metric: 'b', days: 14 };
  trends.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

  const { result, rerender } = renderHook(({ m, d }) => useMgrTrend(m, d), {
    initialProps: { m: 'a', d: 7 },
  });
  await waitFor(() => expect(result.current.data).toEqual(first));
  expect(trends).toHaveBeenCalledWith({ metric: 'a', days: 7 });

  rerender({ m: 'b', d: 14 });
  await waitFor(() => expect(result.current.data).toEqual(second));
  expect(trends).toHaveBeenCalledWith({ metric: 'b', days: 14 });
  expect(trends).toHaveBeenCalledTimes(2);
});
