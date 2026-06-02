import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { TweakRow } from './TweakRow';

test('renders the label and child content', () => {
  renderWithProviders(
    <TweakRow label="Field">
      <input aria-label="inner" />
    </TweakRow>,
  );
  expect(screen.getByText('Field')).toBeInTheDocument();
  expect(screen.getByLabelText('inner')).toBeInTheDocument();
});

test('shows the value badge when a value is supplied', () => {
  renderWithProviders(<TweakRow label="Field" value={12} />);
  expect(screen.getByText('12')).toBeInTheDocument();
});

test('omits the value badge when value is undefined', () => {
  const { container } = renderWithProviders(<TweakRow label="Field" />);
  expect(container.querySelector('.twk-val')).toBeNull();
});

test('uses the vertical layout by default and the horizontal layout when inline', () => {
  const { container, rerender } = renderWithProviders(<TweakRow label="Field" />);
  expect(container.querySelector('.twk-row')).not.toHaveClass('twk-row-h');
  rerender(<TweakRow label="Field" inline />);
  expect(container.querySelector('.twk-row')).toHaveClass('twk-row-h');
});
