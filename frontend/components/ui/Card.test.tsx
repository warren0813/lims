import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { Card } from './Card';

test('renders its children', () => {
  renderWithProviders(
    <Card>
      <p>Inside the card</p>
    </Card>,
  );
  expect(screen.getByText('Inside the card')).toBeInTheDocument();
});

test('forwards arbitrary props onto the root element', () => {
  renderWithProviders(
    <Card data-testid="card" role="region" aria-label="Panel">
      x
    </Card>,
  );
  const card = screen.getByTestId('card');
  expect(card).toHaveAttribute('role', 'region');
  expect(card).toHaveAttribute('aria-label', 'Panel');
});
