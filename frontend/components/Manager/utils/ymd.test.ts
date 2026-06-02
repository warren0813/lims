import { test, expect } from 'vitest';
import { ymd } from './ymd';

// ymd is currently an identity passthrough for ISO date strings; pin that
// contract so a future change to formatting is a conscious, tested decision.
test('returns the date string unchanged', () => {
  expect(ymd('2026-01-01')).toBe('2026-01-01');
  expect(ymd('')).toBe('');
});
