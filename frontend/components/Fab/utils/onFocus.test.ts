import { test, expect } from 'vitest';
import type { FocusEvent } from 'react';
import { onFocus } from './onFocus';

const focusEvent = (style: Record<string, string>) =>
  ({ target: { style } }) as unknown as FocusEvent<HTMLInputElement>;

test('applies the focused border, background, and accent shadow', () => {
  const style: Record<string, string> = {};
  onFocus(focusEvent(style));
  expect(style.borderColor).toBe('#6c67b8');
  expect(style.background).toBe('#fff');
  expect(style.boxShadow).toBe('0 0 0 3px rgba(108,103,184,0.12)');
});
