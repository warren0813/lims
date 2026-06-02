import { test, expect } from 'vitest';
import { addDays } from './addDays';

// addDays preserves the UTC time-of-day (00:00) of an ISO date string, so the
// result is timezone-stable for date-only inputs.

test('adds days within a month', () => {
  expect(addDays('2026-01-01', 5)).toBe('2026-01-06');
});

test('rolls over month boundaries', () => {
  expect(addDays('2026-01-30', 5)).toBe('2026-02-04');
});

test('handles negative offsets', () => {
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

test('handles leap days', () => {
  expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
});
