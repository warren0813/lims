import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import api, { LIMS_STATUS_MAPS } from './index';

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

// ---------------------------------------------------------------------------
// experimentTypes
// ---------------------------------------------------------------------------

test('experimentTypes.list maps lab_category -> labCategory (camelCase)', async () => {
  fetchMock.mockResolvedValueOnce(
    response([{ id: 1, name: 'Etch', description: 'desc', lab_category: 'thin_film' }]),
  );
  const out = await api.experimentTypes.list({ q: 'et' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toContain('/experiment-types?');
  expect(url).toContain('q=et');
  expect(init.method).toBeUndefined();
  expect(out).toEqual([{ id: 1, name: 'Etch', description: 'desc', labCategory: 'thin_film' }]);
});

// ---------------------------------------------------------------------------
// equipment
// ---------------------------------------------------------------------------

test('equipment.list normalizes status via EQUIPMENT_STATUS_MAP and passes through fields', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        id: 3,
        name: 'PVD-1',
        model_name: 'AMAT-200',
        capacity: 4,
        status: 'available',
        capabilities: [{ id: 1 }],
        parameters: { power: 5 },
      },
    ]),
  );
  const out = await api.equipment.list();

  const [url] = fetchMock.mock.calls[0];
  expect(url).toContain('/equipment?');
  expect(out).toEqual([
    {
      id: 3,
      name: 'PVD-1',
      model: 'AMAT-200',
      capacity: 4,
      status: 'idle', // available -> idle
      raw_status: 'available',
      capabilities: [{ id: 1 }],
      parameters: { power: 5 },
    },
  ]);
});

test('equipment.create sends snake_case body (with status) and normalizes the response', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 9,
      name: 'Furnace',
      model_name: 'TF-9',
      capacity: 2,
      status: 'maintenance',
    }),
  );
  const out = await api.equipment.create({
    name: 'Furnace',
    modelName: 'TF-9',
    capacity: 2,
    status: 'maintenance',
    experimentTypeIds: [1, 2],
    parameters: { temp: 900 },
  });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/equipment/');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({
    name: 'Furnace',
    model_name: 'TF-9',
    capacity: 2,
    experiment_type_ids: [1, 2],
    parameters: { temp: 900 },
    status: 'maintenance',
  });
  expect(out.status).toBe('maintenance'); // maintenance -> maintenance
  expect(out.model).toBe('TF-9');
  expect(out.capabilities).toEqual([]);
  expect(out.parameters).toEqual({});
});

test('equipment.create omits status when not provided (defaults applied)', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 1, name: 'X', model_name: 'M', capacity: 1, status: 'available' }),
  );
  await api.equipment.create({ name: 'X', modelName: 'M', capacity: 1 });

  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body).not.toHaveProperty('status');
  expect(body.experiment_type_ids).toEqual([]);
  expect(body.parameters).toEqual({});
});

test('equipment.update only includes provided fields and PATCHes the id URL', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 5, name: 'New', model_name: 'M', capacity: 3, status: 'disabled' }),
  );
  const out = await api.equipment.update(5, { name: 'New', capacity: 3 });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/equipment/5');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(init.body)).toEqual({ name: 'New', capacity: 3 });
  expect(out.status).toBe('maintenance'); // disabled -> maintenance
});

test('equipment.update with all fields builds the full snake_case body', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 5, name: 'N', model_name: 'MM', capacity: 7, status: 'available' }),
  );
  await api.equipment.update(5, {
    name: 'N',
    modelName: 'MM',
    capacity: 7,
    status: 'available',
    parameters: { a: 1 },
  });

  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    name: 'N',
    model_name: 'MM',
    capacity: 7,
    status: 'available',
    parameters: { a: 1 },
  });
});

