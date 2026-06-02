import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import RunningDispatchRow from './RunningDispatchRow';

// RunningDispatchRow is props-only. It looks up the experiment by id (findExp →
// EXPERIMENTS, real), shows the dispatch id / equipment / wafer count header,
// renders a Pill for the status, and exposes a progress bar only while running.
// Clicking the row navigates to the dispatch detail. We feed real experiment
// ids so the resolved name renders.

type DispatchRow = {
  id: number;
  experimentId: string | number;
  status: string;
  startedAt?: string | null;
  equipmentId?: number;
};
type WipRow = { equipmentId?: number; waferIds?: number[] };

const dispatch = (over: Partial<DispatchRow> = {}): DispatchRow => ({
  id: 42,
  experimentId: 'tct',
  status: 'running',
  startedAt: '2026-06-01 08:00',
  equipmentId: 5,
  ...over,
});

const wip: WipRow = { equipmentId: 9, waferIds: [1, 2, 3] };

test('renders the dispatch id, equipment and resolved experiment name', () => {
  renderWithProviders(<RunningDispatchRow d={dispatch()} wip={wip} navigate={vi.fn()} />);
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument(); // explicit equipmentId wins over wip
  expect(screen.getByText('Temperature Cycling Test')).toBeInTheDocument();
});

test('shows the wafer count from the wip row (pluralised)', () => {
  renderWithProviders(<RunningDispatchRow d={dispatch()} wip={wip} navigate={vi.fn()} />);
  expect(screen.getByText(/3 wafers/)).toBeInTheDocument();
});

test('uses the singular wafer label for a single wafer', () => {
  renderWithProviders(
    <RunningDispatchRow d={dispatch()} wip={{ equipmentId: 9, waferIds: [1] }} navigate={vi.fn()} />,
  );
  expect(screen.getByText(/1 wafer$/)).toBeInTheDocument();
});

test('falls back to the wip equipment id when the dispatch has none', () => {
  renderWithProviders(
    <RunningDispatchRow d={dispatch({ equipmentId: undefined })} wip={wip} navigate={vi.fn()} />,
  );
  expect(screen.getByText('9')).toBeInTheDocument();
});

test('clicking the row navigates to the dispatch detail', () => {
  const navigate = vi.fn();
  renderWithProviders(<RunningDispatchRow d={dispatch({ id: 7 })} wip={wip} navigate={navigate} />);
  fireEvent.click(screen.getByRole('button'));
  expect(navigate).toHaveBeenCalledWith({ page: 'lab_dispatch_detail', id: 7 });
});

test('renders the status pill for non-running dispatches without crashing', () => {
  renderWithProviders(
    <RunningDispatchRow
      d={dispatch({ status: 'queued', startedAt: null })}
      wip={wip}
      navigate={vi.fn()}
    />,
  );
  // Still resolves and renders the experiment header.
  expect(screen.getByText('Temperature Cycling Test')).toBeInTheDocument();
});
