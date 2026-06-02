import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';

// Screen components read a data hook and render loading / error / empty / list
// states off it. Mock the hook to a controlled value (mutated per test) and the
// api default for any action method; everything else (FabPage, pills, icons) is
// presentational and renders for real.
type HookState = { data: unknown[]; loading: boolean; error: string | null; refresh: () => void };
const hook = vi.hoisted(
  () => ({ value: { data: [], loading: false, error: null, refresh: vi.fn() } as HookState }),
);
vi.mock('@/components/Fab/hooks/useRequests', () => ({ default: () => hook.value }));

const deleteDraft = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { deleteDraft } } }));

import FabRequestList from './FabRequestList';

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  title: 'Wafer batch A',
  status: 'in_progress',
  urgency: '1w',
  created: '2026-05-01 09:30',
  sampleCount: 2,
  samples: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: [], loading: false, error: null, refresh: vi.fn() };
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { data: [], loading: true, error: null, refresh: vi.fn() };
  renderWithProviders(<FabRequestList navigate={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('renders a row per request once loaded', () => {
  hook.value.data = [row({ id: 1, title: 'Wafer batch A' }), row({ id: 2, title: 'Wafer batch B' })];
  renderWithProviders(<FabRequestList navigate={vi.fn()} />);
  expect(screen.getByText('Wafer batch A')).toBeInTheDocument();
  expect(screen.getByText('Wafer batch B')).toBeInTheDocument();
});

test('clicking a row navigates to that request detail', () => {
  const navigate = vi.fn();
  hook.value.data = [row({ id: 7, title: 'Clickable' })];
  renderWithProviders(<FabRequestList navigate={navigate} />);
  fireEvent.click(screen.getByText('Clickable'));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_request', id: 7 });
});

test('the New Request action navigates to the new-request form', () => {
  const navigate = vi.fn();
  hook.value.data = [row()];
  renderWithProviders(<FabRequestList navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: /New Request/i }));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_new' });
});

test('filters down to nothing shows the empty-state card', async () => {
  const user = userEvent.setup();
  hook.value.data = [row({ title: 'Only match' })];
  renderWithProviders(<FabRequestList navigate={vi.fn()} />);
  await user.type(screen.getByPlaceholderText(/Search by title or ID/i), 'zzzzz');
  expect(screen.getByText('No requests match these filters')).toBeInTheDocument();
});

test('surfaces the hook error in a banner', () => {
  hook.value = { data: [], loading: false, error: 'boom', refresh: vi.fn() };
  renderWithProviders(<FabRequestList navigate={vi.fn()} />);
  expect(screen.getByText(/Failed to load requests: boom/)).toBeInTheDocument();
});

test('drafts mode deletes a draft after confirmation and refreshes', async () => {
  const refresh = vi.fn();
  hook.value = {
    data: [row({ id: 3, title: 'Draft X', status: 'draft' })],
    loading: false,
    error: null,
    refresh,
  };
  deleteDraft.mockResolvedValue(null);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

  renderWithProviders(<FabRequestList navigate={vi.fn()} drafts titleOverride="Drafts" />);
  fireEvent.click(screen.getByTitle('Delete draft'));

  expect(confirmSpy).toHaveBeenCalled();
  expect(deleteDraft).toHaveBeenCalledWith(3);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  confirmSpy.mockRestore();
});