test('equipment.setCapabilities POSTs experiment_type_ids to the capabilities URL', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 5, name: 'N', model_name: 'M', capacity: 1, status: 'available' }),
  );
  const out = await api.equipment.setCapabilities(5, [10, 20]);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/equipment/5/capabilities');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ experiment_type_ids: [10, 20] });
  expect(out.id).toBe(5);
});

// ---------------------------------------------------------------------------
// recipes
// ---------------------------------------------------------------------------

test('recipes.list normalizes nested experiment_type and is_active', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        id: 2,
        name: 'R1',
        description: 'd',
        experiment_type: { id: 7, name: 'Etch' },
        parameters: { p: 1 },
        is_active: true,
      },
    ]),
  );
  const out = await api.recipes.list();

  expect(fetchMock.mock.calls[0][0]).toContain('/recipes?');
  expect(out).toEqual([
    {
      id: 2,
      name: 'R1',
      description: 'd',
      experimentId: 7,
      experimentName: 'Etch',
      params: { p: 1 },
      active: true,
    },
  ]);
});

test('recipes.list falls back to null experiment fields when experiment_type missing', async () => {
  fetchMock.mockResolvedValueOnce(
    response([{ id: 3, name: 'R', description: '', is_active: false }]),
  );
  const out = await api.recipes.list();
  expect(out[0].experimentId).toBeNull();
  expect(out[0].experimentName).toBeNull();
  expect(out[0].params).toEqual({});
  expect(out[0].active).toBe(false);
});

test('recipes.create sends experiment_type_id snake_case body', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 1, name: 'R', description: 'd', is_active: true }),
  );
  await api.recipes.create({
    name: 'R',
    description: 'd',
    experimentTypeId: 4,
    parameters: { x: 1 },
  });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/recipes/');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({
    name: 'R',
    description: 'd',
    experiment_type_id: 4,
    parameters: { x: 1 },
  });
});

test('recipes.update only includes provided fields', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 2, name: 'R2', description: 'd', is_active: true }),
  );
  await api.recipes.update(2, { name: 'R2' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/recipes/2');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(init.body)).toEqual({ name: 'R2' });
});

test('recipes.remove issues DELETE and returns null', async () => {
  fetchMock.mockResolvedValueOnce(response(null, { status: 204, contentType: '' }));
  const out = await api.recipes.remove(8);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/recipes/8');
  expect(init.method).toBe('DELETE');
  expect(out).toBeNull();
});

// ---------------------------------------------------------------------------
// requests
// ---------------------------------------------------------------------------

test('requests.list maps pending_approval -> submitted, formats timestamps, derives expIds', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        id: 11,
        title: 'Req A',
        status: 'pending_approval',
        urgency: '2w',
        requester: { id: 1, username: 'bob' },
        note: 'n',
        created_at: '2026-01-02T03:04:00Z',
        submitted_at: null,
        updated_at: '2026-01-03T05:06:00Z',
        sample_count: 4,
        experiment_types: [{ id: 7 }, { id: 8 }],
      },
    ]),
  );
  const out = await api.requests.list({ status: 'pending_approval' });

  expect(fetchMock.mock.calls[0][0]).toContain('/requests?');
  const row = out[0];
  expect(row.status).toBe('submitted'); // pending_approval -> submitted
  expect(row.rawStatus).toBe('pending_approval');
  expect(row.raw_status).toBe('pending_approval');
  expect(row.urgency).toBe('2w');
  expect(row.sampleCount).toBe(4);
  expect(row.expIds).toEqual([7, 8]);
  expect(row.submitted).toBeNull();
  // formatTimestamp renders local YYYY-MM-DD HH:MM; assert the shape, not tz.
  expect(row.created).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(row.samples).toEqual([]);
  expect(row.history).toEqual([]);
});

