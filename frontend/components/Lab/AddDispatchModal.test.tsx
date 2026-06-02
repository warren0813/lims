import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

// Thin wrapper: returns null when closed or when `wip` is missing, otherwise
// renders the Inner. Stub the Inner with a sentinel so this test verifies only
// the gating + prop pass-through, not the (separately tested) form.
const innerProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
vi.mock('@/components/Lab/AddDispatchModalInner', () => ({
  default: (props: Record<string, unknown>) => {
    innerProps.value = props;
    return <div data-testid="dispatch-inner">inner</div>;
  },
}));

import AddDispatchModal from './AddDispatchModal';

const wip = { id: 12, experimentId: 9, experimentName: 'Etch run', sampleCount: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  innerProps.value = null;
});

test('renders nothing when closed', () => {
  renderWithProviders(<AddDispatchModal open={false} onClose={vi.fn()} wip={wip} />);
  expect(screen.queryByTestId('dispatch-inner')).not.toBeInTheDocument();
});

test('renders nothing when open but wip is missing', () => {
  renderWithProviders(
    <AddDispatchModal open onClose={vi.fn()} wip={null as unknown as typeof wip} />,
  );
  expect(screen.queryByTestId('dispatch-inner')).not.toBeInTheDocument();
});

test('renders the inner and forwards onClose/wip/onCreated when open with a wip', () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  renderWithProviders(
    <AddDispatchModal open onClose={onClose} wip={wip} onCreated={onCreated} />,
  );
  expect(screen.getByTestId('dispatch-inner')).toBeInTheDocument();
  expect(innerProps.value).toMatchObject({ onClose, wip, onCreated });
});
