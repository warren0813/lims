import { test, expect } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { FlowDots } from './FlowDots';

test('renders one dot per step (plus the wrapping span)', () => {
  const { container } = renderWithProviders(
    <FlowDots steps={['a', 'b', 'c']} current="b" />,
  );
  // 1 wrapper span + 3 step dots
  expect(container.querySelectorAll('span')).toHaveLength(4);
});

test('does not crash when current is not among the steps', () => {
  const { container } = renderWithProviders(
    <FlowDots steps={['a', 'b']} current="missing" />,
  );
  expect(container.querySelectorAll('span')).toHaveLength(3);
});
