import { test, expect } from 'vitest';
import { stepFromRequest } from './stepFromRequest';

// stepFromRequest collapses a request row into the Fab tracker step:
// { aborted, status } for terminal-bad states, otherwise { idx } in -1..3.

test('flags aborted/terminal states without an index', () => {
  for (const status of ['draft', 'cancelled', 'rejected', 'returned']) {
    expect(stepFromRequest({ status })).toEqual({ aborted: true, status });
  }
});

test('returns idx -1 before approval', () => {
  expect(stepFromRequest({ status: 'submitted', rawStatus: 'submitted' })).toEqual({ idx: -1 });
  expect(stepFromRequest({ status: 'x', rawStatus: 'pending_approval' })).toEqual({ idx: -1 });
});

test('returns idx 3 when completed/closed', () => {
  expect(stepFromRequest({ status: 'completed' })).toEqual({ idx: 3 });
  expect(stepFromRequest({ status: 'x', rawStatus: 'closed' })).toEqual({ idx: 3 });
});

test('derives idx from sample states when samples are present', () => {
  const base = { status: 'in_progress', rawStatus: 'in_progress' };
  // all samples done -> 3
  expect(
    stepFromRequest({ ...base, samples: [{ status: 'completed' }, { status: 'completed' }] }),
  ).toEqual({ idx: 3 });
  // any processing -> 2
  expect(
    stepFromRequest({ ...base, samples: [{ status: 'processing' }, { status: 'incoming' }] }),
  ).toEqual({ idx: 2 });
  // any shipped/received -> 1
  expect(
    stepFromRequest({ ...base, samples: [{ status: 'incoming', raw_status: 'shipped' }] }),
  ).toEqual({ idx: 1 });
  // nothing matched -> 0
  expect(
    stepFromRequest({ ...base, samples: [{ status: 'incoming', raw_status: 'created' }] }),
  ).toEqual({ idx: 0 });
});

test('falls back to raw status when there are no samples', () => {
  expect(stepFromRequest({ status: 'x', rawStatus: 'approved', samples: [] })).toEqual({ idx: 0 });
  expect(stepFromRequest({ status: 'x', rawStatus: 'sample_shipped', samples: [] })).toEqual({
    idx: 1,
  });
  expect(stepFromRequest({ status: 'x', rawStatus: 'in_progress', samples: [] })).toEqual({
    idx: 2,
  });
  expect(stepFromRequest({ status: 'x', rawStatus: 'exception', samples: [] })).toEqual({
    idx: 2,
  });
});
