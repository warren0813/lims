import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import PostLogin from './PostLogin';
import type { User } from '@/lib/types';

// PostLogin is self-contained: no data hook, no api, no next/navigation. It
// takes a user + onLogout, derives the role-aware nav/foundation off
// user.role, manages the active route in local state, and renders real
// presentational children (Sidebar, TopBar, Cards). So we drive it purely by
// props and assert the role branch + the onLogout wiring.

const labUser: User & { display: string; subtitle: string } = {
  id: 1,
  username: 'lab_manager',
  role: 'lab_manager',
  raw_role: 'lab_manager',
  department: 'Lab',
  display: 'lab_manager',
  subtitle: '實驗室主管',
};

const fabUser: User & { display: string; subtitle: string } = {
  id: 2,
  username: 'fab_user',
  role: 'fab_user',
  raw_role: 'fab_user',
  department: 'Fab',
  display: 'fab_user',
  subtitle: '廠區使用者',
};

test('renders the welcome hero with the user display name', () => {
  renderWithProviders(<PostLogin user={labUser} onLogout={vi.fn()} />);
  expect(screen.getByText('Welcome back, lab_manager')).toBeInTheDocument();
});

test('lab role renders the lab operator surface and lab nav items', () => {
  renderWithProviders(<PostLogin user={labUser} onLogout={vi.fn()} />);
  expect(screen.getByText('Lab operator surface')).toBeInTheDocument();
  // "Dispatches" is a lab-only nav entry; the sidebar renders it as a button.
  expect(screen.getByRole('button', { name: /Dispatches/ })).toBeInTheDocument();
  expect(screen.getByText('Lab Operations')).toBeInTheDocument();
});

test('fab role renders the fab user surface and fab-specific nav items', () => {
  renderWithProviders(<PostLogin user={fabUser} onLogout={vi.fn()} />);
  expect(screen.getByText('Fab user surface')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /My Requests/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Drafts/ })).toBeInTheDocument();
  expect(screen.getByText('Requests')).toBeInTheDocument();
});

test('shows the signed-in username and role chip in the session card', () => {
  renderWithProviders(<PostLogin user={labUser} onLogout={vi.fn()} />);
  // username appears in the foundation banner code tag and the session card.
  expect(screen.getAllByText('lab_manager').length).toBeGreaterThan(0);
  expect(screen.getByText('Signed in')).toBeInTheDocument();
});

test('the session card Sign out button invokes onLogout', () => {
  const onLogout = vi.fn();
  renderWithProviders(<PostLogin user={labUser} onLogout={onLogout} />);
  // Two controls share the "Sign out" accessible name: the card button (with
  // visible text) and the sidebar footer button (title only). The card button
  // is the one carrying the visible text node, so match it without a title.
  const cardButton = screen
    .getAllByRole('button', { name: /Sign out/ })
    .find((b) => !b.getAttribute('title'));
  expect(cardButton).toBeDefined();
  fireEvent.click(cardButton as HTMLElement);
  expect(onLogout).toHaveBeenCalledTimes(1);
});

test('the sidebar footer logout (logout icon) also invokes onLogout', () => {
  const onLogout = vi.fn();
  renderWithProviders(<PostLogin user={labUser} onLogout={onLogout} />);
  fireEvent.click(screen.getByTitle('Sign out'));
  expect(onLogout).toHaveBeenCalledTimes(1);
});
