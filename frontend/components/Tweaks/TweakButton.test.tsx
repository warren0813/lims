import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakButton } from './TweakButton';

test('renders the label and forwards clicks', () => {
  const onClick = vi.fn();
  renderWithProviders(<TweakButton label="Reset" onClick={onClick} />);
  const button = screen.getByRole('button', { name: 'Reset' });
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('uses the primary class by default', () => {
  renderWithProviders(<TweakButton label="Go" onClick={() => {}} />);
  expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('twk-btn');
});

test('adds the secondary modifier when secondary is set', () => {
  renderWithProviders(<TweakButton label="Cancel" onClick={() => {}} secondary />);
  const button = screen.getByRole('button', { name: 'Cancel' });
  expect(button).toHaveClass('twk-btn');
  expect(button).toHaveClass('secondary');
});
