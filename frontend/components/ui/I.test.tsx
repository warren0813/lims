import { test, expect } from 'vitest';
import { renderWithProviders } from '@/test/render';
import I from './I';
import * as IconExports from './I';

// I is a map of small icon components, each delegating to <Icon> (an <svg>).
// Iterate the whole set so every entry is exercised — cheap, broad line
// coverage — then spot-check the size/color props the underlying <svg> reads.

const iconEntries = Object.entries(I) as [string, (p: { size?: number; color?: string }) => React.ReactElement][];

test('exports a non-empty map of icon components', () => {
  expect(iconEntries.length).toBeGreaterThan(0);
});

test.each(iconEntries)('I.%s renders an <svg>', (_name, IconComponent) => {
  const { container } = renderWithProviders(<IconComponent />);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
});

test('every icon also has a matching named export that renders an <svg>', () => {
  for (const [name] of iconEntries) {
    const Named = (IconExports as Record<string, unknown>)[name] as (p: {
      size?: number;
    }) => React.ReactElement;
    expect(typeof Named).toBe('function');
    const { container } = renderWithProviders(<Named />);
    expect(container.querySelector('svg')).not.toBeNull();
  }
});

test('forwards the size prop to the svg width/height', () => {
  const { container } = renderWithProviders(<I.Home size={40} />);
  const svg = container.querySelector('svg');
  expect(svg).toHaveAttribute('width', '40');
  expect(svg).toHaveAttribute('height', '40');
});

test('forwards the color prop to the svg stroke', () => {
  const { container } = renderWithProviders(<I.Flask color="#ff0000" />);
  expect(container.querySelector('svg')).toHaveAttribute('stroke', '#ff0000');
});

test('falls back to default size and currentColor stroke when unspecified', () => {
  const { container } = renderWithProviders(<I.Search />);
  const svg = container.querySelector('svg');
  expect(svg).toHaveAttribute('width', '16');
  expect(svg).toHaveAttribute('stroke', 'currentColor');
});