test('requests.list applies urgency default and zero sampleCount when omitted', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        id: 12,
        title: 'Req B',
        status: 'approved',
        requester: { id: 1, username: 'bob' },
        note: '',
        created_at: '2026-01-02T03:04:00Z',
        submitted_at: '2026-01-02T03:05:00Z',
        updated_at: '2026-01-02T03:06:00Z',
      },
    ]),
  );
  const out = await api.requests.list();
  expect(out[0].status).toBe('in_progress'); // approved -> in_progress
  expect(out[0].urgency).toBe('1w'); // default
  expect(out[0].sampleCount).toBe(0);
  expect(out[0].expIds).toEqual([]);
});

test('requests.get normalizes nested samples (SAMPLE_STATUS_MAP) and approval history', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 20,
      title: 'Detail',
      status: 'completed',
      requester: { id: 1, username: 'bob' },
      note: '',
      created_at: '2026-01-02T03:04:00Z',
      submitted_at: '2026-01-02T03:05:00Z',
      updated_at: '2026-01-02T03:06:00Z',
      completed_at: '2026-01-04T00:00:00Z',
      closed_at: null,
      experiment_types: [{ id: 9 }],
      samples: [
        { id: 100, wafer_id: 'W1', wafer_size: '8in', status: 'created', experiment_type_ids: [9] },
      ],
      approval_logs: [
        {
          action: 'approve',
          reviewer: { username: 'mgr' },
          created_at: '2026-01-03T00:00:00Z',
          comment: 'ok',
        },
      ],
    }),
  );
  const out = await api.requests.get(20);

  expect(fetchMock.mock.calls[0][0]).toBe('/api/requests/20');
  expect(out.status).toBe('completed');
  expect(out.expIds).toEqual([9]);
  expect(out.samples).toEqual([
    { id: 100, wafer: 'W1', size: '8in', status: 'incoming', raw_status: 'created', expIds: [9] },
  ]);
  expect(out.history).toEqual([
    { action: 'APPROVE', by: 'mgr', at: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/), note: 'ok' },
  ]);
  expect(out.closed_at).toBeNull();
});

test('requests.get normalizes per-sample experiment progress when present', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 21,
      title: 'Req with progress',
      status: 'approved',
      requester: { id: 1, username: 'fab' },
      note: '',
      created_at: '2026-01-02T03:04:00Z',
      submitted_at: '2026-01-02T03:05:00Z',
      updated_at: '2026-01-02T03:06:00Z',
      completed_at: null,
      closed_at: null,
      experiment_types: [{ id: 9 }],
      samples: [
        {
          id: 101,
          wafer_id: 'W2',
          wafer_size: '200mm',
          status: 'completed',
          experiment_type_ids: [9],
          experiments: [
            {
              experiment_type_id: 9,
              experiment_type_name: 'Final Test',
              status: 'completed',
              verdict: 'pass',
              dispatch_id: 5,
            },
          ],
        },
      ],
      approval_logs: [],
    }),
  );

  const out = await api.requests.get(21);

  expect(out.samples).toEqual([
    {
      id: 101,
      wafer: 'W2',
      size: '200mm',
      status: 'completed',
      raw_status: 'completed',
      expIds: [9],
      experiments: [
        {
          experimentTypeId: 9,
          experimentName: 'Final Test',
          status: 'completed',
          verdict: 'pass',
          dispatchId: 5,
        },
      ],
    },
  ]);
});

test('requests.create POSTs payload to trailing-slash URL and returns a detail shape', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 30,
      title: 'New',
      status: 'draft',
      requester: { id: 1, username: 'bob' },
      note: '',
      created_at: '2026-01-02T03:04:00Z',
      submitted_at: null,
      updated_at: '2026-01-02T03:04:00Z',
    }),
  );
  const out = await api.requests.create({ title: 'New', foo: 'bar' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/requests/');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ title: 'New', foo: 'bar' });
  expect(out.status).toBe('draft'); // draft -> draft
  expect(out.samples).toEqual([]);
});

