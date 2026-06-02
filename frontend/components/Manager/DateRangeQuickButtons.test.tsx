import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import {
  DateRangeQuickButtons,
  defaultDateRange,
  presetRange,
} from './DateRangeQuickButtons';

// Pin "today" so the relative windows are deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

test('renders every quick-range preset button', () => {
  renderWithProviders(<DateRangeQuickButtons onChange={() => {}} />);
  for (const label of ['Today', 'Last 7 days', 'Last 30 days', 'This month']) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  }
});

test('clicking a preset emits its computed range', () => {
  const onChange = vi.fn();
  renderWithProviders(<DateRangeQuickButtons onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(onChange).toHaveBeenCalledWith({ start: '2026-06-15', end: '2026-06-15' });
});

test('presetRange computes each window relative to today', () => {
  expect(presetRange('today')).toEqual({ start: '2026-06-15', end: '2026-06-15' });
  expect(presetRange('last7')).toEqual({ start: '2026-06-09', end: '2026-06-15' });
  expect(presetRange('last30')).toEqual({ start: '2026-05-17', end: '2026-06-15' });
  expect(presetRange('month')).toEqual({ start: '2026-06-01', end: '2026-06-15' });
});

test('defaultDateRange is the last-30-days window', () => {
  expect(defaultDateRange()).toEqual({ start: '2026-05-17', end: '2026-06-15' });
});
