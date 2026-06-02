import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { TweakSection } from './TweakSection';

test('renders the section label', () => {
  const { container } = renderWithProviders(<TweakSection label="Colors" />);
  const heading = container.querySelector('.twk-sect');
  expect(heading).not.toBeNull();
  expect(heading).toHaveTextContent('Colors');
});

test('renders children after the label', () => {
  renderWithProviders(
    <TweakSection label="Colors">
      <button type="button">Inner</button>
    </TweakSection>,
  );
  expect(screen.getByRole('button', { name: 'Inner' })).toBeInTheDocument();
});