test('requests.update PATCHes the id URL with the payload', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 30,
      title: 'Edited',
      status: 'draft',
      requester: { id: 1, username: 'bob' },
      note: '',
      created_at: '2026-01-02T03:04:00Z',
      submitted_at: null,
      updated_at: '2026-01-02T03:04:00Z',
    }),
  );
  await api.requests.update(30, { title: 'Edited' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/requests/30');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(init.body)).toEqual({ title: 'Edited' });
});

// Build a minimal request-detail backend body reusable across workflow actions.
function requestDetailBody(status: string) {
  return {
    id: 40,
    title: 'WF',
    status,
    requester: { id: 1, username: 'bob' },
    note: '',
    created_at: '2026-01-02T03:04:00Z',
    submitted_at: '2026-01-02T03:05:00Z',
    updated_at: '2026-01-02T03:06:00Z',
  };
}

test('requests.submit POSTs to /submit (no body) and normalizes the result', async () => {
  fetchMock.mockResolvedValueOnce(response(requestDetailBody('pending_approval')));
  const out = await api.requests.submit(40);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/requests/40/submit');
  expect(init.method).toBe('POST');
  expect(init.body).toBeUndefined();
  expect(out.status).toBe('submitted');
});

test('requests.approve POSTs to /approve', async () => {
  fetchMock.mockResolvedValueOnce(response(requestDetailBody('approved')));
  const out = await api.requests.approve(40);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/requests/40/approve');
  expect(out.status).toBe('in_progress');
});

test('requests.returnRequest POSTs comment to /return', async () => {
  fetchMock.mockResolvedValueOnce(response(requestDetailBody('returned')));
  const out = await api.requests.returnRequest(40, 'fix this');

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/requests/40/return');
  expect(JSON.parse(init.body)).toEqual({ comment: 'fix this' });
  expect(out.status).toBe('returned');
});

test('requests.reject POSTs comment to /reject', async () => {
  fetchMock.mockResolvedValueOnce(response(requestDetailBody('rejected')));
  const out = await api.requests.reject(40, 'no');

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/requests/40/reject');
  expect(JSON.parse(init.body)).toEqual({ comment: 'no' });
  expect(out.status).toBe('rejected');
});

test('requests.ship POSTs to /ship', async () => {
  fetchMock.mockResolvedValueOnce(response(requestDetailBody('sample_shipped')));
  const out = await api.requests.ship(40);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/requests/40/ship');
  expect(out.status).toBe('in_progress'); // sample_shipped -> in_progress
});

test('requests.cancel POSTs reason to /cancel', async () => {
  fetchMock.mockResolvedValueOnce(response(requestDetailBody('cancelled')));
  const out = await api.requests.cancel(40, 'changed mind');

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/requests/40/cancel');
  expect(JSON.parse(init.body)).toEqual({ reason: 'changed mind' });
  expect(out.status).toBe('cancelled');
});

test('requests.close POSTs to /close', async () => {
  fetchMock.mockResolvedValueOnce(response(requestDetailBody('closed')));
  const out = await api.requests.close(40);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/requests/40/close');
  expect(out.status).toBe('completed'); // closed -> completed
});

test('requests.deleteDraft issues DELETE on the id URL', async () => {
  fetchMock.mockResolvedValueOnce(response(null, { status: 204, contentType: '' }));
  const out = await api.requests.deleteDraft(40);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/requests/40');
  expect(init.method).toBe('DELETE');
  expect(out).toBeUndefined();
});

// ---------------------------------------------------------------------------
// samples
// ---------------------------------------------------------------------------

