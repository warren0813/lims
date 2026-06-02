import { test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/render';
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

import Page from './page';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

test('redirects to /login when no session is stored', () => {
  renderWithProviders(<Page />);
  expect(router.replace).toHaveBeenCalledWith('/login');
});

test('routes a stored fab_user to the fab dashboard', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'fab_user' }));
  renderWithProviders(<Page />);
  expect(router.replace).toHaveBeenCalledWith('/fab/dashboard');
});

test('routes a stored lab_manager to the manager dashboard', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'lab_manager' }));
  renderWithProviders(<Page />);
  expect(router.replace).toHaveBeenCalledWith('/manager/dashboard');
});

test('routes a stored lab_member to the lab dashboard', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'lab_member' }));
  renderWithProviders(<Page />);
  expect(router.replace).toHaveBeenCalledWith('/lab/dashboard');
});

test('falls back to /login when the stored session is malformed JSON', () => {
  localStorage.setItem(SESSION_KEY, '{ not valid json');
  renderWithProviders(<Page />);
  expect(router.replace).toHaveBeenCalledWith('/login');
});
