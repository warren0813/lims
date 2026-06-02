import { test, expect } from 'vitest';
import { smoothPath } from './smoothPath';

// smoothPath builds an SVG path (Catmull-Rom style) through the given points.

test('returns an empty string for no points', () => {
  expect(smoothPath([])).toBe('');
});

test('returns a single move command for one point', () => {
  expect(smoothPath([[0, 0]])).toBe('M 0,0');
});

test('emits one cubic segment between two points', () => {
  expect(smoothPath([[0, 0], [10, 10]])).toBe('M 0,0 C 1.7,1.7 8.3,8.3 10,10');
});

test('emits one cubic segment per gap and ends at the last point', () => {
  const d = smoothPath([[0, 0], [10, 10], [20, 0]]);
  expect(d.startsWith('M 0,0')).toBe(true);
  expect((d.match(/C/g) || []).length).toBe(2); // 3 points -> 2 segments
  expect(d.endsWith('20,0')).toBe(true);
});

const yCoordinates = (path: string) =>
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

  expect(yCoordinates(path).every((y) => y >= 24 && y <= 184)).toBe(true);
});
