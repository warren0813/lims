import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import FabStatTile from './FabStatTile';

// FabStatTile is props-only: a labelled stat tile with an accented icon badge,
// always rendered as a clickable button. The icon is cloned with an injected
// color, so it must accept a `color` prop.
const Icon = ({ color }: { color?: string }) => <svg data-testid="icon" data-color={color} />;

test('renders the label and value', () => {
  renderWithProviders(
    <FabStatTile label="In Progress" value={5} icon={<Icon />} tint="#eee" accent="#6c67b8" />,
  );
  expect(screen.getByText('In Progress')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});

test('injects the accent color into the icon', () => {
  renderWithProviders(
    <FabStatTile label="X" value={1} icon={<Icon />} tint="#eee" accent="#00ff00" />,
  );
  expect(screen.getByTestId('icon')).toHaveAttribute('data-color', '#00ff00');
});

test('fires onClick when clicked', () => {
  const onClick = vi.fn();
  renderWithProviders(
    <FabStatTile
      label="X"
      value={1}
      icon={<Icon />}
      tint="#eee"
      accent="#6c67b8"
      onClick={onClick}
    />,
  );
  fireEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('renders a ReactNode value', () => {
  renderWithProviders(
    <FabStatTile
      label="X"
      value={<span data-testid="custom">custom</span>}
      icon={<Icon />}
      tint="#eee"
      accent="#6c67b8"
    />,
  );
  expect(screen.getByTestId('custom')).toBeInTheDocument();
});
