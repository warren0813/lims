import assert from 'node:assert/strict';
import test from 'node:test';
import smoothPath from './smoothPath.ts';

const yCoordinates = (path) =>
  [...path.matchAll(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g)].map((match) =>
    Number(match[0].split(',')[1]),
  );

test('clamps smoothed control points inside the requested y bounds', () => {
  const path = smoothPath(
    [
      [0, 24],
      [10, 184],
      [20, 184],
      [30, 24],
    ],
    { yMin: 24, yMax: 184 },
  );

  assert.ok(yCoordinates(path).every((y) => y >= 24 && y <= 184));
});
