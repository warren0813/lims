import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { SamplePill } from './SamplePill';

test('renders the sample status label', () => {
  renderWithProviders(<SamplePill status="received" />);
  expect(screen.getByText('Received')).toBeInTheDocument();
});
