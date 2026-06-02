import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import api from './index';

// The client talks to the backend through the global `fetch`. `call()` reads
// res.ok / res.status / res.statusText / res.headers.get('Content-Type') and
// then res.json() or res.text(); this stand-in mirrors exactly that surface.
function response(
  body: unknown,
  {
    status = 200,
    statusText = 'OK',
    contentType = 'application/json',
  }: { status?: number; statusText?: string; contentType?: string } = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('auth.login posts credentials, stores tokens, and normalizes the user role', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      access_token: 'A',
      refresh_token: 'R',
      id: 7,
      username: 'alice',
      role: 'lab_staff',
      department: 'QA',
    }),
  );
  const user = await api.auth.login('alice', 'pw');

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/auth/login');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ username: 'alice', password: 'pw' });
  expect(user).toMatchObject({ id: 7, username: 'alice', role: 'lab_member', raw_role: 'lab_staff' });
  expect(localStorage.getItem('lims.access')).toBe('A');
  expect(localStorage.getItem('lims.refresh')).toBe('R');
});

test('attaches the bearer token and JSON headers once authenticated', async () => {
  localStorage.setItem('lims.access', 'TOKEN');
  fetchMock.mockResolvedValueOnce(response([]));
  await api.experimentTypes.list();

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toContain('/experiment-types');
  expect(init.headers.Authorization).toBe('Bearer TOKEN');
  expect(init.headers['Content-Type']).toBe('application/json');
});

test('throws an ApiError carrying the backend detail on a non-ok response', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ detail: 'no good' }, { status: 400, statusText: 'Bad Request' }),
  );
  await expect(api.experimentTypes.list()).rejects.toThrow('no good');
});

test('joins a list-shaped validation detail into one message', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ detail: [{ msg: 'a required' }, { msg: 'b required' }] }, { status: 422 }),
  );
  await expect(api.experimentTypes.list()).rejects.toThrow('a required; b required');
});

test('auth.logout clears stored tokens (and tolerates a 204 No Content)', async () => {
  localStorage.setItem('lims.access', 'A');
  localStorage.setItem('lims.refresh', 'R');
  fetchMock.mockResolvedValueOnce(response(null, { status: 204, contentType: '' }));
  await api.auth.logout();
  expect(localStorage.getItem('lims.access')).toBeNull();
  expect(localStorage.getItem('lims.refresh')).toBeNull();
});

test('refreshes the token on a 401 and replays the original request', async () => {
  localStorage.setItem('lims.access', 'OLD');
  localStorage.setItem('lims.refresh', 'R');
  fetchMock
    .mockResolvedValueOnce(response({ detail: 'expired' }, { status: 401 })) // original 401
    .mockResolvedValueOnce(response({ access_token: 'NEW', refresh_token: 'R2' })) // /auth/refresh
    .mockResolvedValueOnce(response([])); // replayed request

  const out = await api.experimentTypes.list();

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
  expect(localStorage.getItem('lims.access')).toBe('NEW');
  expect(out).toEqual([]);
});
