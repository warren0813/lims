import { test, expect } from 'vitest';
import { dayDiff } from './dayDiff';

test('counts whole days from a to b', () => {
  expect(dayDiff('2026-01-01', '2026-01-08')).toBe(7);
});

test('is negative when b precedes a', () => {
  expect(dayDiff('2026-01-08', '2026-01-01')).toBe(-7);
});

test('is zero for the same date', () => {
  expect(dayDiff('2026-01-01', '2026-01-01')).toBe(0);
});

test('rounds to the nearest day across DST-free spans', () => {
  expect(dayDiff('2026-01-01', '2026-02-01')).toBe(31);
});
