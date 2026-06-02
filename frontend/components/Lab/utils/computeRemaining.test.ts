import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeRemaining } from './computeRemaining';

const DAY = 86400000;
// Parsed with the same local-timezone rules computeRemaining uses internally,
// so "now === arrival" holds regardless of the host timezone.
const ARRIVED = '2026-06-01 00:00';
const arrivalNow = new Date('2026-06-01T00:00:00');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(arrivalNow);
});

afterEach(() => {
  vi.useRealTimers();
});

test('returns null when there is no arrival timestamp', () => {
  expect(computeRemaining({ status: 'processing', urgency: '1w' })).toBe(null);
  expect(computeRemaining({ arrivedAt: null, status: 'processing', urgency: '1w' })).toBe(null);
});

test('returns null for incoming or rejected wafers', () => {
  expect(computeRemaining({ arrivedAt: ARRIVED, status: 'incoming', urgency: '1w' })).toBe(null);
  expect(computeRemaining({ arrivedAt: ARRIVED, status: 'rejected', urgency: '1w' })).toBe(null);
});

test('counts down from the urgency window measured at arrival', () => {
  expect(computeRemaining({ arrivedAt: ARRIVED, status: 'processing', urgency: '3d' })).toBe(3 * DAY);
  expect(computeRemaining({ arrivedAt: ARRIVED, status: 'processing', urgency: '1w' })).toBe(7 * DAY);
  expect(computeRemaining({ arrivedAt: ARRIVED, status: 'processing', urgency: '2w' })).toBe(14 * DAY);
});

test('falls back to a 7-day window for unknown urgency', () => {
  expect(computeRemaining({ arrivedAt: ARRIVED, status: 'processing', urgency: 'whenever' })).toBe(
    7 * DAY,
  );
});

test('shrinks as time passes after arrival', () => {
  vi.setSystemTime(new Date(arrivalNow.getTime() + 2 * DAY));
  expect(computeRemaining({ arrivedAt: ARRIVED, status: 'processing', urgency: '1w' })).toBe(5 * DAY);
});
