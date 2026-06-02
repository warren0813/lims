import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// useMgrDashboardData fans out to two resources via Promise.all. It keeps the
// raw requests list but transforms the equipment list into a count, and the
// equipment call is individually guarded with a .catch(() => []).
const requestsList = vi.hoisted(() => vi.fn());
const equipmentList = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: { requests: { list: requestsList }, equipment: { list: equipmentList } },
}));

import useMgrDashboardData from './useMgrDashboardData';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty defaults', () => {
  requestsList.mockReturnValue(new Promise(() => {})); // never settles
  equipmentList.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useMgrDashboardData());
  expect(result.current.loading).toBe(true);
  expect(result.current.requests).toEqual([]);
  expect(result.current.equipmentCount).toBe(0);
});

test('exposes requests and derives equipmentCount once both resolve', async () => {
  requestsList.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  equipmentList.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]);
  const { result } = renderHook(() => useMgrDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.requests).toEqual([{ id: 1 }, { id: 2 }]);
  expect(result.current.equipmentCount).toBe(3);
  expect(result.current.error).toBeNull();
});

test('treats a failed equipment call as an empty list (count 0)', async () => {
  requestsList.mockResolvedValue([{ id: 1 }]);
  equipmentList.mockRejectedValue(new Error('equipment down'));
  const { result } = renderHook(() => useMgrDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.requests).toEqual([{ id: 1 }]);
  expect(result.current.equipmentCount).toBe(0);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the requests call rejects', async () => {
  requestsList.mockRejectedValue(new Error('requests down'));
  equipmentList.mockResolvedValue([]);
  const { result } = renderHook(() => useMgrDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('requests down');
});

test('refresh re-fetches and replaces the data', async () => {
  requestsList.mockResolvedValue([{ id: 1 }]);
  equipmentList.mockResolvedValue([{ id: 10 }]);
  const { result } = renderHook(() => useMgrDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.equipmentCount).toBe(1);

  requestsList.mockResolvedValue([{ id: 5 }, { id: 6 }]);
  equipmentList.mockResolvedValue([{ id: 20 }, { id: 21 }]);
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() => expect(result.current.requests).toEqual([{ id: 5 }, { id: 6 }]));
  expect(result.current.equipmentCount).toBe(2);
});
