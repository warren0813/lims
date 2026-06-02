import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import BannerHeader from './BannerHeader';

// BannerHeader is props-only: it renders an accented icon badge, a title, an
// optional count pill, an optional right-hand slot, and a decorative twinkle.
// The icon is cloned with an injected color, so it must accept a `color` prop.
const Icon = ({ color }: { color?: string }) => <svg data-testid="icon" data-color={color} />;

test('renders the title and the cloned icon', () => {
  renderWithProviders(<BannerHeader icon={<Icon />} title="In Progress" accent="#6c67b8" />);
  expect(screen.getByText('In Progress')).toBeInTheDocument();
  expect(screen.getByTestId('icon')).toBeInTheDocument();
});

test('injects the accentLight color into the icon when provided', () => {
  renderWithProviders(
    <BannerHeader icon={<Icon />} title="X" accent="#6c67b8" accentLight="#bbb7e8" />,
  );
  expect(screen.getByTestId('icon')).toHaveAttribute('data-color', '#bbb7e8');
});

test('renders the count pill when a count is supplied', () => {
  renderWithProviders(<BannerHeader icon={<Icon />} title="X" accent="#6c67b8" count={12} />);
  expect(screen.getByText('12')).toBeInTheDocument();
});

test('renders a zero count (count != null) rather than hiding it', () => {
  renderWithProviders(<BannerHeader icon={<Icon />} title="X" accent="#6c67b8" count={0} />);
  expect(screen.getByText('0')).toBeInTheDocument();
});

test('omits the count pill when no count is supplied', () => {
  renderWithProviders(<BannerHeader icon={<Icon />} title="Only title" accent="#6c67b8" />);
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});

test('renders the right-hand slot content', () => {
  renderWithProviders(
    <BannerHeader
      icon={<Icon />}
      title="X"
      accent="#6c67b8"
      right={<button>Action</button>}
    />,
  );
  expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
});

test('still renders the title when the twinkle decoration is disabled', () => {
  renderWithProviders(
    <BannerHeader icon={<Icon />} title="No twinkle" accent="#6c67b8" twinkle={false} />,
  );
  expect(screen.getByText('No twinkle')).toBeInTheDocument();
});