test('samples.list maps created -> incoming and derives in_wip when received + has_wip', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        id: 1,
        wafer_id: 'W1',
        wafer_size: '8in',
        status: 'created',
        request_id: 5,
        has_wip: false,
        received_at: null,
        created_at: '2026-01-02T03:04:00Z',
      },
      {
        id: 2,
        wafer_id: 'W2',
        wafer_size: '6in',
        status: 'received',
        request: { id: 6, title: 'R6' },
        has_wip: true,
        received_at: '2026-01-02T03:04:00Z',
      },
    ]),
  );
  const out = await api.samples.list({ status: 'created' });

  expect(fetchMock.mock.calls[0][0]).toContain('/samples?');
  expect(out[0].status).toBe('incoming'); // created -> incoming
  expect(out[0].requestId).toBe(5);
  expect(out[0].hasWip).toBe(false);
  expect(out[1].status).toBe('in_wip'); // received + has_wip
  expect(out[1].requestId).toBe(6);
  expect(out[1].requestTitle).toBe('R6');
});

test('samples.get returns a single normalized row', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 3, wafer_id: 'W3', wafer_size: '8in', status: 'processing' }),
  );
  const out = await api.samples.get(3);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/samples/3');
  expect(out.status).toBe('processing');
  expect(out.wafer).toBe('W3');
});

test('samples.getExperiments normalizes the rollup rows', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        experiment_type: { id: 9, name: 'Etch' },
        status: 'completed',
        verdict: 'pass',
        dispatch_id: 50,
        result: { id: 70, comment: 'good', created_at: '2026-01-02T03:04:00Z' },
      },
      { status: 'pending' },
    ]),
  );
  const out = await api.samples.getExperiments(3);

  expect(fetchMock.mock.calls[0][0]).toBe('/api/samples/3/experiments');
  expect(out[0]).toMatchObject({
    experimentTypeId: 9,
    experimentName: 'Etch',
    status: 'completed',
    verdict: 'pass',
    dispatchId: 50,
  });
  expect(out[0].result).toMatchObject({ id: 70, comment: 'good' });
  expect(out[1]).toMatchObject({ experimentTypeId: null, experimentName: '', result: null });
});

test('samples.receive POSTs to /receive', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 3, wafer_id: 'W3', wafer_size: '8in', status: 'received', has_wip: false }),
  );
  const out = await api.samples.receive(3);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/samples/3/receive');
  expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  expect(out.status).toBe('received');
});

test('samples.rejectReceiving POSTs reason (defaulting to empty string) to /reject-receiving', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 3, wafer_id: 'W3', wafer_size: '8in', status: 'receiving_exception' }),
  );
  const out = await api.samples.rejectReceiving(3);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/samples/3/reject-receiving');
  expect(JSON.parse(init.body)).toEqual({ reason: '' });
  expect(out.status).toBe('rejected'); // receiving_exception -> rejected
});

test('samples.reportLost POSTs to /report-lost and maps lost -> rejected', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 3, wafer_id: 'W3', wafer_size: '8in', status: 'lost' }),
  );
  const out = await api.samples.reportLost(3);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/samples/3/report-lost');
  expect(out.status).toBe('rejected');
});

test('samples.void POSTs to /void and maps voided -> cancelled', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 3, wafer_id: 'W3', wafer_size: '8in', status: 'voided' }),
  );
  const out = await api.samples.void(3);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/samples/3/void');
  expect(out.status).toBe('cancelled');
});

test('samples.return POSTs to /return and maps returned -> returned', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ id: 3, wafer_id: 'W3', wafer_size: '8in', status: 'returned' }),
  );
  const out = await api.samples.return(3);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/samples/3/return');
  expect(out.status).toBe('returned');
});

// ---------------------------------------------------------------------------
// wips
// ---------------------------------------------------------------------------

