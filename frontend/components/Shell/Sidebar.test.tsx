import { test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import Sidebar from './Sidebar';
import type { Route } from '@/lib/types';

// Sidebar is purely props-driven: it renders nav buttons from navItems (or the
// default NAV_ITEMS), calls navigate({ page }) on click, highlights the active
// route, shows per-item counts, and renders the user footer + optional logout.

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { id: 'samples', label: 'Samples', icon: 'Flask' },
  { id: 'wip', label: 'WIP', icon: 'WIP' },
];

const user: Record<string, unknown> = { display: 'lab_manager', subtitle: '實驗室主管' };

test('renders a nav button per provided nav item under its section label', () => {
  renderWithProviders(
    <Sidebar
      route={{ page: 'dashboard' }}
      navigate={vi.fn()}
      navItems={navItems}
      sectionLabel="Lab Operations"
    />,
  );
  expect(screen.getByText('Lab Operations')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Dashboard/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Samples/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /WIP/ })).toBeInTheDocument();
});

test('clicking a nav item calls navigate with that page id', () => {
  const navigate = vi.fn();
  renderWithProviders(
    <Sidebar route={{ page: 'dashboard' }} navigate={navigate} navItems={navItems} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Samples/ }));
  expect(navigate).toHaveBeenCalledWith({ page: 'samples' });
});

test('falls back to the default NAV_ITEMS when none are passed', () => {
  renderWithProviders(<Sidebar route={{ page: 'dashboard' }} navigate={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Dispatches/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Equipment/ })).toBeInTheDocument();
});

test('renders a count badge for items with a positive count', () => {
  renderWithProviders(
    <Sidebar
      route={{ page: 'dashboard' }}
      navigate={vi.fn()}
      navItems={navItems}
      counts={{ samples: 5 }}
    />,
  );
  expect(screen.getByText('5')).toBeInTheDocument();
});

test('omits the count badge when the count is zero', () => {
  renderWithProviders(
    <Sidebar
      route={{ page: 'dashboard' }}
      navigate={vi.fn()}
      navItems={navItems}
      counts={{ samples: 0 }}
    />,
  );
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});

test('renders custom navSections when provided', () => {
  const navSections = [
    { label: 'Group A', items: [{ id: 'a1', label: 'Alpha', icon: 'Home' }] },
    { label: 'Group B', items: [{ id: 'b1', label: 'Beta', icon: 'Flask' }] },
  ];
  renderWithProviders(
    <Sidebar route={{ page: 'a1' }} navigate={vi.fn()} navSections={navSections} />,
  );
  expect(screen.getByText('Group A')).toBeInTheDocument();
  expect(screen.getByText('Group B')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Beta/ })).toBeInTheDocument();
});

test('shows the user display name and subtitle in the footer', () => {
  renderWithProviders(
    <Sidebar route={{ page: 'dashboard' }} navigate={vi.fn()} navItems={navItems} user={user} />,
  );
  expect(screen.getByText('lab_manager')).toBeInTheDocument();
  expect(screen.getByText('實驗室主管')).toBeInTheDocument();
});

test('falls back to default footer identity when no user is given', () => {
  renderWithProviders(
    <Sidebar route={{ page: 'dashboard' }} navigate={vi.fn()} navItems={navItems} />,
  );
  expect(screen.getByText('lab_member')).toBeInTheDocument();
  expect(screen.getByText('實驗室成員')).toBeInTheDocument();
});

test('renders a sign-out button only when onLogout is provided and fires it', () => {
  const onLogout = vi.fn();
  const { rerender } = renderWithProviders(
    <Sidebar route={{ page: 'dashboard' }} navigate={vi.fn()} navItems={navItems} />,
  );
  expect(screen.queryByTitle('Sign out')).not.toBeInTheDocument();

  rerender(
    <Sidebar
      route={{ page: 'dashboard' } as Route}
      navigate={vi.fn()}
      navItems={navItems}
      onLogout={onLogout}
    />,
  );
  fireEvent.click(screen.getByTitle('Sign out'));
  expect(onLogout).toHaveBeenCalledTimes(1);
});
