import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/render';

// LoginPage talks to the backend exclusively through api.auth.login. Because
// the real `api` default export is truthy (api.auth exists), submit always
// takes the api branch — so we mock the default and assert the gate, the
// resolved happy path (login → onLogin), and the rejected error path.
const login = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { auth: { login } } }));

import LoginPage from './LoginPage';

const loggedInUser: Record<string, unknown> = {
  id: 1,
  username: 'alice',
  role: 'lab_member',
  raw_role: 'lab_staff',
  department: 'QA',
};

beforeEach(() => {
  vi.clearAllMocks();
});

test('renders username + password fields and a submit button', () => {
  renderWithProviders(<LoginPage onLogin={vi.fn()} />);
  expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('••••••••••')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
});

test('gates an empty submit: shows the required error and never calls the api', async () => {
  const user = userEvent.setup();
  renderWithProviders(<LoginPage onLogin={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Sign In' }));
  expect(screen.getByText('Username and password required')).toBeInTheDocument();
  expect(login).not.toHaveBeenCalled();
});

test('valid credentials call api.auth.login then onLogin with the mapped user', async () => {
  const onLogin = vi.fn();
  const user = userEvent.setup();
  login.mockResolvedValue(loggedInUser);
  renderWithProviders(<LoginPage onLogin={onLogin} />);

  await user.type(screen.getByPlaceholderText('username'), 'alice');
  await user.type(screen.getByPlaceholderText('••••••••••'), 'pw123');
  await user.click(screen.getByRole('button', { name: 'Sign In' }));

  expect(login).toHaveBeenCalledWith('alice', 'pw123');
  await vi.waitFor(() =>
    expect(onLogin).toHaveBeenCalledWith({
      username: 'alice',
      role: 'lab_member',
      display: 'alice',
      subtitle: 'QA',
    }),
  );
});

test('a failed login surfaces the error message and does not call onLogin', async () => {
  const onLogin = vi.fn();
  const user = userEvent.setup();
  login.mockRejectedValue(new Error('Invalid username or password'));
  renderWithProviders(<LoginPage onLogin={onLogin} />);

  await user.type(screen.getByPlaceholderText('username'), 'alice');
  await user.type(screen.getByPlaceholderText('••••••••••'), 'wrong');
  await user.click(screen.getByRole('button', { name: 'Sign In' }));

  expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
  expect(onLogin).not.toHaveBeenCalled();
});

test('the password visibility toggle flips the input type', async () => {
  const user = userEvent.setup();
  renderWithProviders(<LoginPage onLogin={vi.fn()} />);
  const pw = screen.getByPlaceholderText('••••••••••') as HTMLInputElement;
  expect(pw.type).toBe('password');
  await user.click(screen.getByLabelText('Toggle password'));
  expect(pw.type).toBe('text');
});

test('clicking a demo account fills the username field', async () => {
  const user = userEvent.setup();
  renderWithProviders(<LoginPage onLogin={vi.fn()} />);
  await user.click(screen.getByText('fab_user'));
  expect(screen.getByPlaceholderText('username')).toHaveValue('fab_user');
});
