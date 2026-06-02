import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { Badge } from './Badge';

test('renders the mapped label for a known status', () => {
  renderWithProviders(<Badge status="completed" />);
  expect(screen.getByText('Completed')).toBeInTheDocument();
});

test('prefers an explicit label over the status map', () => {
  renderWithProviders(<Badge status="completed" label="Done!" />);
  expect(screen.getByText('Done!')).toBeInTheDocument();
});

test('falls back to the raw status when it is not in the map', () => {
  renderWithProviders(<Badge status="mystery" />);
  expect(screen.getByText('mystery')).toBeInTheDocument();
});

test('renders no leading dot for a static status by default', () => {
  const { container } = renderWithProviders(<Badge status="completed" />);
  expect(container.querySelectorAll('span')).toHaveLength(1);
});

test('renders a leading dot when dot is requested', () => {
  const { container } = renderWithProviders(<Badge status="completed" dot />);
  expect(container.querySelectorAll('span')).toHaveLength(2);
});

test('renders a live indicator dot for in-progress statuses', () => {
  const { container } = renderWithProviders(<Badge status="in_progress" />);
  expect(screen.getByText('In Progress')).toBeInTheDocument();
  // isLive statuses get the pulsing dot even without the `dot` prop.
  expect(container.querySelectorAll('span')).toHaveLength(2);
});
