import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { UrgencyPill } from './UrgencyPill';

// UrgencyPill is a thin wrapper that feeds URGENCY_LABEL into <Pill>. Exercising
// the unmapped path keeps the assertion independent of the label table's
// contents while still covering the wrapper's render.
test('renders the urgency, falling back to the raw value when unmapped', () => {
  renderWithProviders(<UrgencyPill urgency="__urg__" />);
  expect(screen.getByText('__urg__')).toBeInTheDocument();
});
