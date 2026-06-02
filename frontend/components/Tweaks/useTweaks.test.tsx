import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@/test/render';
import useTweaks from './useTweaks';

const DEFAULTS = { signInBg: '#1e1e24', signInFg: '#ffffff' };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('initial state equals the supplied defaults', () => {
  const { result } = renderHook(() => useTweaks(DEFAULTS));
  expect(result.current[0]).toEqual(DEFAULTS);
});

test('setTweak(key, value) updates one key immutably', () => {
  const { result } = renderHook(() => useTweaks(DEFAULTS));
  const before = result.current[0];
  act(() => result.current[1]('signInBg', '#000000'));
  const after = result.current[0];
  expect(after).toEqual({ signInBg: '#000000', signInFg: '#ffffff' });
  // A new object is produced; the previous reference is left untouched.
  expect(after).not.toBe(before);
  expect(before).toEqual(DEFAULTS);
});

test('setTweak accepts a partial-edits object', () => {
  const { result } = renderHook(() => useTweaks(DEFAULTS));
  act(() => result.current[1]({ signInBg: '#111111', signInFg: '#222222' }));
  expect(result.current[0]).toEqual({ signInBg: '#111111', signInFg: '#222222' });
});

test('setTweak posts the edits to the parent window', () => {
  const postMessage = vi.spyOn(window.parent, 'postMessage');
  const { result } = renderHook(() => useTweaks(DEFAULTS));
  act(() => result.current[1]('signInBg', '#abcdef'));
  expect(postMessage).toHaveBeenCalledWith(
    { type: '__edit_mode_set_keys', edits: { signInBg: '#abcdef' } },
    '*',
  );
});

test('setTweak dispatches a tweakchange event carrying the edits', () => {
  const handler = vi.fn();
  window.addEventListener('tweakchange', handler);
  const { result } = renderHook(() => useTweaks(DEFAULTS));
  act(() => result.current[1]('signInFg', '#fefefe'));
  expect(handler).toHaveBeenCalledTimes(1);
  const event = handler.mock.calls[0][0] as CustomEvent;
  expect(event.detail).toEqual({ signInFg: '#fefefe' });
  window.removeEventListener('tweakchange', handler);
});

test('setTweak keeps a stable identity across renders', () => {
  const { result, rerender } = renderHook(() => useTweaks(DEFAULTS));
  const first = result.current[1];
  rerender();
  expect(result.current[1]).toBe(first);
});
