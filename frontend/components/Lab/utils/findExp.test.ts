import { test, expect } from 'vitest';
import { findExp } from './findExp';

test('finds a known experiment by id', () => {
  expect(findExp('tct')?.code).toBe('TCT');
  expect(findExp('ft')?.name).toBe('Final Test');
});

test('returns undefined for unknown or empty ids', () => {
  expect(findExp('nope')).toBeUndefined();
  expect(findExp(null)).toBeUndefined();
  expect(findExp(undefined)).toBeUndefined();
});
