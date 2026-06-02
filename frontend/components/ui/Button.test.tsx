import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';
import { Button } from './Button';

test('renders children and forwards click events', async () => {
  const onClick = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<Button onClick={onClick}>Save</Button>);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('does not fire click handlers while disabled', async () => {
  const onClick = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(
    <Button onClick={onClick} disabled>
      Save
    </Button>,
  );
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(onClick).not.toHaveBeenCalled();
});

test('swaps to the hover background on mouse enter and back on leave', () => {
  renderWithProviders(<Button>Hover</Button>);
  const button = screen.getByRole('button', { name: 'Hover' });
  const resting = button.style.background;

  fireEvent.mouseEnter(button);
  expect(button.style.background).not.toBe(resting);

  fireEvent.mouseLeave(button);
  expect(button.style.background).toBe(resting);
});

test('keeps the resting background on hover when disabled', () => {
  renderWithProviders(<Button disabled>Hover</Button>);
  const button = screen.getByRole('button', { name: 'Hover' });
  const resting = button.style.background;
  fireEvent.mouseEnter(button);
  expect(button.style.background).toBe(resting);
});

test('injects the size-appropriate icon size into the icon element', () => {
  const Icon = ({ size }: { size?: number }) => <svg data-testid="icon" data-size={size} />;
  renderWithProviders(
    <Button icon={<Icon />} size="lg">
      X
    </Button>,
  );
  expect(screen.getByTestId('icon')).toHaveAttribute('data-size', '15');
});
