import { test, expect, vi, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import DashHero from './DashHero';

// DashHero is props-only: it takes a {running, needsRecord, incoming} count
// bundle plus a navigate callback. It renders a time-of-day greeting, a summary
// sentence that branches on the counts, and three stat buttons that each
// navigate to a different page. The starfield/decoration is purely cosmetic.

afterEach(() => {
  vi.useRealTimers();
});

const counts = (over: Partial<{ running: number; needsRecord: number; incoming: number }> = {}) => ({
  running: 0,
  needsRecord: 0,
  incoming: 0,
  ...over,
});

test('renders the three stat values and their labels', () => {
  renderWithProviders(
    <DashHero counts={counts({ running: 4, needsRecord: 2, incoming: 7 })} navigate={vi.fn()} />,
  );
  expect(screen.getByText('Running')).toBeInTheDocument();
  expect(screen.getByText('To record')).toBeInTheDocument();
  expect(screen.getByText('Incoming')).toBeInTheDocument();
  expect(screen.getByText('4')).toBeInTheDocument();
  expect(screen.getByText('7')).toBeInTheDocument();
});

test('summarises running experiments and pending results when work is active', () => {
  renderWithProviders(
    <DashHero counts={counts({ running: 1, needsRecord: 3 })} navigate={vi.fn()} />,
  );
  // running === 1 → singular "experiment", needsRecord > 0 → awaiting clause.
  expect(screen.getByText(/1 experiment running\./)).toBeInTheDocument();
  expect(screen.getByText(/3 awaiting your result\./)).toBeInTheDocument();
});

test('says no results pending when running but nothing to record', () => {
  renderWithProviders(
    <DashHero counts={counts({ running: 2, needsRecord: 0 })} navigate={vi.fn()} />,
  );
  expect(screen.getByText(/2 experiments running\./)).toBeInTheDocument();
  expect(screen.getByText(/No results pending\./)).toBeInTheDocument();
});

test('falls back to the incoming-wafers message when nothing is running', () => {
  renderWithProviders(<DashHero counts={counts({ incoming: 1 })} navigate={vi.fn()} />);
  expect(screen.getByText(/1 wafer just arrived from the fab\./)).toBeInTheDocument();
});

test('shows the quiet-shift message when every count is zero', () => {
  renderWithProviders(<DashHero counts={counts()} navigate={vi.fn()} />);
  expect(screen.getByText('Quiet shift. All chambers clear.')).toBeInTheDocument();
});

test('each stat button navigates to its corresponding page/tab', () => {
  const navigate = vi.fn();
  renderWithProviders(
    <DashHero counts={counts({ running: 1, needsRecord: 1, incoming: 1 })} navigate={navigate} />,
  );
  fireEvent.click(screen.getByText('Running').closest('button')!);
  fireEvent.click(screen.getByText('To record').closest('button')!);
  fireEvent.click(screen.getByText('Incoming').closest('button')!);
  expect(navigate).toHaveBeenNthCalledWith(1, { page: 'lab_dispatches', tab: 'active' });
  expect(navigate).toHaveBeenNthCalledWith(2, { page: 'lab_dispatches', tab: 'record' });
  expect(navigate).toHaveBeenNthCalledWith(3, { page: 'lab_samples', tab: 'incoming' });
});

test('greets with "Good morning" in the late-morning window', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-02T09:00:00'));
  renderWithProviders(<DashHero counts={counts()} navigate={vi.fn()} />);
  expect(screen.getByText(/Good morning/)).toBeInTheDocument();
});

test('greets with "Working late" in the small hours', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-02T03:00:00'));
  renderWithProviders(<DashHero counts={counts()} navigate={vi.fn()} />);
  expect(screen.getByText(/Working late/)).toBeInTheDocument();
});
