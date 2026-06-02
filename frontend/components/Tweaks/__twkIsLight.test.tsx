import { test, expect } from 'vitest';
import __twkIsLight from './__twkIsLight';

test('treats near-white as light', () => {
  expect(__twkIsLight('#ffffff')).toBe(true);
});

test('treats black as dark', () => {
  expect(__twkIsLight('#000000')).toBe(false);
});

test('expands 3-digit shorthand hex', () => {
  // #fff -> #ffffff (light); #000 -> #000000 (dark)
  expect(__twkIsLight('#fff')).toBe(true);
  expect(__twkIsLight('#000')).toBe(false);
});

test('tolerates a missing leading hash', () => {
  expect(__twkIsLight('ffffff')).toBe(true);
});

test('falls back to light for an unparseable value', () => {
  expect(__twkIsLight('not-a-color')).toBe(true);
});

test('weights green heavily in the luminance threshold', () => {
  // Pure green (00ff00) -> 255*587 = 149685 > 148000 -> light.
  expect(__twkIsLight('#00ff00')).toBe(true);
  // Pure blue (0000ff) -> 255*114 = 29070 < 148000 -> dark.
  expect(__twkIsLight('#0000ff')).toBe(false);
});
