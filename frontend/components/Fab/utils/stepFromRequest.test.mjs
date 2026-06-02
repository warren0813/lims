import assert from 'node:assert/strict';
import test from 'node:test';
import { stepFromRequest } from './stepFromRequest.ts';

// stepFromRequest collapses a request row into the Fab tracker step:
// { aborted, status } for terminal-bad states, otherwise { idx } in -1..3.

test('flags aborted/terminal states without an index', () => {
  for (const status of ['draft', 'cancelled', 'rejected', 'returned']) {
    assert.deepEqual(stepFromRequest({ status }), { aborted: true, status });
  }
});

test('returns idx -1 before approval', () => {
  assert.deepEqual(stepFromRequest({ status: 'submitted', rawStatus: 'submitted' }), { idx: -1 });
  assert.deepEqual(stepFromRequest({ status: 'x', rawStatus: 'pending_approval' }), { idx: -1 });
});

test('returns idx 3 when completed/closed', () => {
  assert.deepEqual(stepFromRequest({ status: 'completed' }), { idx: 3 });
  assert.deepEqual(stepFromRequest({ status: 'x', rawStatus: 'closed' }), { idx: 3 });
});

test('derives idx from sample states when samples are present', () => {
  const base = { status: 'in_progress', rawStatus: 'in_progress' };
  // all samples done -> 3
  assert.deepEqual(
    stepFromRequest({ ...base, samples: [{ status: 'completed' }, { status: 'completed' }] }),
    { idx: 3 },
  );
  // any processing -> 2
  assert.deepEqual(
    stepFromRequest({ ...base, samples: [{ status: 'processing' }, { status: 'incoming' }] }),
    { idx: 2 },
  );
  // any shipped/received -> 1
  assert.deepEqual(
    stepFromRequest({ ...base, samples: [{ status: 'incoming', raw_status: 'shipped' }] }),
    { idx: 1 },
  );
  // nothing matched -> 0
  assert.deepEqual(
    stepFromRequest({ ...base, samples: [{ status: 'incoming', raw_status: 'created' }] }),
    { idx: 0 },
  );
});

test('falls back to raw status when there are no samples', () => {
  assert.deepEqual(stepFromRequest({ status: 'x', rawStatus: 'approved', samples: [] }), { idx: 0 });
  assert.deepEqual(stepFromRequest({ status: 'x', rawStatus: 'sample_shipped', samples: [] }), {
    idx: 1,
  });
  assert.deepEqual(stepFromRequest({ status: 'x', rawStatus: 'in_progress', samples: [] }), {
    idx: 2,
  });
  assert.deepEqual(stepFromRequest({ status: 'x', rawStatus: 'exception', samples: [] }), {
    idx: 2,
  });
});
