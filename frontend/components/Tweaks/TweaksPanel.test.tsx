import { test, expect } from 'vitest';
import { renderWithProviders, screen, fireEvent, act } from '@/test/render';
import { TweaksPanel } from './TweaksPanel';

// The panel is hidden until the host posts `__activate_edit_mode`. This helper
// renders it and flips it open so the body and children are in the DOM.
// RTL auto-cleanup unmounts each render between tests.
function open(ui: React.ReactElement) {
  const utils = renderWithProviders(ui);
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: '__activate_edit_mode' } }));
  });
  return utils;
}

test('renders nothing until edit mode is activated', () => {
  const { container } = renderWithProviders(<TweaksPanel />);
  expect(container.querySelector('.twk-panel')).toBeNull();
});

test('shows the panel with the default title once activated', () => {
  open(<TweaksPanel />);
  expect(screen.getByText('Tweaks')).toBeInTheDocument();
  expect(document.querySelector('.twk-panel')).not.toBeNull();
});

test('renders a custom title', () => {
  open(<TweaksPanel title="Controls" />);
  expect(screen.getByText('Controls')).toBeInTheDocument();
});

test('renders supplied children inside the body', () => {
  open(
    <TweaksPanel>
      <button type="button">Child Control</button>
    </TweaksPanel>,
  );
  expect(screen.getByRole('button', { name: 'Child Control' })).toBeInTheDocument();
});

test('injects the tweaks stylesheet', () => {
  open(<TweaksPanel />);
  const style = document.querySelector('style');
  expect(style?.textContent).toContain('.twk-panel');
});

test('the close button dismisses the panel', () => {
  open(<TweaksPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Close tweaks' }));
  expect(document.querySelector('.twk-panel')).toBeNull();
});

test('deactivate message also closes the panel', () => {
  open(<TweaksPanel />);
  expect(document.querySelector('.twk-panel')).not.toBeNull();
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: '__deactivate_edit_mode' } }),
    );
  });
  expect(document.querySelector('.twk-panel')).toBeNull();
});