test('wips.list formats WIP code and normalizes nested samples/dispatches', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        id: 1,
        experiment_type_id: 9,
        experiment_type_name: 'Etch',
        status: 'active',
        note: 'n',
        created_at: '2026-01-02T03:04:00Z',
        updated_at: '2026-01-02T03:05:00Z',
        completed_at: null,
        samples: [{ id: 100, wafer_id: 'W1', wafer_size: '8in', status: 'processing', request_id: 5 }],
        dispatches: [
          {
            id: 7,
            experiment_type_id: 9,
            equipment_id: 2,
            recipe_id: 3,
            status: 'result_recorded',
            dispatched_at: null,
            completed_at: null,
            created_at: '2026-01-02T03:04:00Z',
            estimated_duration_seconds: null,
          },
        ],
      },
    ]),
  );
  const out = await api.wips.list();

  expect(fetchMock.mock.calls[0][0]).toContain('/wips?');
  const wip = out[0];
  expect(wip.code).toBe('WIP-0001');
  expect(wip.experimentId).toBe(9);
  expect(wip.experimentName).toBe('Etch');
  expect(wip.sampleCount).toBe(1); // derived from samples length
  expect(wip.dispatchCount).toBe(1); // derived from dispatches length
  expect(wip.samples[0]).toMatchObject({ wafer: 'W1', status: 'processing', raw_status: 'processing' });
  expect(wip.dispatches[0].code).toBe('DP-0007');
  expect(wip.dispatches[0].status).toBe('completed'); // result_recorded -> completed
});

test('wips.get uses explicit sample_count/dispatch_count when present', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 42,
      experiment_type_id: 9,
      experiment_type_name: 'Etch',
      status: 'active',
      note: '',
      created_at: '2026-01-02T03:04:00Z',
      updated_at: '2026-01-02T03:05:00Z',
      completed_at: null,
      sample_count: 5,
      dispatch_count: 3,
    }),
  );
  const out = await api.wips.get(42);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/wips/42');
  expect(out.code).toBe('WIP-0042');
  expect(out.sampleCount).toBe(5);
  expect(out.dispatchCount).toBe(3);
  expect(out.samples).toEqual([]);
  expect(out.dispatches).toEqual([]);
});

test('wips.create POSTs snake_case body to trailing-slash URL', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 1,
      experiment_type_id: 9,
      experiment_type_name: 'Etch',
      status: 'active',
      note: 'hi',
      created_at: '2026-01-02T03:04:00Z',
      updated_at: '2026-01-02T03:05:00Z',
      completed_at: null,
    }),
  );
  await api.wips.create({ experimentTypeId: 9, sampleIds: [100, 101], note: 'hi' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/wips/');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({
    experiment_type_id: 9,
    sample_ids: [100, 101],
    note: 'hi',
  });
});

test('wips.createDispatch includes estimated_duration_seconds only when provided', async () => {
  const wipBody: Record<string, unknown> = {
    id: 1,
    experiment_type_id: 9,
    experiment_type_name: 'Etch',
    status: 'active',
    note: '',
    created_at: '2026-01-02T03:04:00Z',
    updated_at: '2026-01-02T03:05:00Z',
    completed_at: null,
  };
  fetchMock.mockResolvedValueOnce(response(wipBody));
  await api.wips.createDispatch(1, { equipmentId: 2, recipeId: 3, estimatedDurationSeconds: 600 });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/wips/1/dispatches/');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({
    equipment_id: 2,
    recipe_id: 3,
    note: '',
    estimated_duration_seconds: 600,
  });

  // omitted / empty-string estimate -> field excluded
  fetchMock.mockResolvedValueOnce(response(wipBody));
  await api.wips.createDispatch(1, { equipmentId: 2, recipeId: 3, estimatedDurationSeconds: '' });
  const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(body2).not.toHaveProperty('estimated_duration_seconds');
});

test('wips.complete and wips.abort POST to their action URLs', async () => {
  const wipBody = {
    id: 1,
    experiment_type_id: 9,
    experiment_type_name: 'Etch',
    status: 'completed',
    note: '',
    created_at: '2026-01-02T03:04:00Z',
    updated_at: '2026-01-02T03:05:00Z',
    completed_at: '2026-01-03T00:00:00Z',
  };
  fetchMock.mockResolvedValueOnce(response(wipBody));
  await api.wips.complete(1);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/wips/1/complete');

  fetchMock.mockResolvedValueOnce(response(wipBody));
  await api.wips.abort(1);
  expect(fetchMock.mock.calls[1][0]).toBe('/api/wips/1/abort');
});

