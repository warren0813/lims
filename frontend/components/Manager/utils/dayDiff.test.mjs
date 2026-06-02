import assert from 'node:assert/strict';
import test from 'node:test';
import { dayDiff } from './dayDiff.ts';

test('counts whole days from a to b', () => {
  assert.equal(dayDiff('2026-01-01', '2026-01-08'), 7);
});

test('is negative when b precedes a', () => {
  assert.equal(dayDiff('2026-01-08', '2026-01-01'), -7);
});

test('is zero for the same date', () => {
  assert.equal(dayDiff('2026-01-01', '2026-01-01'), 0);
});

test('rounds to the nearest day across DST-free spans', () => {
  assert.equal(dayDiff('2026-01-01', '2026-02-01'), 31);
});
