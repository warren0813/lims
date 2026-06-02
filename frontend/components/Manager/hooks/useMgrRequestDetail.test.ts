import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// Mock the single resource method the hook reads off the default api export.
const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { get } } }));

import useMgrRequestDetail from './useMgrRequestDetail';

beforeEach(() => {
  vi.clearAllMocks();
});

test('skips the fetch and clears loading when id is null', async () => {
  const { result } = renderHook(() => useMgrRequestDetail(undefined));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(get).not.toHaveBeenCalled();
  expect(result.current.data).toBeNull();
  expect(result.current.error).toBeNull();
});

test('starts loading then resolves the detail for a real id', async () => {
  get.mockReturnValueOnce(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useMgrRequestDetail(7));
  expect(result.current.loading).toBe(true);
  expect(get).toHaveBeenCalledWith(7);
});

test('exposes the fetched detail once the request resolves', async () => {
  get.mockResolvedValue({ id: 7, title: 'Sample' });
  const { result } = renderHook(() => useMgrRequestDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toEqual({ id: 7, title: 'Sample' });
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  get.mockRejectedValue(new Error('not found'));
  const { result } = renderHook(() => useMgrRequestDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('not found');
  expect(result.current.data).toBeNull();
});

test('refresh re-fetches and replaces the detail', async () => {
  get.mockResolvedValue({ id: 7, title: 'Old' });
  const { result } = renderHook(() => useMgrRequestDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  get.mockResolvedValue({ id: 7, title: 'New' });
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() => expect(result.current.data).toEqual({ id: 7, title: 'New' }));
});
