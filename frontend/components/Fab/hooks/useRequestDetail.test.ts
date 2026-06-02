import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// Data hooks read the default `@/lib/api` export and call one resource method.
// Mock just that method with a hoisted spy and drive the loading/data/error
// lifecycle. `renderHook` + `waitFor` come from the shared render helper.
const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { get } } }));

import useRequestDetail from './useRequestDetail';

beforeEach(() => {
  vi.clearAllMocks();
});

test('skips fetching and clears loading when id is null', async () => {
  const { result } = renderHook(() => useRequestDetail(null));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(get).not.toHaveBeenCalled();
  expect(result.current.data).toBeNull();
});

test('starts in a loading state when given an id', () => {
  get.mockReturnValue(new Promise(() => {})); // never settles
  const { result } = renderHook(() => useRequestDetail(7));
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBeNull();
});

test('exposes the fetched detail once the request resolves', async () => {
  get.mockResolvedValue({ id: 7, name: 'Req 7' });
  const { result } = renderHook(() => useRequestDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(get).toHaveBeenCalledWith(7);
  expect(result.current.data).toEqual({ id: 7, name: 'Req 7' });
  expect(result.current.error).toBeNull();
});

test('captures the error message when the request rejects', async () => {
  get.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useRequestDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('boom');
  expect(result.current.data).toBeNull();
});

test('refresh re-fetches and replaces the data', async () => {
  get.mockResolvedValue({ id: 7, name: 'old' });
  const { result } = renderHook(() => useRequestDetail(7));
  await waitFor(() => expect(result.current.loading).toBe(false));

  get.mockResolvedValue({ id: 7, name: 'new' });
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() => expect(result.current.data).toEqual({ id: 7, name: 'new' }));
});
