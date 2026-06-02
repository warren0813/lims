import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { SectionLabel } from './SectionLabel';

test('renders the label text and the right-hand slot', () => {
  renderWithProviders(<SectionLabel right={<span>edit</span>}>Details</SectionLabel>);
  expect(screen.getByText('Details')).toBeInTheDocument();
  expect(screen.getByText('edit')).toBeInTheDocument();
});

test('renders without a right slot', () => {
  renderWithProviders(<SectionLabel>Only label</SectionLabel>);
  expect(screen.getByText('Only label')).toBeInTheDocument();
});
