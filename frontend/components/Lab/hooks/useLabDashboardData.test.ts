import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@/test/render';

// useLabDashboardData fans out five api.*.list() calls via Promise.all (two of
// them guarded with .catch(() => [])), then transforms the results: samples are
// filtered to drop `raw_status: 'created'`, and dispatches are joined against
// experimentTypes/equipment by id to populate `experimentName`/`equipmentName`.
// Hoist one spy per method and drive the loading/data/error lifecycle.
const samplesList = vi.hoisted(() => vi.fn());
const wipsList = vi.hoisted(() => vi.fn());
const dispatchesList = vi.hoisted(() => vi.fn());
const equipmentList = vi.hoisted(() => vi.fn());
const experimentTypesList = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    samples: { list: samplesList },
    wips: { list: wipsList },
    dispatches: { list: dispatchesList },
    equipment: { list: equipmentList },
    experimentTypes: { list: experimentTypesList },
  },
}));

import useLabDashboardData from './useLabDashboardData';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty data', () => {
  samplesList.mockReturnValue(new Promise(() => {})); // never settles
  wipsList.mockReturnValue(new Promise(() => {}));
  dispatchesList.mockReturnValue(new Promise(() => {}));
  equipmentList.mockReturnValue(new Promise(() => {}));
  experimentTypesList.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useLabDashboardData());
  expect(result.current.loading).toBe(true);
  expect(result.current.samples).toEqual([]);
  expect(result.current.wips).toEqual([]);
  expect(result.current.dispatches).toEqual([]);
  expect(result.current.equipment).toEqual([]);
});

test('filters out created samples and joins dispatch names by id', async () => {
  samplesList.mockResolvedValue([
    { id: 1, raw_status: 'ready' },
    { id: 2, raw_status: 'created' }, // should be filtered out
  ]);
  wipsList.mockResolvedValue([{ id: 10 }]);
  dispatchesList.mockResolvedValue([
    { id: 100, experimentId: 5, equipmentId: 7 },
    { id: 101, experimentId: 999, equipmentId: 999 }, // no match -> null names
  ]);
  equipmentList.mockResolvedValue([{ id: 7, name: 'Furnace A' }]);
  experimentTypesList.mockResolvedValue([{ id: 5, name: 'Anneal' }]);

  const { result } = renderHook(() => useLabDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));

  // created sample removed
  expect(result.current.samples).toEqual([{ id: 1, raw_status: 'ready' }]);
  expect(result.current.wips).toEqual([{ id: 10 }]);
  expect(result.current.equipment).toEqual([{ id: 7, name: 'Furnace A' }]);
  // dispatches joined by id, unmatched ids resolve to null
  expect(result.current.dispatches).toEqual([
    { id: 100, experimentId: 5, equipmentId: 7, experimentName: 'Anneal', equipmentName: 'Furnace A' },
    { id: 101, experimentId: 999, equipmentId: 999, experimentName: null, equipmentName: null },
  ]);
  expect(result.current.error).toBeNull();
});

test('falls back to empty arrays when equipment and experimentTypes reject', async () => {
  samplesList.mockResolvedValue([{ id: 1, raw_status: 'ready' }]);
  wipsList.mockResolvedValue([]);
  dispatchesList.mockResolvedValue([{ id: 100, experimentId: 5, equipmentId: 7 }]);
  equipmentList.mockRejectedValue(new Error('equipment down'));
  experimentTypesList.mockRejectedValue(new Error('types down'));

  const { result } = renderHook(() => useLabDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));

  // graceful fallback: no error surfaced, names null because lookups empty
  expect(result.current.error).toBeNull();
  expect(result.current.equipment).toEqual([]);
  expect(result.current.dispatches).toEqual([
    { id: 100, experimentId: 5, equipmentId: 7, experimentName: null, equipmentName: null },
  ]);
});

test('captures the error message when a non-guarded request rejects', async () => {
  samplesList.mockRejectedValue(new Error('network down'));
  wipsList.mockResolvedValue([]);
  dispatchesList.mockResolvedValue([]);
  equipmentList.mockResolvedValue([]);
  experimentTypesList.mockResolvedValue([]);

  const { result } = renderHook(() => useLabDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.samples).toEqual([]);
});

test('refresh re-fetches and replaces the data', async () => {
  samplesList.mockResolvedValue([{ id: 1, raw_status: 'ready' }]);
  wipsList.mockResolvedValue([]);
  dispatchesList.mockResolvedValue([]);
  equipmentList.mockResolvedValue([]);
  experimentTypesList.mockResolvedValue([]);
  const { result } = renderHook(() => useLabDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));

  samplesList.mockResolvedValue([{ id: 9, raw_status: 'ready' }]);
  await act(async () => {
    result.current.refresh();
  });
  await waitFor(() =>
    expect(result.current.samples).toEqual([{ id: 9, raw_status: 'ready' }]),
  );
});
