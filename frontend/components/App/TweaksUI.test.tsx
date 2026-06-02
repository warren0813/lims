import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, act } from '@/test/render';
import TweaksUI from './TweaksUI';
import { TWEAK_DEFAULTS } from './constants';

// TweaksUI composes TweaksPanel (hidden until activated) with the leaf inputs.
// Flip the panel open via the host message before asserting on its contents.
// RTL auto-cleanup unmounts each render between tests.
function openTweaks(setTweak: (...args: never[]) => void) {
  const utils = renderWithProviders(
    <TweaksUI t={{ ...TWEAK_DEFAULTS }} setTweak={setTweak as never} />,
  );
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: '__activate_edit_mode' } }));
  });
  return utils;
}

test('renders the section headings and the reset button once open', () => {
  openTweaks(vi.fn());
  expect(screen.getByText('Sign in button')).toBeInTheDocument();
  expect(screen.getAllByText('fab_user icon').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Reset to theme defaults' })).toBeInTheDocument();
});

test('the reset button routes the defaults through setTweak', () => {
  const setTweak = vi.fn();
  openTweaks(setTweak);
  fireEvent.click(screen.getByRole('button', { name: 'Reset to theme defaults' }));
  expect(setTweak).toHaveBeenCalledWith({ ...TWEAK_DEFAULTS });
});

test('selecting a background color routes through setTweak', () => {
  const setTweak = vi.fn();
  openTweaks(setTweak);
  // The "Text" color row offers fixed options including white; click one chip.
  const chips = screen.getAllByRole('radio');
  fireEvent.click(chips[0]);
  expect(setTweak).toHaveBeenCalled();
  const [key] = setTweak.mock.calls[0];
  expect(['signInBg', 'signInFg']).toContain(key);
});
