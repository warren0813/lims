import { test, expect, vi } from 'vitest';
import { makeFabNavigate, makeLabNavigate, makeMgrNavigate, roleHome } from './navigate';

test('fab navigation maps routes to URLs (with query + id interpolation)', () => {
  const push = vi.fn();
  const nav = makeFabNavigate(push);

  nav({ page: 'fab_dashboard' });
  nav({ page: 'fab_requests', tab: 'open' });
  nav({ page: 'fab_requests' });
  nav({ page: 'fab_drafts' });
  nav({ page: 'fab_new' });
  nav({ page: 'fab_draft_edit', id: 7 });
  nav({ page: 'fab_request', id: 42 });
  nav({ page: 'something_unknown' });

  expect(push.mock.calls.map((c) => c[0])).toEqual([
    '/fab/dashboard',
    '/fab/requests?tab=open',
    '/fab/requests',
    '/fab/drafts',
    '/fab/requests/new',
    '/fab/drafts/7',
    '/fab/requests/42',
    '/fab/dashboard',
  ]);
});

test('lab navigation honors a custom base path', () => {
  const push = vi.fn();
  const nav = makeLabNavigate(push, '/manager/lab');

  nav({ page: 'lab_dashboard' });
  nav({ page: 'lab_samples', tab: 'wip' });
  nav({ page: 'lab_wafer', id: 3 });
  nav({ page: 'lab_wip' });
  nav({ page: 'lab_wip_detail', id: 5 });
  nav({ page: 'lab_dispatches' });
  nav({ page: 'lab_dispatch_detail', id: 9 });
  nav({ page: 'lab_equipment' });
  nav({ page: 'lab_unknown' });

  expect(push.mock.calls.map((c) => c[0])).toEqual([
    '/manager/lab/dashboard',
    '/manager/lab/samples?tab=wip',
    '/manager/lab/samples/3',
    '/manager/lab/wips',
    '/manager/lab/wips/5',
    '/manager/lab/dispatches',
    '/manager/lab/dispatches/9',
    '/manager/lab/equipment',
    '/manager/lab/dashboard',
  ]);
});

test('lab navigation defaults to /lab base', () => {
  const push = vi.fn();
  makeLabNavigate(push)({ page: 'lab_dashboard' });
  expect(push).toHaveBeenCalledWith('/lab/dashboard');
});

test('manager navigation delegates lab_* routes to the manager lab base', () => {
  const push = vi.fn();
  const nav = makeMgrNavigate(push);

  nav({ page: 'mgr_dashboard' });
  nav({ page: 'mgr_all_requests' });
  nav({ page: 'mgr_request', id: 11 });
  nav({ page: 'mgr_recipes' });
  nav({ page: 'mgr_reports' });
  nav({ page: 'mgr_unknown' });
  nav({ page: 'lab_samples' }); // delegated to /manager/lab

  expect(push.mock.calls.map((c) => c[0])).toEqual([
    '/manager/dashboard',
    '/manager/requests',
    '/manager/requests/11',
    '/manager/recipes',
    '/manager/reports',
    '/manager/dashboard',
    '/manager/lab/samples',
  ]);
});

test('roleHome maps each role to its landing route', () => {
  expect(roleHome('fab_user')).toBe('/fab/dashboard');
  expect(roleHome('lab_manager')).toBe('/manager/dashboard');
  expect(roleHome('lab_member')).toBe('/lab/dashboard');
  expect(roleHome('lab_mem')).toBe('/lab/dashboard');
  expect(roleHome('anything_else')).toBe('/login');
});
