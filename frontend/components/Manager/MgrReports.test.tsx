import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

// MgrReports is a layout-only composition: a Page titled "Reports" wrapping the
// two report cards side-by-side. Both cards are routing-aware + api-backed and
// have their own tests, so we stub them with sentinels and only assert this
// component's own composition (title, subtitle, and that both cards mount).
vi.mock('@/components/Manager/DispatchResultsReport', () => ({
  default: () => <div data-testid="dispatch-results-report" />,
}));
vi.mock('@/components/Manager/RequestStatisticsReport', () => ({
  default: () => <div data-testid="request-statistics-report" />,
}));

import MgrReports from './MgrReports';

test('renders the Reports page title and subtitle', () => {
  renderWithProviders(<MgrReports />);
  expect(screen.getByText('Reports')).toBeInTheDocument();
  expect(
    screen.getByText('Generate dispatch results and request statistics'),
  ).toBeInTheDocument();
});

test('renders both report cards', () => {
  renderWithProviders(<MgrReports />);
  expect(screen.getByTestId('dispatch-results-report')).toBeInTheDocument();
  expect(screen.getByTestId('request-statistics-report')).toBeInTheDocument();
});
