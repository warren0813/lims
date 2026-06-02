import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

// TrendChart reads the useMgrTrend data hook and renders loading / error /
// empty / chart states off it. Mock the hook to a controlled value (mutated
// per test); the SVG, Card, and path math all render for real under jsdom.
const hook = vi.hoisted(() => ({
  value: { data: null as Record<string, unknown> | null, loading: false, error: null as string | null },
}));
vi.mock('@/components/Manager/hooks/useMgrTrend', () => ({
  default: () => hook.value,
  useMgrTrend: () => hook.value,
}));

import TrendChart from './TrendChart';

const point = (over: Record<string, unknown> = {}) => ({
  date: '2026-05-01',
  count: 4,
  utilization_pct: 60,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: null, loading: false, error: null };
});

test('shows the loading placeholder while the first fetch is in flight', () => {
  hook.value = { data: null, loading: true, error: null };
  const { container } = renderWithProviders(<TrendChart />);
  expect(screen.getByText('Loading trend…')).toBeInTheDocument();
  expect(container.querySelector('svg')).toBeNull();
});

test('surfaces the hook error in a banner', () => {
  hook.value = { data: null, loading: false, error: 'network down' };
  renderWithProviders(<TrendChart />);
  expect(screen.getByText(/Couldn't load trend: network down/)).toBeInTheDocument();
});

test('renders the empty-data fallback when there are no points', () => {
  hook.value = { data: { metric: 'x', days: 30, points: [] }, loading: false, error: null };
  renderWithProviders(<TrendChart />);
  expect(screen.getByText('No trend data yet.')).toBeInTheDocument();
});

test('renders the chart svg with both series paths once data arrives', () => {
  hook.value = {
    data: {
      metric: 'equipment_utilization_per_day',
      days: 30,
      points: [
        point({ date: '2026-05-01', count: 4, utilization_pct: 60 }),
        point({ date: '2026-05-02', count: 6, utilization_pct: 80 }),
        point({ date: '2026-05-03', count: 2, utilization_pct: 40 }),
      ],
    },
    loading: false,
    error: null,
  };
  const { container } = renderWithProviders(<TrendChart />);

  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  // Two area fills + two series lines + gridline-less stroke paths => >= 4 paths.
  const paths = container.querySelectorAll('path');
  expect(paths.length).toBeGreaterThanOrEqual(4);
  // The two series stroke colours appear in the rendered SVG.
  expect(container.querySelector('path[stroke="#2563eb"]')).not.toBeNull();
  expect(container.querySelector('path[stroke="#6c67b8"]')).not.toBeNull();
});

test('shows the day-count badge from the trend payload', () => {
  hook.value = {
    data: { metric: 'equipment_utilization_per_day', days: 14, points: [point()] },
    loading: false,
    error: null,
  };
  renderWithProviders(<TrendChart />);
  expect(screen.getByText('Last 14 days')).toBeInTheDocument();
});

test('renders date tick labels derived from the point dates', () => {
  hook.value = {
    data: {
      metric: 'equipment_utilization_per_day',
      days: 30,
      points: [point({ date: '2026-05-01' }), point({ date: '2026-05-02' })],
    },
    loading: false,
    error: null,
  };
  renderWithProviders(<TrendChart />);
  // First and last ticks always show; "05-01" -> "05/01".
  expect(screen.getByText('05/01')).toBeInTheDocument();
  expect(screen.getByText('05/02')).toBeInTheDocument();
});

test('clamps out-of-range metrics instead of breaking the render', () => {
  // Negative count and >100 utilization are clamped (count->0, util->100); the
  // chart still renders rather than producing NaN paths.
  hook.value = {
    data: {
      metric: 'equipment_utilization_per_day',
      days: 30,
      points: [
        point({ count: -5, utilization_pct: 250 }),
        point({ date: '2026-05-02', count: null, utilization_pct: null }),
      ],
    },
    loading: false,
    error: null,
  };
  const { container } = renderWithProviders(<TrendChart />);
  const dispatchLine = container.querySelector('path[stroke="#2563eb"]');
  expect(dispatchLine).not.toBeNull();
  expect(dispatchLine?.getAttribute('d')).not.toContain('NaN');
});
