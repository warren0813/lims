import { test, expect } from 'vitest';
import { renderWithProviders } from '@/test/render';
import __TwkCheck from './__TwkCheck';

test('renders an svg check-mark path', () => {
  const { container } = renderWithProviders(<__TwkCheck light={false} />);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg?.querySelector('path')).not.toBeNull();
});

test('uses a white stroke on dark backgrounds', () => {
  const { container } = renderWithProviders(<__TwkCheck light={false} />);
  expect(container.querySelector('path')).toHaveAttribute('stroke', '#fff');
});

test('uses a dark stroke on light backgrounds', () => {
  const { container } = renderWithProviders(<__TwkCheck light={true} />);
  expect(container.querySelector('path')).toHaveAttribute('stroke', 'rgba(0,0,0,.78)');
});
