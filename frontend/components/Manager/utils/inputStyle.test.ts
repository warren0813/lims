import { test, expect } from 'vitest';
import { inputStyle } from './inputStyle';
import { line, ink } from '@/lib/colors';

test('exposes the shared Manager input styling tokens', () => {
  expect(inputStyle.width).toBe('100%');
  expect(inputStyle.outline).toBe('none');
  expect(inputStyle.background).toBe('#fff');
  // Border + text colors come from the shared design tokens.
  expect(inputStyle.border).toBe(`1px solid ${line}`);
  expect(inputStyle.color).toBe(ink);
});