// ---------------------------------------------------------------------------
// dispatches
// ---------------------------------------------------------------------------

test('dispatches.list formats DP code and maps status via DISPATCH_STATUS_MAP', async () => {
  fetchMock.mockResolvedValueOnce(
    response([
      {
        id: 7,
        wip_id: 1,
        experiment_type_id: 9,
        equipment_id: 2,
        recipe_id: 3,
        created_by: { id: 4, username: 'op' },
        status: 'result_recorded',
        dispatched_at: '2026-01-02T03:04:00Z',
        completed_at: null,
        created_at: '2026-01-02T03:00:00Z',
        estimated_duration_seconds: 300,
      },
    ]),
  );
  const out = await api.dispatches.list({ status: 'running' });

  expect(fetchMock.mock.calls[0][0]).toContain('/dispatches?');
  const d = out[0];
  expect(d.code).toBe('DP-0007');
  expect(d.wipId).toBe(1);
  expect(d.operator).toBe('op');
  expect(d.operatorId).toBe(4);
  expect(d.status).toBe('completed'); // result_recorded -> completed
  expect(d.raw_status).toBe('result_recorded');
  expect(d.estimatedDurationSeconds).toBe(300);
  expect(d.completedAt).toBeNull();
});

test('dispatches.get returns the full normalized dispatch (with result)', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      id: 8,
      wip_id: 1,
      experiment_type_id: 9,
      experiment_type_name: 'Etch',
      equipment_id: 2,
      equipment_name: 'PVD',
      recipe_id: 3,
      recipe_name: 'R',
      created_by: { id: 4, username: 'op', department: 'QA' },
      status: 'running',
      dispatched_at: '2026-01-02T03:04:00Z',
      completed_at: null,
      created_at: '2026-01-02T03:00:00Z',
      estimated_duration_seconds: 300,
      auto_complete_at: '2026-01-02T03:09:00Z',
      note: 'n',
      result: { id: 70, comment: 'ok', created_at: '2026-01-02T03:08:00Z' },
    }),
  );
  const out = await api.dispatches.get(8);

  expect(fetchMock.mock.calls[0][0]).toBe('/api/dispatches/8');
  expect(out.code).toBe('DP-0008');
  expect(out.equipmentName).toBe('PVD');
  expect(out.operatorDepartment).toBe('QA');
  expect(out.status).toBe('running');
  expect(out.result).toMatchObject({ id: 70, comment: 'ok' });
});

// A reusable detail body for dispatch action methods.
function dispatchDetailBody(status: string): Record<string, unknown> {
  return {
    id: 8,
    wip_id: 1,
    experiment_type_id: 9,
    equipment_id: 2,
    recipe_id: 3,
    status,
    dispatched_at: null,
    completed_at: null,
    created_at: '2026-01-02T03:00:00Z',
    estimated_duration_seconds: null,
    result: null,
  };
}

test('dispatches.start POSTs to /start/ (trailing slash)', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('running')));
  const out = await api.dispatches.start(8);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/dispatches/8/start/');
  expect(out.status).toBe('running');
});

test('dispatches.unload POSTs to /unload/', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('unloaded')));
  const out = await api.dispatches.unload(8);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/dispatches/8/unload/');
  expect(out.status).toBe('unloaded');
});

test('dispatches.recordResult POSTs comment to /record-result/', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('result_recorded')));
  const out = await api.dispatches.recordResult(8, { comment: 'done' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/dispatches/8/record-result/');
  expect(JSON.parse(init.body)).toEqual({ comment: 'done' });
  expect(out.status).toBe('completed'); // result_recorded -> completed
});

