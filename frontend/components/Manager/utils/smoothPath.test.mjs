import assert from 'node:assert/strict';
import test from 'node:test';
import { smoothPath } from './smoothPath.ts';

// smoothPath builds an SVG path (Catmull-Rom style) through the given points.

test('returns an empty string for no points', () => {
  assert.equal(smoothPath([]), '');
});

test('returns a single move command for one point', () => {
  assert.equal(smoothPath([[0, 0]]), 'M 0,0');
});

test('emits one cubic segment between two points', () => {
  assert.equal(smoothPath([[0, 0], [10, 10]]), 'M 0,0 C 1.7,1.7 8.3,8.3 10,10');
});

test('emits one cubic segment per gap and ends at the last point', () => {
  const d = smoothPath([[0, 0], [10, 10], [20, 0]]);
  assert.ok(d.startsWith('M 0,0'));
  assert.equal((d.match(/C/g) || []).length, 2); // 3 points -> 2 segments
  assert.ok(d.endsWith('20,0'));
});
