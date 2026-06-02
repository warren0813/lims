import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// LabEquipment reads useLabEquipment ({ equipment, loading, error, refresh })
// and renders tabbed equipment cards. Manage-only controls (Add Equipment,
// per-card Edit) appear only when canManage is true. Mock the hook to a
// controlled value; the EquipmentModal is a heavy, self-fetching child so it
// is replaced with a testid stub. Page/cards/pills render real.
type EquipmentValue = {
  equipment: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};
const empty = (): EquipmentValue => ({ equipment: [], loading: false, error: null, refresh: vi.fn() });
const hook = vi.hoisted(() => ({ value: null as unknown as EquipmentValue }));
vi.mock('@/components/Lab/hooks/useLabEquipment', () => ({ default: () => hook.value }));

// EquipmentModal fetches experiment types and talks to api on its own — stub it.
vi.mock('@/components/Lab/EquipmentModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="equipment-modal" /> : null,
}));

import LabEquipment from './LabEquipment';

const unit = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  name: 'OVEN-01',
  model: 'ESPEC ARS-1100',
  status: 'idle',
  capacity: 4,
  capabilities: [],
  parameters: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = empty();
});

test('shows a loading placeholder while the first fetch is in flight', () => {
  hook.value = { ...empty(), loading: true };
  renderWithProviders(<LabEquipment navigate={vi.fn()} />);
  // "Loading…" renders as both the Page subtitle and the body placeholder.
  expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
});

test('surfaces the hook error in a banner', () => {
  hook.value = { ...empty(), error: 'boom' };
  renderWithProviders(<LabEquipment navigate={vi.fn()} />);
  expect(screen.getByText(/Couldn.t load equipment: boom/)).toBeInTheDocument();
});

test('renders a card per equipment unit once loaded', () => {
  hook.value = { ...empty(), equipment: [unit({ id: 1, name: 'OVEN-01' }), unit({ id: 2, name: 'PROBER-02' })] };
  renderWithProviders(<LabEquipment navigate={vi.fn()} />);
  expect(screen.getByText('OVEN-01')).toBeInTheDocument();
  expect(screen.getByText('PROBER-02')).toBeInTheDocument();
});

test('shows the empty-state card for a tab with no matching units', () => {
  hook.value = { ...empty(), equipment: [unit({ status: 'idle' })] };
  renderWithProviders(<LabEquipment navigate={vi.fn()} />);
  fireEvent.click(screen.getByText('Maintenance'));
  expect(screen.getByText('No equipment in this view')).toBeInTheDocument();
});

test('hides manage controls when canManage is false', () => {
  hook.value = { ...empty(), equipment: [unit()] };
  renderWithProviders(<LabEquipment navigate={vi.fn()} canManage={false} />);
  expect(screen.queryByRole('button', { name: /Add Equipment/i })).not.toBeInTheDocument();
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
});

test('shows manage controls when canManage is true', () => {
  hook.value = { ...empty(), equipment: [unit()] };
  renderWithProviders(<LabEquipment navigate={vi.fn()} canManage />);
  expect(screen.getByRole('button', { name: /Add Equipment/i })).toBeInTheDocument();
  expect(screen.getByText('Edit')).toBeInTheDocument();
});

test('Add Equipment opens the equipment modal', () => {
  hook.value = { ...empty(), equipment: [unit()] };
  renderWithProviders(<LabEquipment navigate={vi.fn()} canManage />);
  expect(screen.queryByTestId('equipment-modal')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Add Equipment/i }));
  expect(screen.getByTestId('equipment-modal')).toBeInTheDocument();
});

test('per-card Edit opens the equipment modal', () => {
  hook.value = { ...empty(), equipment: [unit({ id: 7, name: 'EDIT-ME' })] };
  renderWithProviders(<LabEquipment navigate={vi.fn()} canManage />);
  fireEvent.click(screen.getByText('Edit'));
  expect(screen.getByTestId('equipment-modal')).toBeInTheDocument();
});
