import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

// FabDraftEdit reads useRequestDetail(id) and branches: loading → a spinner
// page, error / missing draft → a "Draft not found" page with a back button,
// success → it hands the draft off to FabNewRequest in edit mode. Mock the hook
// to a controlled value and stub FabNewRequest with a sentinel so we can assert
// the handoff and the draft prop without rendering the whole form.
type HookState = { data: unknown; loading: boolean; error: string | null };
const hook = vi.hoisted(() => ({ value: { data: null, loading: true, error: null } as HookState }));
vi.mock('@/components/Fab/hooks/useRequestDetail', () => ({ default: () => hook.value }));

const fabNewRequest = vi.hoisted(() => vi.fn());
vi.mock('@/components/Fab/FabNewRequest', () => ({
  default: (props: { isEdit?: boolean; draft?: { title?: string } }) => {
    fabNewRequest(props);
    return <div data-testid="fab-new-request">edit:{String(props.isEdit)}:{props.draft?.title}</div>;
  },
}));

import FabDraftEdit from './FabDraftEdit';

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = { data: null, loading: true, error: null };
});

test('shows a loading state while the draft is being fetched', () => {
  hook.value = { data: null, loading: true, error: null };
  renderWithProviders(<FabDraftEdit id={1} navigate={vi.fn()} showToast={vi.fn()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
});

test('shows the not-found page with the error message when the fetch fails', () => {
  hook.value = { data: null, loading: false, error: 'gone' };
  renderWithProviders(<FabDraftEdit id={1} navigate={vi.fn()} showToast={vi.fn()} />);
  expect(screen.getByText('Draft not found')).toBeInTheDocument();
  expect(screen.getByText('gone')).toBeInTheDocument();
});

test('shows the not-found page with a default message when the draft is missing', () => {
  hook.value = { data: null, loading: false, error: null };
  renderWithProviders(<FabDraftEdit id={1} navigate={vi.fn()} showToast={vi.fn()} />);
  expect(screen.getByText('This draft is no longer available.')).toBeInTheDocument();
});

test('the Drafts breadcrumb navigates back to the drafts list', () => {
  const navigate = vi.fn();
  hook.value = { data: null, loading: false, error: 'gone' };
  renderWithProviders(<FabDraftEdit id={1} navigate={navigate} showToast={vi.fn()} />);
  fireEvent.click(screen.getByText(/Drafts/));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_drafts' });
});

test('hands the loaded draft to FabNewRequest in edit mode', () => {
  hook.value = { data: { id: 1, title: 'My draft' }, loading: false, error: null };
  renderWithProviders(<FabDraftEdit id={1} navigate={vi.fn()} showToast={vi.fn()} />);
  expect(screen.getByTestId('fab-new-request')).toHaveTextContent('edit:true:My draft');
  const call = fabNewRequest.mock.calls[0][0];
  expect(call.isEdit).toBe(true);
  expect(call.draft).toEqual({ id: 1, title: 'My draft' });
});
