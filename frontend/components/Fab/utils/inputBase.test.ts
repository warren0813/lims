import { test, expect } from 'vitest';
import { inputBase } from './inputBase';

test('exposes the shared Fab input styling tokens', () => {
  expect(inputBase.width).toBe('100%');
  expect(inputBase.outline).toBe('none');
  expect(inputBase.fontFamily).toBe('inherit');
  expect(typeof inputBase.borderRadius).toBe('number');
});
