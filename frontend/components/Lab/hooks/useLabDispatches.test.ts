import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// This hook fans out over three resource methods via Promise.all and joins
// the experiment-type and equipment lookups onto each dispatch row, so we mock
// all three with hoisted spies and assert the *enriched* shape. Mirrors the
// useRequests loading/data/error/refresh lifecycle otherwise.
const dispatchesList = vi.hoisted(() => vi.fn());
const experimentTypesList = vi.hoisted(() => vi.fn());
const equipmentList = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    dispatches: { list: dispatchesList },
    experimentTypes: { list: experimentTypesList },
    equipment: { list: equipmentList },
  },
}));

import useLabDispatches from './useLabDispatches';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty dispatches', () => {
  dispatchesList.mockReturnValue(new Promise(() => {})); // never settles
  experimentTypesList.mockResolvedValue([]);
  equipmentList.mockResolvedValue([]);
  const { result } = renderHook(() => useLabDispatches());
  expect(result.current.loading).toBe(true);
  expect(result.current.dispatches).toEqual([]);
});

test('enriches each dispatch with experiment and equipment names', async () => {
  dispatchesList.mockResolvedValue([
    { id: 10, experimentId: 1, equipmentId: 5 },
    { id: 11, experimentId: 99, equipmentId: 6 },
  ]);
  experimentTypesList.mockResolvedValue([{ id: 1, name: 'XRD' }]);
  equipmentList.mockResolvedValue([
    { id: 5, name: 'Furnace-A' },
    { id: 6, name: 'Furnace-B' },
  ]);
  const { result } = renderHook(() => useLabDispatches());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dispatches).toEqual([
    { id: 10, experimentId: 1, equipmentId: 5, experimentName: 'XRD', equipmentName: 'Furnace-A' },
    // experimentId 99 has no match -> null
    { id: 11, experimentId: 99, equipmentId: 6, experimentName: null, equipmentName: 'Furnace-B' },
  ]);
  expect(result.current.error).toBeNull();
});

test('still resolves dispatches when the lookup lists reject', async () => {
  dispatchesList.mockResolvedValue([{ id: 10, experimentId: 1, equipmentId: 5 }]);
  experimentTypesList.mockRejectedValue(new Error('exp down'));
  equipmentList.mockRejectedValue(new Error('eq down'));
  const { result } = renderHook(() => useLabDispatches());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dispatches).toEqual([
    { id: 10, experimentId: 1, equipmentId: 5, experimentName: null, equipmentName: null },
  ]);
  expect(result.current.error).toBeNull();
});

test('captures the error message when the dispatch list rejects', async () => {
  dispatchesList.mockRejectedValue(new Error('network down'));
  experimentTypesList.mockResolvedValue([]);
  equipmentList.mockResolvedValue([]);
  const { result } = renderHook(() => useLabDispatches());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.dispatches).toEqual([]);
});

test('refresh re-fetches and replaces the dispatches', async () => {
  dispatchesList.mockResolvedValue([{ id: 10, experimentId: 1, equipmentId: 5 }]);
  experimentTypesList.mockResolvedValue([{ id: 1, name: 'XRD' }]);
  equipmentList.mockResolvedValue([{ id: 5, name: 'Furnace-A' }]);
  const { result } = renderHook(() => useLabDispatches());
  await waitFor(() => expect(result.current.loading).toBe(false));

  dispatchesList.mockResolvedValue([{ id: 20, experimentId: 1, equipmentId: 5 }]);
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() =>
    expect(result.current.dispatches).toEqual([
      { id: 20, experimentId: 1, equipmentId: 5, experimentName: 'XRD', equipmentName: 'Furnace-A' },
    ]),
  );
});
