import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent, waitFor } from '@/test/render';
import * as I from '@/components/ui/I';
import ReportCard from './ReportCard';

// ReportCard is purely presentational: it takes all data via props, including
// an onGenerate(range) callback that resolves the result entries. No hook, api,
// or next/navigation mock is needed — craft props and drive the form.
type ReportEntry = { label: string; value: string | number };

const baseProps = (over: Partial<Record<string, unknown>> = {}) => ({
  title: 'Utilization',
  subtitle: 'Equipment utilization for a period.',
  accent: '#2563eb',
  accentBg: '#dbeafe',
  icon: <I.TrendUp size={14} />,
  onGenerate: vi.fn<(range: { start: string; end: string }) => Promise<ReportEntry[]>>(),
  ...over,
});

test('renders the title, subtitle and a disabled Generate button initially', () => {
  const props = baseProps();
  renderWithProviders(<ReportCard {...props} />);
  expect(screen.getByText('Utilization')).toBeInTheDocument();
  expect(screen.getByText('Equipment utilization for a period.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Generate/i })).toBeDisabled();
});

test('does not call onGenerate while the date range is incomplete', () => {
  const onGenerate = vi.fn();
  renderWithProviders(<ReportCard {...baseProps({ onGenerate })} />);
  // Button is disabled with no dates; clicking is a no-op.
  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));
  expect(onGenerate).not.toHaveBeenCalled();
});

test('enables Generate once both dates are set and passes them to onGenerate', async () => {
  const onGenerate = vi.fn().mockResolvedValue([]);
  const { container } = renderWithProviders(<ReportCard {...baseProps({ onGenerate })} />);

  const [startInput, endInput] = Array.from(
    container.querySelectorAll('input[type="date"]'),
  ) as HTMLInputElement[];
  fireEvent.change(startInput, { target: { value: '2026-05-01' } });
  fireEvent.change(endInput, { target: { value: '2026-05-31' } });

  const generate = screen.getByRole('button', { name: /Generate/i });
  expect(generate).toBeEnabled();

  fireEvent.click(generate);
  await waitFor(() =>
    expect(onGenerate).toHaveBeenCalledWith({ start: '2026-05-01', end: '2026-05-31' }),
  );
});

test('renders the computed result entries returned by onGenerate', async () => {
  const onGenerate = vi.fn().mockResolvedValue([
    { label: 'Total', value: 42 },
    { label: 'Avg Util', value: '73%' },
    { label: 'Peak', value: '95%' },
  ]);
  const { container } = renderWithProviders(<ReportCard {...baseProps({ onGenerate })} />);

  const [startInput, endInput] = Array.from(
    container.querySelectorAll('input[type="date"]'),
  ) as HTMLInputElement[];
  fireEvent.change(startInput, { target: { value: '2026-05-01' } });
  fireEvent.change(endInput, { target: { value: '2026-05-31' } });
  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('Result')).toBeInTheDocument();
  expect(screen.getByText('Total')).toBeInTheDocument();
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByText('Avg Util')).toBeInTheDocument();
  expect(screen.getByText('73%')).toBeInTheDocument();
  expect(screen.getByText('Peak')).toBeInTheDocument();
  expect(screen.getByText('95%')).toBeInTheDocument();
});

test('surfaces an error from onGenerate and renders no result block', async () => {
  const onGenerate = vi.fn().mockRejectedValue(new Error('report failed'));
  const { container } = renderWithProviders(<ReportCard {...baseProps({ onGenerate })} />);

  const [startInput, endInput] = Array.from(
    container.querySelectorAll('input[type="date"]'),
  ) as HTMLInputElement[];
  fireEvent.change(startInput, { target: { value: '2026-05-01' } });
  fireEvent.change(endInput, { target: { value: '2026-05-31' } });
  fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

  expect(await screen.findByText('report failed')).toBeInTheDocument();
  expect(screen.queryByText('Result')).not.toBeInTheDocument();
});

test('shows the generating label while the promise is pending', async () => {
  const user = userEvent.setup();
  let resolve: (v: ReportEntry[]) => void = () => {};
  const pending = new Promise<ReportEntry[]>((r) => {
    resolve = r;
  });
  const onGenerate = vi.fn().mockReturnValue(pending);
  const { container } = renderWithProviders(<ReportCard {...baseProps({ onGenerate })} />);

  const [startInput, endInput] = Array.from(
    container.querySelectorAll('input[type="date"]'),
  ) as HTMLInputElement[];
  fireEvent.change(startInput, { target: { value: '2026-05-01' } });
  fireEvent.change(endInput, { target: { value: '2026-05-31' } });
  await user.click(screen.getByRole('button', { name: /Generate/i }));

  expect(screen.getByText('Generating…')).toBeInTheDocument();
  resolve([{ label: 'Done', value: 1 }]);
  expect(await screen.findByText('Done')).toBeInTheDocument();
});
