import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import { TweakToggle } from './TweakToggle';

test('renders the label and reflects the off state', () => {
  renderWithProviders(<TweakToggle label="Rail" value={false} onChange={() => {}} />);
  expect(screen.getByText('Rail')).toBeInTheDocument();
  const toggle = screen.getByRole('switch');
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(toggle).toHaveAttribute('data-on', '0');
});

test('reflects the on state', () => {
  renderWithProviders(<TweakToggle label="Rail" value={true} onChange={() => {}} />);
  const toggle = screen.getByRole('switch');
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(toggle).toHaveAttribute('data-on', '1');
});

test('clicking emits the inverted value', () => {
  const onChange = vi.fn();
  renderWithProviders(<TweakToggle label="Rail" value={false} onChange={onChange} />);
  fireEvent.click(screen.getByRole('switch'));
  expect(onChange).toHaveBeenCalledWith(true);
});

test('clicking an on toggle emits false', () => {
  const onChange = vi.fn();
  renderWithProviders(<TweakToggle label="Rail" value={true} onChange={onChange} />);
  fireEvent.click(screen.getByRole('switch'));
  expect(onChange).toHaveBeenCalledWith(false);
});
