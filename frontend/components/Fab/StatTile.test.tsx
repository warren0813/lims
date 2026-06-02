import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import StatTile from './StatTile';

// StatTile is props-only: it renders a value badge next to a label inside a
// FabCard (a plain styled div). No interaction — just assert the content.

test('renders the value and label', () => {
  renderWithProviders(<StatTile label="Total wafers" value={24} />);
  expect(screen.getByText('24')).toBeInTheDocument();
  expect(screen.getByText('Total wafers')).toBeInTheDocument();
});

test('renders a ReactNode value', () => {
  renderWithProviders(
    <StatTile label="Status" value={<span data-testid="badge">OK</span>} accent="#6c67b8" />,
  );
  expect(screen.getByTestId('badge')).toBeInTheDocument();
});

test('renders with optional accent and valueBg styling applied', () => {
  renderWithProviders(<StatTile label="Pending" value={3} accent="#6c67b8" valueBg="#f1eef9" />);
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
});
