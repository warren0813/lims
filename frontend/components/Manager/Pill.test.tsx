import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { Pill } from './Pill';

const mapping = { hot: { label: 'Hot', bg: '#fee', fg: '#a00' } };

test('renders the label from the provided mapping', () => {
  renderWithProviders(<Pill kind="hot" mapping={mapping} />);
  expect(screen.getByText('Hot')).toBeInTheDocument();
});

test('falls back to the raw kind when it is not in the mapping', () => {
  renderWithProviders(<Pill kind="unmapped" mapping={mapping} />);
  expect(screen.getByText('unmapped')).toBeInTheDocument();
});

test('renders a leading dot only when dotted', () => {
  const plain = renderWithProviders(<Pill kind="hot" mapping={mapping} />);
  expect(plain.container.querySelectorAll('span')).toHaveLength(1);

  const dotted = renderWithProviders(<Pill kind="hot" mapping={mapping} dotted />);
  // wrapper span + dot span
  expect(dotted.container.querySelectorAll('span')).toHaveLength(2);
});

test('uses the default STATUS_LABEL mapping when none is supplied', () => {
  renderWithProviders(<Pill kind="draft" />);
  expect(screen.getByText('Draft')).toBeInTheDocument();
});
