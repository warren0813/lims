import { test, expect } from 'vitest';
import getTrendTickIndexes from './trendTicks';

test('keeps the final 30-day labels far enough apart to remain readable', () => {
  const indexes = getTrendTickIndexes(30);
  expect(indexes).toEqual([0, 4, 8, 12, 16, 20, 24, 29]);
  expect(indexes.at(-1)! - indexes.at(-2)! >= 4).toBe(true);
});

test('includes both ends for a short range', () => {
  expect(getTrendTickIndexes(2)).toEqual([0, 1]);
});
