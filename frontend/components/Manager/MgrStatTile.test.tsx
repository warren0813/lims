import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import MgrStatTile from './MgrStatTile';

// MgrStatTile is props-only: a labelled stat with an accented icon. When given
// an onClick it is a clickable button; otherwise it renders disabled. The icon
// is cloned with an injected color + size, so it must accept those props.
const Icon = ({ color, size }: { color?: string; size?: number }) => (
  <svg data-testid="icon" data-color={color} data-size={size} />
);

test('renders the label and value', () => {
  renderWithProviders(
    <MgrStatTile label="Open Requests" value={7} icon={<Icon />} tint="#eee" accent="#6c67b8" />,
  );
  expect(screen.getByText('Open Requests')).toBeInTheDocument();
  expect(screen.getByText('7')).toBeInTheDocument();
});

test('injects the accent color into the icon', () => {
  renderWithProviders(
    <MgrStatTile label="X" value={1} icon={<Icon />} tint="#eee" accent="#ff0000" />,
  );
  expect(screen.getByTestId('icon')).toHaveAttribute('data-color', '#ff0000');
});

test('is clickable and fires onClick when handler is provided', () => {
  const onClick = vi.fn();
  renderWithProviders(
    <MgrStatTile
      label="X"
      value={1}
      icon={<Icon />}
      tint="#eee"
      accent="#6c67b8"
      onClick={onClick}
    />,
  );
  const button = screen.getByRole('button');
  expect(button).not.toBeDisabled();
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('is disabled when no onClick is provided', () => {
  renderWithProviders(
    <MgrStatTile label="X" value={1} icon={<Icon />} tint="#eee" accent="#6c67b8" />,
  );
  expect(screen.getByRole('button')).toBeDisabled();
});
