import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { StatusPill } from './StatusPill';

test('renders the request status label', () => {
  renderWithProviders(<StatusPill status="submitted" />);
  expect(screen.getByText('Submitted')).toBeInTheDocument();
});

test('falls back to the raw status for an unknown value', () => {
  renderWithProviders(<StatusPill status="__unknown__" />);
  expect(screen.getByText('__unknown__')).toBeInTheDocument();
});
