import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/render';
import { navigationModule } from '@/test/mocks/nextNavigation';
import { SESSION_KEY } from '@/components/App/constants';

// vi.mock factories are hoisted, so build the router spy with vi.hoisted and
// reference it from the factory (the pattern documented in nextNavigation.ts).
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock('next/navigation', () => navigationModule(router));

// Stub the children so these tests exercise the PAGE's session/redirect logic
// only, not the real login screen or tweaks UI. The LoginPage stub exposes a
// button that fires the page's onLogin handler.
vi.mock('@/components/Login/LoginPage', () => ({
  default: (props: { onLogin: (user: { role: string }) => void }) => (
    <button data-testid="login-submit" onClick={() => props.onLogin({ role: 'fab_user' })}>
      login
    </button>
  ),
}));

vi.mock('@/components/App/TweaksUI', () => ({
  default: () => <div data-testid="tweaks-ui" />,
}));

import Page from './page';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

test('renders the login screen and does not redirect when no session is stored', () => {
  renderWithProviders(<Page />);
  expect(screen.getByTestId('login-submit')).toBeInTheDocument();
  expect(router.replace).not.toHaveBeenCalled();
});

test('redirects a stored lab_manager to the manager dashboard', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'lab_manager' }));
  renderWithProviders(<Page />);
  expect(router.replace).toHaveBeenCalledWith('/manager/dashboard');
});

test('redirects a stored fab_user to the fab dashboard', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'fab_user' }));
  renderWithProviders(<Page />);
  expect(router.replace).toHaveBeenCalledWith('/fab/dashboard');
});

test('logging in persists the session and pushes the role home route', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Page />);

  await user.click(screen.getByTestId('login-submit'));

  expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')).toEqual({ role: 'fab_user' });
  expect(router.push).toHaveBeenCalledWith('/fab/dashboard');
});
