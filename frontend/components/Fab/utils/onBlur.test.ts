import { test, expect } from 'vitest';
import type { FocusEvent } from 'react';
import { onBlur } from './onBlur';

const focusEvent = (style: Record<string, string>) =>
  ({ target: { style } }) as unknown as FocusEvent<HTMLInputElement>;

test('resets the input border, background, and shadow to the resting style', () => {
  const style: Record<string, string> = {};
  onBlur(focusEvent(style));
  expect(style.borderColor).toBe('rgba(0,0,0,0.12)');
  expect(style.background).toBe('#f8f8fb');
  expect(style.boxShadow).toBe('none');
});
