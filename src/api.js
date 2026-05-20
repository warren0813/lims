// LIMS API client — single source of truth for HTTP calls to the Django backend.
//
// Mounted on window.api. Every UI module that needs server data should go
// through this object so that auth, error handling, and status-enum mapping
// live in exactly one place.
//
// The base URL is configurable via window.LIMS_API_BASE before the scripts
// load; falls back to the production host.

(function () {
  const DEFAULT_BASE = 'https://lims.cchuml.com/api';
  const BASE = (window.LIMS_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');

  // ---------------------------------------------------------------------------
  // Token storage. localStorage works in normal hosting; for the standalone
  // single-file artifact we silently downgrade to an in-memory store.
  // ---------------------------------------------------------------------------
  const memStore = {};
  let useLocalStorage = true;
  try {
    const probe = '__lims_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch (_e) {
    useLocalStorage = false;
  }
  const store = {
    get(k) {
      if (useLocalStorage) return window.localStorage.getItem(k);
      return memStore[k] || null;
    },
    set(k, v) {
      if (useLocalStorage) {
        if (v == null) window.localStorage.removeItem(k);
        else window.localStorage.setItem(k, v);
      } else {
        if (v == null) delete memStore[k];
        else memStore[k] = v;
      }
    },
    clear() {
      ['lims.access', 'lims.refresh', 'lims.user'].forEach(k => this.set(k, null));
    },
  };

  // ---------------------------------------------------------------------------
  // Status / role / shape adapters. Backend uses richer enums than the UI
  // renders — normalize at the wire boundary so component code stays clean.
  // ---------------------------------------------------------------------------

  // backend role -> frontend role (mostly for routing in shell.jsx)
  const ROLE_MAP = {
    fab_user: 'fab_user',
    lab_staff: 'lab_member',       // <-- key rename
    lab_manager: 'lab_manager',
  };
  const normalizeRole = (r) => ROLE_MAP[r] || r;

  // backend Request.status -> frontend status used by status pills.
  // 'approved' and 'sample_shipped' collapse into in_progress because the
  // current pill palette doesn't distinguish them.
  const REQUEST_STATUS_MAP = {
    draft: 'draft',
    pending_approval: 'submitted',
    approved: 'in_progress',
    sample_shipped: 'in_progress',
    in_progress: 'in_progress',
    exception: 'in_progress',
    completed: 'completed',
    closed: 'completed',
    returned: 'returned',
    rejected: 'rejected',
    cancelled: 'cancelled',
  };

  const SAMPLE_STATUS_MAP = {
    created: 'incoming',
    shipped: 'incoming',
    received: 'received',
    receiving_exception: 'rejected',
    split: 'received',
    processing_exception: 'in_wip',
    completed: 'completed',
    lost: 'rejected',
    returned: 'returned',
    voided: 'cancelled',
  };

  const DISPATCH_STATUS_MAP = {
    pending: 'pending',
    dispatched: 'dispatched',
    running: 'running',
    unloaded: 'unloaded',
    result_recorded: 'result_recorded',
    completed: 'result_recorded',
    execution_exception: 'exception',
    pending_redispatch: 'exception',
    aborted: 'aborted',
  };

  const EQUIPMENT_STATUS_MAP = {
    available: 'idle',
    maintenance: 'maintenance',
    disabled: 'maintenance',
  };

  // Display helpers — match the project's existing WIP-XXXX / DP-XXXX convention.
  const wipCode = (id) => `WIP-${String(id).padStart(4, '0')}`;
  const dispatchCode = (id) => `DP-${String(id).padStart(4, '0')}`;

  // Backend returns timestamps as ISO 8601 ("2026-05-09T08:14:00.000Z").
  // The existing JSX assumes a "YYYY-MM-DD HH:MM" string and does things like
  // `r.created.split(' ')[0]` to grab the date portion. Normalize at the wire.
  const formatTimestamp = (iso) => {
    if (!iso) return iso || null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ---------------------------------------------------------------------------
  // Request normalizers. Each turns a backend payload into the shape the
  // existing JSX expects. Keep these dumb (no business logic).
  // ---------------------------------------------------------------------------
  function normalizeRequestRow(r) {
    return {
      id: r.id,
      title: r.title,
      status: REQUEST_STATUS_MAP[r.status] || r.status,
      raw_status: r.status,                                  // keep for state-machine calls
      urgency: r.urgency || '1w',                            // backend default since §2.2
      requester: r.requester,
      note: r.note,
      created: formatTimestamp(r.created_at),
      submitted: formatTimestamp(r.submitted_at),
      updated: formatTimestamp(r.updated_at),
      // Server-annotated count on RequestListOut so list rows can show a
      // wafer count without loading each request's detail.
      sampleCount: r.sample_count ?? 0,
      // these are filled in by the detail endpoint
      expIds: [],
      samples: [],
      history: [],
    };
  }

  function normalizeRequestDetail(r) {
    return {
      ...normalizeRequestRow(r),
      expIds: (r.experiment_types || []).map(et => et.id),
      experiment_types: r.experiment_types || [],
      samples: (r.samples || []).map(s => ({
        id: s.id,
        wafer: s.wafer_id,
        size: s.wafer_size,
        status: SAMPLE_STATUS_MAP[s.status] || s.status,
        raw_status: s.status,
      })),
      history: (r.approval_logs || []).map(log => ({
        action: log.action.toUpperCase(),
        by: log.reviewer?.username,
        at: formatTimestamp(log.created_at),
        note: log.comment || '',
      })),
      completed_at: formatTimestamp(r.completed_at),
      closed_at: formatTimestamp(r.closed_at),
    };
  }

  function normalizeSampleRow(s) {
    // Backend has no `in_wip` status — gap §3.2 calls for the adapter to
    // derive it. `has_wip` is now annotated on SampleListOut/DetailOut, so
    // a received sample that's been pulled into a non-terminal WIP renders
    // as `in_wip` to the rest of the UI. Anything not currently `received`
    // (split, processing_exception, completed, etc.) keeps its mapped value.
    const mapped = SAMPLE_STATUS_MAP[s.status] || s.status;
    const hasWip = s.has_wip ?? false;
    const status = (mapped === 'received' && hasWip) ? 'in_wip' : mapped;
    return {
      id: s.id,
      wafer: s.wafer_id,
      size: s.wafer_size,
      requestId: s.request_id,
      status,
      raw_status: s.status,
      hasWip,
      // received_at is set when the lab confirms receipt (backend §2.5).
      // Until that transition fires it'll be null — countdowns in the UI
      // should treat null as "not yet started" rather than "0 time left".
      receivedAt: formatTimestamp(s.received_at),
      arrivedAt: formatTimestamp(s.received_at),    // alias kept for existing JSX
      created: formatTimestamp(s.created_at),
    };
  }

  function normalizeWip(w) {
    // WIPListOut surfaces sample_count; WIPDetailOut surfaces the samples
    // list inline. Handle both shapes here so callers don't have to care.
    const samples = (w.samples || []).map(s => ({
      id: s.id,
      wafer: s.wafer_id,
      size: s.wafer_size,
      status: SAMPLE_STATUS_MAP[s.status] || s.status,
      raw_status: s.status,
      requestId: s.request_id,
    }));
    return {
      id: w.id,
      code: wipCode(w.id),
      experimentId: w.experiment_type_id,
      experimentName: w.experiment_type_name,
      // WIPListOut → sample_count; WIPDetailOut → derive from samples list
      sampleCount: typeof w.sample_count === 'number' ? w.sample_count : samples.length,
      // WIPListOut → dispatch_count (just added on the backend);
      // WIPDetailOut → derive from the inline dispatches array.
      dispatchCount: typeof w.dispatch_count === 'number'
        ? w.dispatch_count
        : (w.dispatches || []).length,
      samples,           // empty array on list responses; populated on detail
      status: w.status,
      note: w.note,
      created: formatTimestamp(w.created_at),
      updated: formatTimestamp(w.updated_at),
      completed: formatTimestamp(w.completed_at),
      // Nested dispatches (WIPDetailOut.dispatches) go through normalizeDispatch
      // which surfaces equipmentId/equipmentName from the newly-added
      // DispatchBriefOut.equipment_{id,name} fields.
      dispatches: (w.dispatches || []).map(normalizeDispatch),
    };
  }

  function normalizeDispatch(d) {
    return {
      id: d.id,
      code: dispatchCode(d.id),
      wipId: d.wip_id,
      experimentId: d.experiment_type_id,
      experimentName: d.experiment_type_name,
      equipmentId: d.equipment_id,
      equipmentName: d.equipment_name,
      recipeId: d.recipe_id,
      recipeName: d.recipe_name,
      operator: d.created_by?.username || null,    // exposed by backend §2.6
      operatorId: d.created_by?.id || null,
      operatorDepartment: d.created_by?.department || null,
      status: DISPATCH_STATUS_MAP[d.status] || d.status,
      raw_status: d.status,
      dispatchedAt: formatTimestamp(d.dispatched_at),
      // Raw ISO timestamp kept alongside the formatted "YYYY-MM-DD HH:MM"
      // value because the formatted form truncates to minute precision and
      // breaks the dispatch countdown bar on short estimates (e.g. the 20s
      // demo). Anyone doing elapsed math should read this one.
      dispatchedAtIso: d.dispatched_at ?? null,
      completedAt: formatTimestamp(d.completed_at),
      completedAtIso: d.completed_at ?? null,
      created: formatTimestamp(d.created_at),
      estimatedDurationSeconds: d.estimated_duration_seconds ?? null,
      result: d.result ? {
        summary: d.result.summary,
        verdict: d.result.verdict,
        data: d.result.data,
        source: d.result.data_source,
      } : null,
    };
  }

  function normalizeEquipment(e) {
    return {
      id: e.id,
      name: e.name,
      model: e.model_name,
      capacity: e.capacity,
      status: EQUIPMENT_STATUS_MAP[e.status] || e.status,
      raw_status: e.status,
      capabilities: e.capabilities || [],
      // Admin-defined schema of dispatch parameters this equipment exposes
      // (backend §2.4). Shape is open-ended; the UI walks the object to
      // render input fields.
      parameters: e.parameters || {},
    };
  }

  function normalizeRecipe(r) {
    // Recipe.equipment was dropped entirely in the chat-design restoration
    // (backend §2.3). Recipes belong to an experiment_type only now.
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      experimentId: r.experiment_type?.id || null,
      experimentName: r.experiment_type?.name || null,
      params: r.parameters || {},
      active: r.is_active,
    };
  }

  // ---------------------------------------------------------------------------
  // Core fetch with auth + 401 refresh-once retry.
  // ---------------------------------------------------------------------------
  let refreshInflight = null;

  async function rawFetch(path, opts) {
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const access = store.get('lims.access');
    const headers = Object.assign(
      { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      access ? { 'Authorization': `Bearer ${access}` } : {},
      (opts && opts.headers) || {}
    );
    const init = Object.assign({}, opts || {}, { headers });
    if (init.body && typeof init.body !== 'string') {
      init.body = JSON.stringify(init.body);
    }
    return fetch(url, init);
  }

  async function call(path, opts) {
    let res = await rawFetch(path, opts);
    if (res.status === 401 && store.get('lims.refresh') && path !== '/auth/refresh') {
      // Single concurrent refresh; subsequent callers await the same promise.
      if (!refreshInflight) refreshInflight = doRefresh();
      const refreshed = await refreshInflight;
      refreshInflight = null;
      if (refreshed) {
        res = await rawFetch(path, opts);
      }
    }
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        // Ninja/Pydantic validation errors come back as { detail: [...] };
        // unwrap to a readable string so the UI banner doesn't render
        // "[object Object]". Single-message detail strings pass through.
        if (body && body.detail) {
          if (typeof body.detail === 'string') {
            detail = body.detail;
          } else if (Array.isArray(body.detail)) {
            detail = body.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
          } else {
            detail = JSON.stringify(body.detail);
          }
        }
      } catch (_e) { /* non-json error */ }
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  async function doRefresh() {
    const refresh = store.get('lims.refresh');
    if (!refresh) return false;
    try {
      const out = await rawFetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refresh }),
      }).then(r => r.ok ? r.json() : Promise.reject());
      store.set('lims.access', out.access_token);
      store.set('lims.refresh', out.refresh_token);
      return true;
    } catch (_e) {
      store.clear();
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  const api = {
    base: BASE,

    auth: {
      async login(username, password) {
        const out = await call('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        store.set('lims.access', out.access_token);
        store.set('lims.refresh', out.refresh_token);
        const user = {
          id: out.id,
          username: out.username,
          role: normalizeRole(out.role),
          raw_role: out.role,
          department: out.department,
        };
        store.set('lims.user', JSON.stringify(user));
        return user;
      },
      async logout() {
        const refresh = store.get('lims.refresh');
        try {
          if (refresh) await call('/auth/logout', { method: 'POST', body: { refresh_token: refresh } });
        } catch (_e) { /* don't care */ }
        store.clear();
      },
      async me() {
        const out = await call('/auth/me');
        return {
          id: out.id,
          username: out.username,
          role: normalizeRole(out.role),
          raw_role: out.role,
          department: out.department,
        };
      },
      cachedUser() {
        try {
          const raw = store.get('lims.user');
          return raw ? JSON.parse(raw) : null;
        } catch (_e) {
          return null;
        }
      },
    },

    experimentTypes: {
      async list(q = {}) {
        const usp = new URLSearchParams(q);
        const out = await call(`/experiment-types/?${usp}`);
        return out.map(e => ({ id: e.id, name: e.name, description: e.description, labCategory: e.lab_category }));
      },
    },

    equipment: {
      async list(q = {}) {
        const usp = new URLSearchParams(q);
        const out = await call(`/equipment/?${usp}`);
        return out.map(normalizeEquipment);
      },
      async create({ name, modelName, capacity, status, experimentTypeIds = [], parameters = {} }) {
        const body = {
          name, model_name: modelName, capacity,
          experiment_type_ids: experimentTypeIds,
          parameters,
        };
        if (status !== undefined) body.status = status;
        const out = await call('/equipment/', { method: 'POST', body });
        return normalizeEquipment(out);
      },
      async update(id, { name, modelName, capacity, status, parameters }) {
        // `EquipmentUpdate` accepts name/model_name/capacity/status/parameters
        // — capabilities go through the dedicated endpoint below.
        const body = {};
        if (name !== undefined) body.name = name;
        if (modelName !== undefined) body.model_name = modelName;
        if (capacity !== undefined) body.capacity = capacity;
        if (status !== undefined) body.status = status;
        if (parameters !== undefined) body.parameters = parameters;
        const out = await call(`/equipment/${id}`, { method: 'PATCH', body });
        return normalizeEquipment(out);
      },
      async setCapabilities(id, experimentTypeIds) {
        const out = await call(`/equipment/${id}/capabilities`, {
          method: 'POST', body: { experiment_type_ids: experimentTypeIds },
        });
        return normalizeEquipment(out);
      },
    },

    recipes: {
      async list(q = {}) {
        const usp = new URLSearchParams(q);
        const out = await call(`/recipes/?${usp}`);
        return out.map(normalizeRecipe);
      },
      async create({ name, description = '', experimentTypeId, parameters = {} }) {
        // camelCase in, snake_case to the backend. Recipe.equipment was
        // dropped entirely — see backend §2.3.
        const out = await call('/recipes/', {
          method: 'POST',
          body: {
            name,
            description,
            experiment_type_id: experimentTypeId,
            parameters,
          },
        });
        return normalizeRecipe(out);
      },
      async update(id, { name, description, parameters }) {
        // RecipeUpdate accepts name/description/parameters only — backend
        // intentionally locks experiment_type after creation.
        const body = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (parameters !== undefined) body.parameters = parameters;
        const out = await call(`/recipes/${id}`, { method: 'PATCH', body });
        return normalizeRecipe(out);
      },
      async remove(id) {
        await call(`/recipes/${id}`, { method: 'DELETE' });
        return null;
      },
    },

    requests: {
      async list(q = {}) {
        const usp = new URLSearchParams(q);
        const out = await call(`/requests/?${usp}`);
        return out.map(normalizeRequestRow);
      },
      async get(id) {
        const out = await call(`/requests/${id}`);
        return normalizeRequestDetail(out);
      },
      async create(payload) {
        // payload = { title, note?, urgency?, experiment_type_ids,
        //             experiment_parameters?, samples }
        // urgency: '3d' | '1w' | '2w' (default '1w' server-side, backend §2.2)
        const out = await call('/requests/', { method: 'POST', body: payload });
        return normalizeRequestDetail(out);
      },
      async update(id, payload) {
        const out = await call(`/requests/${id}`, { method: 'PATCH', body: payload });
        return normalizeRequestDetail(out);
      },
      async submit(id) {
        return normalizeRequestDetail(await call(`/requests/${id}/submit`, { method: 'POST' }));
      },
      async approve(id) {
        return normalizeRequestDetail(await call(`/requests/${id}/approve`, { method: 'POST' }));
      },
      async returnRequest(id, comment) {
        return normalizeRequestDetail(await call(`/requests/${id}/return`, {
          method: 'POST', body: { comment },
        }));
      },
      async reject(id, comment) {
        return normalizeRequestDetail(await call(`/requests/${id}/reject`, {
          method: 'POST', body: { comment },
        }));
      },
      async ship(id) {
        return normalizeRequestDetail(await call(`/requests/${id}/ship`, { method: 'POST' }));
      },
      async cancel(id, reason) {
        return normalizeRequestDetail(await call(`/requests/${id}/cancel`, {
          method: 'POST', body: { reason },
        }));
      },
      async close(id) {
        return normalizeRequestDetail(await call(`/requests/${id}/close`, { method: 'POST' }));
      },
    },

    samples: {
      async list(q = {}) {
        const usp = new URLSearchParams(q);
        const out = await call(`/samples/?${usp}`);
        return out.map(normalizeSampleRow);
      },
      async get(id) {
        return normalizeSampleRow(await call(`/samples/${id}`));
      },
      async receive(id) {
        return normalizeSampleRow(await call(`/samples/${id}/receive`, { method: 'POST' }));
      },
      async rejectReceiving(id, reason = '') {
        return normalizeSampleRow(await call(`/samples/${id}/reject-receiving`, {
          method: 'POST', body: { reason },
        }));
      },
      async reportLost(id) {
        return normalizeSampleRow(await call(`/samples/${id}/report-lost`, { method: 'POST' }));
      },
      async void(id) {
        return normalizeSampleRow(await call(`/samples/${id}/void`, { method: 'POST' }));
      },
      async return(id) {
        return normalizeSampleRow(await call(`/samples/${id}/return`, { method: 'POST' }));
      },
    },

    wips: {
      async list(q = {}) {
        const usp = new URLSearchParams(q);
        const out = await call(`/wips/?${usp}`);
        // WIPListOut now carries experiment_type_id/name + sample_count.
        // Reuse normalizeWip so list rows and detail share the same shape
        // (samples will be [] on list responses; check sampleCount instead).
        return out.map(normalizeWip);
      },
      async get(id) {
        return normalizeWip(await call(`/wips/${id}/`));
      },
      async create({ experimentTypeId, sampleIds, note = '' }) {
        // payload = { experiment_type_id, sample_ids: list[int], note }
        // WIP picks experiment + a batch of samples that all need it.
        return normalizeWip(await call('/wips/', {
          method: 'POST',
          body: {
            experiment_type_id: experimentTypeId,
            sample_ids: sampleIds,
            note,
          },
        }));
      },
      async createDispatch(wipId, { equipmentId, recipeId, estimatedDurationSeconds, note = '' }) {
        // payload = { equipment_id, recipe_id, estimated_duration_seconds?, note? }
        // experiment_type is derived server-side from the parent WIP.
        const body = { equipment_id: equipmentId, recipe_id: recipeId, note };
        if (estimatedDurationSeconds != null && estimatedDurationSeconds !== '') {
          body.estimated_duration_seconds = estimatedDurationSeconds;
        }
        return normalizeWip(await call(`/wips/${wipId}/dispatches/`, {
          method: 'POST',
          body,
        }));
      },
      async complete(id) {
        return normalizeWip(await call(`/wips/${id}/complete/`, { method: 'POST' }));
      },
      async abort(id) {
        return normalizeWip(await call(`/wips/${id}/abort/`, { method: 'POST' }));
      },
    },

    dispatches: {
      async list(q = {}) {
        const usp = new URLSearchParams(q);
        const out = await call(`/dispatches/?${usp}`);
        return out.map(d => ({
          id: d.id,
          code: dispatchCode(d.id),
          wipId: d.wip_id,
          experimentId: d.experiment_type_id,
          equipmentId: d.equipment_id,
          recipeId: d.recipe_id,
          operator: d.created_by?.username || null,       // backend §2.6
          operatorId: d.created_by?.id || null,
          status: DISPATCH_STATUS_MAP[d.status] || d.status,
          raw_status: d.status,
          dispatchedAt: formatTimestamp(d.dispatched_at),
          dispatchedAtIso: d.dispatched_at ?? null,
          completedAt: formatTimestamp(d.completed_at),
          completedAtIso: d.completed_at ?? null,
          created: formatTimestamp(d.created_at),
          estimatedDurationSeconds: d.estimated_duration_seconds ?? null,
        }));
      },
      async get(id) {
        return normalizeDispatch(await call(`/dispatches/${id}/`));
      },
      async start(id) {
        return normalizeDispatch(await call(`/dispatches/${id}/start/`, { method: 'POST' }));
      },
      async unload(id) {
        return normalizeDispatch(await call(`/dispatches/${id}/unload/`, { method: 'POST' }));
      },
      async recordResult(id, payload) {
        // payload = { summary, verdict: 'pass'|'fail', data?, note? }
        // Backend `ExperimentResultIn.data` is a dict — accept either an
        // object or a JSON string from callers (the existing form UI emits
        // a raw JSON string), and coerce to an object before POSTing.
        let normalized = payload;
        if (payload && typeof payload.data === 'string') {
          let parsed = {};
          try { parsed = payload.data.trim() ? JSON.parse(payload.data) : {}; }
          catch (_e) {
            const err = new Error('Result data must be valid JSON.');
            err.status = 400;
            throw err;
          }
          normalized = { ...payload, data: parsed };
        }
        return normalizeDispatch(await call(`/dispatches/${id}/record-result/`, {
          method: 'POST', body: normalized,
        }));
      },
      async complete(id) {
        return normalizeDispatch(await call(`/dispatches/${id}/complete/`, { method: 'POST' }));
      },
      async reportException(id, note = '') {
        return normalizeDispatch(await call(`/dispatches/${id}/report-exception/`, {
          method: 'POST', body: { note },
        }));
      },
      async redispatch(id) {
        return normalizeDispatch(await call(`/dispatches/${id}/redispatch/`, { method: 'POST' }));
      },
      async abort(id) {
        return normalizeDispatch(await call(`/dispatches/${id}/abort/`, { method: 'POST' }));
      },
    },

    reports: {
      async equipmentUtilization(q) {
        // q = { period, start_date, end_date, equipment_id? }
        const usp = new URLSearchParams(q);
        return call(`/reports/equipment-utilization?${usp}`);
      },
      async requestStatistics(q) {
        const usp = new URLSearchParams(q);
        return call(`/reports/request-statistics?${usp}`);
      },
      async trends(q = {}) {
        // q = { metric: 'requests_per_day', days: 30 }
        const usp = new URLSearchParams(q);
        return call(`/reports/trends?${usp}`);
      },
    },
  };

  window.api = api;
  window.LIMS_STATUS_MAPS = {
    request: REQUEST_STATUS_MAP,
    sample: SAMPLE_STATUS_MAP,
    dispatch: DISPATCH_STATUS_MAP,
    equipment: EQUIPMENT_STATUS_MAP,
    role: ROLE_MAP,
  };
})();
