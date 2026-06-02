import type { ComponentProps } from 'react';
import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/render';

// FabNewRequest is the create/edit form. It reads useExperimentTypes for the
// experiment picker and calls api.requests.create (+submit on publish) or
// api.requests.update for the edit path. Mock the hook to a controlled value and
// the api default for the action methods. ExpCard, UrgencyTile, FabPage and the
// summary card are presentational and render for real.
const expTypes = vi.hoisted(() => ({
  value: { data: [] as unknown[], error: null as string | null },
}));
vi.mock('@/components/Fab/hooks/useExperimentTypes', () => ({ default: () => expTypes.value }));

const create = vi.hoisted(() => vi.fn());
const submit = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { requests: { create, submit, update } } }));

import FabNewRequest from './FabNewRequest';

const EXPERIMENTS = [
  { id: 1, name: 'Thermal Cycle Test', description: 'TCT desc', labCategory: 'REL' },
  { id: 2, name: 'Electrical Probe', description: 'EP desc', labCategory: 'ELEC' },
];

beforeEach(() => {
  vi.clearAllMocks();
  expTypes.value = { data: EXPERIMENTS, error: null };
});

test('renders the form with both sections and experiment choices', () => {
  renderWithProviders(<FabNewRequest navigate={vi.fn()} />);
  expect(screen.getByText('New Request')).toBeInTheDocument();
  expect(screen.getByText('Basic Information')).toBeInTheDocument();
  expect(screen.getByText('Samples & Experiments')).toBeInTheDocument();
  expect(screen.getByText('Thermal Cycle Test')).toBeInTheDocument();
  expect(screen.getByText('Electrical Probe')).toBeInTheDocument();
});

test('surfaces an experiment-types load error inside the picker', () => {
  expTypes.value = { data: [], error: 'network down' };
  renderWithProviders(<FabNewRequest navigate={vi.fn()} />);
  expect(screen.getByText(/Couldn't load experiment types: network down/)).toBeInTheDocument();
});

test('the Submit button is disabled until the form is valid', () => {
  renderWithProviders(<FabNewRequest navigate={vi.fn()} />);
  const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
  expect(submitBtn).toBeDisabled();
});

test('a valid form enables submit and create+submit are called on publish', async () => {
  const navigate = vi.fn();
  const showToast = vi.fn();
  const user = userEvent.setup();
  create.mockResolvedValue({ id: 55 });
  submit.mockResolvedValue({ id: 55 });

  renderWithProviders(
    <FabNewRequest navigate={navigate} showToast={showToast} />,
  );

  await user.type(screen.getByPlaceholderText(/TCT 050901/i), 'My batch');
  await user.type(screen.getByPlaceholderText(/Wafer ID/i), 'W001');
  fireEvent.click(screen.getByText('Thermal Cycle Test'));

  const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
  expect(submitBtn).not.toBeDisabled();
  fireEvent.click(submitBtn);

  await vi.waitFor(() => expect(create).toHaveBeenCalled());
  const [payload] = create.mock.calls[0];
  expect(payload).toMatchObject({
    title: 'My batch',
    urgency: '1w',
    experiment_type_ids: [1],
    samples: [{ wafer_id: 'W001', wafer_size: '200mm', experiment_type_ids: [1] }],
  });
  await vi.waitFor(() => expect(submit).toHaveBeenCalledWith(55));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_requests' });
});

test('Save Draft creates without submitting and navigates to drafts', async () => {
  const navigate = vi.fn();
  const user = userEvent.setup();
  create.mockResolvedValue({ id: 77 });

  renderWithProviders(<FabNewRequest navigate={navigate} />);
  await user.type(screen.getByPlaceholderText(/TCT 050901/i), 'Draft batch');

  fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }));

  await vi.waitFor(() => expect(create).toHaveBeenCalled());
  expect(submit).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ page: 'fab_drafts' }));
});

test('adding a wafer renders a second wafer card', async () => {
  const user = userEvent.setup();
  renderWithProviders(<FabNewRequest navigate={vi.fn()} />);
  expect(screen.getAllByPlaceholderText(/Wafer ID/i)).toHaveLength(1);
  await user.click(screen.getByText(/Add another wafer/i));
  expect(screen.getAllByPlaceholderText(/Wafer ID/i)).toHaveLength(2);
});

test('the cancel breadcrumb navigates back to the request list', () => {
  const navigate = vi.fn();
  renderWithProviders(<FabNewRequest navigate={navigate} />);
  // breadcrumb back-link
  fireEvent.click(screen.getByText(/My Requests/i));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_requests' });
});

test('surfaces an api error when create fails', async () => {
  const user = userEvent.setup();
  create.mockRejectedValue(new Error('server exploded'));

  renderWithProviders(<FabNewRequest navigate={vi.fn()} />);
  await user.type(screen.getByPlaceholderText(/TCT 050901/i), 'Will fail');
  fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }));

  expect(await screen.findByText('server exploded')).toBeInTheDocument();
});

test('edit mode submits a draft via update + submit', async () => {
  const navigate = vi.fn();
  const showToast = vi.fn();
  update.mockResolvedValue({ id: 12 });
  submit.mockResolvedValue({ id: 12 });
  // Only the fields FabNewRequest reads off a draft; cast through the prop type
  // (the full RequestDetail shape is larger than this test needs).
  const draft = {
    id: 12,
    title: 'Existing draft',
    note: '',
    urgency: '1w',
    samples: [{ wafer: 'W009', size: '200mm', expIds: [1] }],
  } as unknown as ComponentProps<typeof FabNewRequest>['draft'];

  renderWithProviders(
    <FabNewRequest navigate={navigate} isEdit draft={draft} showToast={showToast} />,
  );

  expect(screen.getByText('Edit Draft #0012')).toBeInTheDocument();
  const submitBtn = screen.getByRole('button', { name: /Submit Draft/i });
  expect(submitBtn).not.toBeDisabled();
  fireEvent.click(submitBtn);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(12, expect.any(Object)));
  await vi.waitFor(() => expect(submit).toHaveBeenCalledWith(12));
  expect(navigate).toHaveBeenCalledWith({ page: 'fab_request', id: 12 });
});
