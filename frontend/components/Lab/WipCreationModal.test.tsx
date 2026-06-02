import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

// Thin wrapper: returns null when closed, otherwise renders the Inner. Stub the
// Inner with a sentinel so this test verifies only the gating + prop pass-through.
const innerProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
vi.mock('@/components/Lab/WipCreationModalInner', () => ({
  default: (props: Record<string, unknown>) => {
    innerProps.value = props;
    return <div data-testid="wip-inner">inner</div>;
  },
}));

import WipCreationModal from './WipCreationModal';

beforeEach(() => {
  vi.clearAllMocks();
  innerProps.value = null;
});

test('renders nothing when closed', () => {
  renderWithProviders(<WipCreationModal open={false} onClose={vi.fn()} />);
  expect(screen.queryByTestId('wip-inner')).not.toBeInTheDocument();
});

test('renders the inner and forwards onClose/onSaved when open', () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  renderWithProviders(<WipCreationModal open onClose={onClose} onSaved={onSaved} />);
  expect(screen.getByTestId('wip-inner')).toBeInTheDocument();
  expect(innerProps.value).toMatchObject({ onClose, onSaved });
});
