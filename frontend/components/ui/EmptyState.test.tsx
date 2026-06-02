import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { EmptyState } from './EmptyState';

test('renders the title, message, and action', () => {
  renderWithProviders(
    <EmptyState title="Nothing here" message="Try again later" action={<button>Retry</button>} />,
  );
  expect(screen.getByText('Nothing here')).toBeInTheDocument();
  expect(screen.getByText('Try again later')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

test('renders with only a title (optional slots omitted)', () => {
  renderWithProviders(<EmptyState title="Empty" />);
  expect(screen.getByText('Empty')).toBeInTheDocument();
});

test('sizes the optional icon', () => {
  const Icon = ({ size }: { size?: number }) => <svg data-testid="icon" data-size={size} />;
  renderWithProviders(<EmptyState title="x" icon={<Icon />} />);
  expect(screen.getByTestId('icon')).toHaveAttribute('data-size', '28');
});
