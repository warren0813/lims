import { test, expect } from 'vitest';
import { phaseIndexFor } from './phaseIndexFor';

// phaseIndexFor maps a (sample, request) pair onto the 0..4 wafer timeline:
// -1 not-yet-started, 0 approved, 1 shipped, 2 received, 3 processing, 4 done.

test('returns -1 while the request is still in the draft/approval stage', () => {
  const sample = { status: 'incoming', raw_status: 'created' };
  expect(phaseIndexFor(sample, { status: 'draft' })).toBe(-1);
  expect(phaseIndexFor(sample, { status: 'submitted' })).toBe(-1);
  expect(phaseIndexFor(sample, { rawStatus: 'pending_approval', status: 'submitted' })).toBe(-1);
});

test('returns 4 (done) when the request or the sample is completed', () => {
  expect(
    phaseIndexFor({ status: 'received' }, { status: 'completed', rawStatus: 'closed' }),
  ).toBe(4);
  expect(
    phaseIndexFor({ status: 'completed' }, { status: 'in_progress', rawStatus: 'in_progress' }),
  ).toBe(4);
});

test('returns 3 (processing) for in-WIP / processing / split samples', () => {
  const req = { status: 'in_progress', rawStatus: 'in_progress' };
  expect(phaseIndexFor({ status: 'in_wip' }, req)).toBe(3);
  expect(phaseIndexFor({ status: 'x', raw_status: 'processing' }, req)).toBe(3);
  expect(phaseIndexFor({ status: 'x', raw_status: 'split' }, req)).toBe(3);
});

test('returns 2 (received) then 1 (shipped) then 0 (approved) as it walks back', () => {
  const req = { status: 'in_progress', rawStatus: 'in_progress' };
  expect(phaseIndexFor({ status: 'received' }, req)).toBe(2);
  expect(phaseIndexFor({ status: 'incoming', raw_status: 'shipped' }, req)).toBe(1);
  expect(phaseIndexFor({ status: 'incoming', raw_status: 'created' }, req)).toBe(0);
});
