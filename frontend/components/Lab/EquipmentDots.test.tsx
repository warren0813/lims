import { test, expect } from 'vitest';
import { renderWithProviders } from '@/test/render';
import EquipmentDots from './EquipmentDots';

// EquipmentDots renders one dot per capacity slot, the first `used` of them
// filled. It is pure presentation (no text), so we assert on the rendered span
// count and their fill colour. jsdom normalises the hex background to rgb().
const FILLED = 'rgb(108, 103, 184)';

test('renders one dot per capacity slot', () => {
  const { container } = renderWithProviders(<EquipmentDots used={2} capacity={5} />);
  expect(container.querySelectorAll('span')).toHaveLength(5);
});

test('fills exactly the used number of dots', () => {
  const { container } = renderWithProviders(<EquipmentDots used={3} capacity={5} />);
  const filled = Array.from(container.querySelectorAll('span')).filter(
    (s) => (s as HTMLElement).style.background === FILLED,
  );
  expect(filled).toHaveLength(3);
});

test('renders no dots when capacity is zero', () => {
  const { container } = renderWithProviders(<EquipmentDots used={0} capacity={0} />);
  expect(container.querySelectorAll('span')).toHaveLength(0);
});

test('fills every dot when fully used', () => {
  const { container } = renderWithProviders(<EquipmentDots used={4} capacity={4} />);
  const filled = Array.from(container.querySelectorAll('span')).filter(
    (s) => (s as HTMLElement).style.background === FILLED,
  );
  expect(filled).toHaveLength(4);
});