test('dispatches.recordResult defaults comment to empty string', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('result_recorded')));
  await api.dispatches.recordResult(8);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ comment: '' });
});

test('dispatches.autoComplete POSTs dispatch_id (numeric) to the automation endpoint', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('completed')));
  const out = await api.dispatches.autoComplete('8', { comment: 'auto' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/automation/equipment-result/');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ dispatch_id: 8, comment: 'auto' });
  expect(out.status).toBe('completed');
});

test('dispatches.complete POSTs to /complete/', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('completed')));
  const out = await api.dispatches.complete(8);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/dispatches/8/complete/');
  expect(out.status).toBe('completed');
});

test('dispatches.reportException POSTs note to /report-exception/ and maps to exception', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('execution_exception')));
  const out = await api.dispatches.reportException(8, 'boom');

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/dispatches/8/report-exception/');
  expect(JSON.parse(init.body)).toEqual({ note: 'boom' });
  expect(out.status).toBe('exception'); // execution_exception -> exception
});

test('dispatches.redispatch POSTs to /redispatch/ and maps pending_redispatch -> exception', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('pending_redispatch')));
  const out = await api.dispatches.redispatch(8);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/dispatches/8/redispatch/');
  expect(out.status).toBe('exception');
});

test('dispatches.abort POSTs to /abort/ and maps aborted -> aborted', async () => {
  fetchMock.mockResolvedValueOnce(response(dispatchDetailBody('aborted')));
  const out = await api.dispatches.abort(8);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/dispatches/8/abort/');
  expect(out.status).toBe('aborted');
});

// ---------------------------------------------------------------------------
// reports (pass query params, return raw shaped data)
// ---------------------------------------------------------------------------

test('reports.equipmentUtilization passes query params and returns the payload', async () => {
  fetchMock.mockResolvedValueOnce(response({ utilization: 0.8 }));
  const out = await api.reports.equipmentUtilization({ start: '2026-01-01', limit: 10 });

  const [url] = fetchMock.mock.calls[0];
  expect(url).toContain('/reports/equipment-utilization?');
  expect(url).toContain('start=2026-01-01');
  expect(url).toContain('limit=10');
  expect(out).toEqual({ utilization: 0.8 });
});

test('reports.dispatchResults passes query params', async () => {
  fetchMock.mockResolvedValueOnce(response({ rows: [] }));
  const out = await api.reports.dispatchResults({ status: 'completed' });
  expect(fetchMock.mock.calls[0][0]).toContain('/reports/dispatch-results?');
  expect(out).toEqual({ rows: [] });
});

test('reports.requestStatistics passes query params', async () => {
  fetchMock.mockResolvedValueOnce(response({ total: 5 }));
  const out = await api.reports.requestStatistics({ year: 2026 });
  expect(fetchMock.mock.calls[0][0]).toContain('/reports/request-statistics?');
  expect(out).toEqual({ total: 5 });
});

test('reports.trends works with default empty query', async () => {
  fetchMock.mockResolvedValueOnce(response({ series: [] }));
  const out = await api.reports.trends();
  expect(fetchMock.mock.calls[0][0]).toContain('/reports/trends?');
  expect(out).toEqual({ series: [] });
});

// ---------------------------------------------------------------------------
// LIMS_STATUS_MAPS (exported const)
// ---------------------------------------------------------------------------

test('LIMS_STATUS_MAPS exposes the status maps with expected mappings', () => {
  expect(LIMS_STATUS_MAPS.request.pending_approval).toBe('submitted');
  expect(LIMS_STATUS_MAPS.request.closed).toBe('completed');
  expect(LIMS_STATUS_MAPS.sample.created).toBe('incoming');
  expect(LIMS_STATUS_MAPS.dispatch.result_recorded).toBe('completed');
  expect(LIMS_STATUS_MAPS.equipment.available).toBe('idle');
  expect(LIMS_STATUS_MAPS.role.lab_staff).toBe('lab_member');
});
