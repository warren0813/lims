import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays } from './addDays.ts';

// addDays preserves the UTC time-of-day (00:00) of an ISO date string, so the
// result is timezone-stable for date-only inputs.

test('adds days within a month', () => {
  assert.equal(addDays('2026-01-01', 5), '2026-01-06');
});

test('rolls over month boundaries', () => {
  assert.equal(addDays('2026-01-30', 5), '2026-02-04');
});

test('handles negative offsets', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('handles leap days', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
});
