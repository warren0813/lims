import { test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@/test/render';

// Populates WIP-creation dropdowns: fans out over experimentTypes/samples/
// equipment lists, then fetches each eligible sample's parent request to derive
// readiness, experiment ids, and block reasons. The pickerSamples output is a
// non-trivial join (eligible samples + extra request samples), so we mock all
// four methods and assert the transformed shape. No refresh is returned.
const experimentTypesList = vi.hoisted(() => vi.fn());
const samplesList = vi.hoisted(() => vi.fn());
const equipmentList = vi.hoisted(() => vi.fn());
const requestsGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    experimentTypes: { list: experimentTypesList },
    samples: { list: samplesList },
    equipment: { list: equipmentList },
    requests: { get: requestsGet },
  },
}));

import useWipCreationData from './useWipCreationData';

beforeEach(() => {
  vi.clearAllMocks();
});

test('starts in a loading state with empty collections', () => {
  experimentTypesList.mockReturnValue(new Promise(() => {})); // never settles
  samplesList.mockResolvedValue([]);
  equipmentList.mockResolvedValue([]);
  const { result } = renderHook(() => useWipCreationData());
  expect(result.current.loading).toBe(true);
  expect(result.current.experimentTypes).toEqual([]);
  expect(result.current.pickerSamples).toEqual([]);
  expect(result.current.equipment).toEqual([]);
});

test('passes through experiment types and equipment, and builds picker samples', async () => {
  experimentTypesList.mockResolvedValue([{ id: 1, name: 'XRD' }]);
  equipmentList.mockResolvedValue([{ id: 5, name: 'Furnace-A' }]);
  // Two samples on request 200: one eligible (received, no wip), one not.
  samplesList.mockResolvedValue([
    { id: 51, wafer: 'W1', size: '2in', requestId: 200, raw_status: 'received', status: 'ok', hasWip: false },
  ]);
  requestsGet.mockResolvedValue({
    id: 200,
    rawStatus: 'in_progress',
    expIds: [1],
    samples: [
      { id: 51, wafer: 'W1', size: '2in', raw_status: 'received', status: 'ok', expIds: [9] },
      // sample 52 is not in the eligible set -> appended with blockReason 'not_received'
      { id: 52, wafer: 'W2', size: '4in', raw_status: 'pending', status: 'ok', expIds: [] },
    ],
  });

  const { result } = renderHook(() => useWipCreationData());
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(requestsGet).toHaveBeenCalledWith(200);
  expect(result.current.experimentTypes).toEqual([{ id: 1, name: 'XRD' }]);
  expect(result.current.equipment).toEqual([{ id: 5, name: 'Furnace-A' }]);
  expect(result.current.pickerSamples).toEqual([
    // eligible sample: request is in_progress -> blockReason null; expIds from sample
    {
      id: 51,
      wafer: 'W1',
      size: '2in',
      requestId: 200,
      raw_status: 'received',
      status: 'ok',
      hasWip: false,
      expIds: [9],
      blockReason: null,
    },
    // non-eligible request sample appended with not_received
    {
      id: 52,
      wafer: 'W2',
      size: '4in',
      requestId: 200,
      raw_status: 'pending',
      status: 'ok',
      hasWip: false,
      // sample 52 has empty expIds -> falls back to the request's expIds ([1])
      expIds: [1],
      blockReason: 'not_received',
    },
  ]);
  expect(result.current.error).toBeNull();
});

test('marks eligible samples blocked when their request is not in progress', async () => {
  experimentTypesList.mockResolvedValue([]);
  equipmentList.mockResolvedValue([]);
  samplesList.mockResolvedValue([
    { id: 51, wafer: 'W1', size: '2in', requestId: 200, raw_status: 'received', status: 'ok', hasWip: false },
  ]);
  requestsGet.mockResolvedValue({
    id: 200,
    rawStatus: 'draft', // not in_progress -> blocked
    expIds: [2],
    samples: [{ id: 51, wafer: 'W1', size: '2in', raw_status: 'received', status: 'ok', expIds: [] }],
  });

  const { result } = renderHook(() => useWipCreationData());
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.pickerSamples).toEqual([
    {
      id: 51,
      wafer: 'W1',
      size: '2in',
      requestId: 200,
      raw_status: 'received',
      status: 'ok',
      hasWip: false,
      expIds: [2], // falls back to request expIds when the sample has none
      blockReason: 'request_not_ready',
    },
  ]);
});

test('captures the error message when a list rejects', async () => {
  experimentTypesList.mockRejectedValue(new Error('network down'));
  samplesList.mockResolvedValue([]);
  equipmentList.mockResolvedValue([]);
  const { result } = renderHook(() => useWipCreationData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.pickerSamples).toEqual([]);
});
