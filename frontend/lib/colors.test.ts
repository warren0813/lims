import { test, expect } from 'vitest';
import * as colors from './colors';

test('exposes the shared design tokens used across Lab, Manager, and Fab', () => {
  expect(colors.accent).toBe('#6c67b8');
  expect(colors.ink).toBe('#1e1e24');
  expect(colors.surface).toBe('#fff');
  // Every token is a defined, non-empty string.
  for (const value of Object.values(colors)) {
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  }
});
