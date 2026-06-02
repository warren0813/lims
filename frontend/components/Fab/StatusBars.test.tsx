import { test, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import StatusBars from './StatusBars';

// StatusBars is props-only: it counts requests per known status bucket and
// renders a labelled bar + count for each. The bar widths are derived from the
// max bucket count; we assert the labels render and the counts are correct.

const req = (status: string) => ({ status });

test('renders every status bucket label', () => {
  renderWithProviders(<StatusBars requests={[]} />);
  for (const label of ['In Progress', 'Returned', 'Rejected', 'Draft', 'Cancelled']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});

test('shows zero for every bucket when there are no requests', () => {
  renderWithProviders(<StatusBars requests={[]} />);
  // Five buckets, each rendering a "0" count.
  expect(screen.getAllByText('0')).toHaveLength(5);
});

test('counts requests into the matching buckets', () => {
  renderWithProviders(
    <StatusBars
      requests={[
        req('in_progress'),
        req('in_progress'),
        req('in_progress'),
        req('returned'),
        req('draft'),
      ]}
    />,
  );
  expect(screen.getByText('3')).toBeInTheDocument(); // in_progress
  // returned (1) and draft (1) both show 1; rejected + cancelled show 0.
  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(screen.getAllByText('0')).toHaveLength(2);
});

test('ignores unknown statuses', () => {
  renderWithProviders(<StatusBars requests={[req('mystery'), req('in_progress')]} />);
  // Only the in_progress bucket is non-zero; the unknown status is dropped.
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getAllByText('0')).toHaveLength(4);
});
