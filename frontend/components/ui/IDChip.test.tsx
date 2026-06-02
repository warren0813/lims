import { test, expect } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { IDChip } from './IDChip';

test('renders the default # prefix joined to the id', () => {
  const { container } = renderWithProviders(<IDChip id={42} />);
  expect(container.textContent).toBe('#42');
});

test('renders a custom prefix with a string id', () => {
  const { container } = renderWithProviders(<IDChip id="A1" prefix="REQ-" />);
  expect(container.textContent).toBe('REQ-A1');
});
