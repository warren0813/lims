import assert from 'node:assert/strict';
import test from 'node:test';
import getTrendTickIndexes from './trendTicks.ts';

test('keeps the final 30-day labels far enough apart to remain readable', () => {
  const indexes = getTrendTickIndexes(30);
  assert.deepEqual(indexes, [0, 4, 8, 12, 16, 20, 24, 29]);
  assert.ok(indexes.at(-1) - indexes.at(-2) >= 4);
});

test('includes both ends for a short range', () => {
  assert.deepEqual(getTrendTickIndexes(2), [0, 1]);
});
