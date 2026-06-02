import assert from 'node:assert/strict';
import test from 'node:test';
import { phaseIndexFor } from './phaseIndexFor.ts';

// phaseIndexFor maps a (sample, request) pair onto the 0..4 wafer timeline:
// -1 not-yet-started, 0 approved, 1 shipped, 2 received, 3 processing, 4 done.

test('returns -1 while the request is still in the draft/approval stage', () => {
  const sample = { status: 'incoming', raw_status: 'created' };
  assert.equal(phaseIndexFor(sample, { status: 'draft' }), -1);
  assert.equal(phaseIndexFor(sample, { status: 'submitted' }), -1);
  assert.equal(phaseIndexFor(sample, { rawStatus: 'pending_approval', status: 'submitted' }), -1);
});

test('returns 4 (done) when the request or the sample is completed', () => {
  assert.equal(
    phaseIndexFor({ status: 'received' }, { status: 'completed', rawStatus: 'closed' }),
    4,
  );
  assert.equal(
    phaseIndexFor({ status: 'completed' }, { status: 'in_progress', rawStatus: 'in_progress' }),
    4,
  );
});

test('returns 3 (processing) for in-WIP / processing / split samples', () => {
  const req = { status: 'in_progress', rawStatus: 'in_progress' };
  assert.equal(phaseIndexFor({ status: 'in_wip' }, req), 3);
  assert.equal(phaseIndexFor({ status: 'x', raw_status: 'processing' }, req), 3);
  assert.equal(phaseIndexFor({ status: 'x', raw_status: 'split' }, req), 3);
});

test('returns 2 (received) then 1 (shipped) then 0 (approved) as it walks back', () => {
  const req = { status: 'in_progress', rawStatus: 'in_progress' };
  assert.equal(phaseIndexFor({ status: 'received' }, req), 2);
  assert.equal(phaseIndexFor({ status: 'incoming', raw_status: 'shipped' }, req), 1);
  assert.equal(phaseIndexFor({ status: 'incoming', raw_status: 'created' }, req), 0);
});
