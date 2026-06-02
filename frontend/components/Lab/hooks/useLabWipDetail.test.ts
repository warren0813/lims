import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// useLabWipDetail(id) guards a null id (no fetch, loading flips to false), and
// otherwise calls api.wips.get(id), exposing { wip, loading, error, refresh }.
const wipsGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { wips: { get: wipsGet } } }));

import useLabWipDetail from './useLabWipDetail';

beforeEach(() => {
  vi.clearAllMocks();
});

test('skips fetching when id is null', async () => {
  const { result } = renderHook(() => useLabWipDetail(null));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(wipsGet).not.toHaveBeenCalled();
  expect(result.current.wip).toBeNull();
  expect(result.current.error).toBeNull();
});

test('starts in a loading state for a real id', () => {
  wipsGet.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useLabWipDetail(7));
  expect(result.current.loading).toBe(true);
  expect(result.current.wip).toBeNull();
});

test('exposes the fetched wip once the request resolves', async () => {
  wipsGet.mockResolvedValue({ id: 7, status: 'in_progress' });
  const { result } = renderHook(() => useLabWipDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(wipsGet).toHaveBeenCalledWith(7);
  expect(result.current.wip).toEqual({ id: 7, status: 'in_progress' });
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  wipsGet.mockRejectedValue(new Error('not found'));
  const { result } = renderHook(() => useLabWipDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('not found');
  expect(result.current.wip).toBeNull();
});

test('refresh re-fetches and replaces the wip', async () => {
  wipsGet.mockResolvedValue({ id: 7, status: 'in_progress' });
  const { result } = renderHook(() => useLabWipDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  wipsGet.mockResolvedValue({ id: 7, status: 'done' });
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() =>
    expect(result.current.wip).toEqual({ id: 7, status: 'done' }),
  );
});
