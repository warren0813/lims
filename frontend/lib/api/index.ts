'use client';

import type { components } from './types.gen';
import type { User } from '../types';

declare global {
  interface Window {
    LIMS_API_BASE?: string;
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type RequestOpts = { method?: string; body?: unknown; headers?: Record<string, string> };

// Backend response shapes, auto-generated from the Django Ninja OpenAPI
// spec via `npm run gen:types`. Regenerate after backend schema changes
// with `uv run python manage.py export_openapi` then `npm run gen:types`.
type Schemas = components['schemas'];

// Each normalize function below is called with several different backend
// response variants (List vs Detail vs Brief). The Input types below
// describe the union of fields the function reads — properties present
// only on some variants are marked optional, and the function bodies use
// `||` / `??` to fall back when they're missing. Where a field's runtime
// type is itself a generated schema we reference it via `Schemas[X]` so
// regenerating the spec keeps these in lock-step.

type RequestRowInput = {
  id: number;
  title: string;
  status: string;
  urgency?: string;
  requester: Schemas['RequesterOut'];
  note: string;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
  sample_count?: number;
  experiment_types?: Schemas['ExperimentTypeWithParamsOut'][];
};

type RequestDetailInput = Schemas['RequestDetailOut'];

type SampleExperimentsInput = Schemas['SampleExperimentRollupOut'][] | null | undefined;

type SampleRowInput = {
  id: number;
  wafer_id: string;
  wafer_size: string;
  status: string;
  request_id?: number;
  request?: Schemas['RequestSummaryOut'];
  has_wip?: boolean;
  received_at?: string | null;
  created_at?: string;
};

type WipInput = {
  id: number;
  experiment_type_id: number;
  experiment_type_name: string;
  status: string;
  note: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  sample_count?: number;
  dispatch_count?: number;
  samples?: Schemas['SampleBriefOut'][];
  dispatches?: Schemas['DispatchBriefOut'][];
};

type DispatchInput = {
  id: number;
  experiment_type_id: number;
  experiment_type_name?: string;
  equipment_id: number;
  equipment_name?: string;
  recipe_id: number;
  recipe_name?: string;
  status: string;
  dispatched_at: string | null;
  completed_at: string | null;
  created_at: string;
  estimated_duration_seconds: number | null;
  auto_complete_at?: string | null;
  wip_id?: number;
  note?: string;
  result?: Schemas['ExperimentResultOut'] | null;
  created_by?: Schemas['RequesterOut'] | null;
};

type EquipmentInput = Schemas['EquipmentOut'];
type RecipeInput = Schemas['RecipeOut'];

// Shapes for the normalized rows that normalizeRequestRow returns as
// placeholders (overwritten by normalizeRequestDetail's spread).
type NormalizedSampleBrief = {
  id: number;
  wafer: string;
  size: string;
  status: string;
  raw_status: string;
};

type NormalizedApprovalLog = {
  action: string;
  by: string | undefined;
  at: string | null;
  note: string;
};

const DEFAULT_BASE = '/api';
const BASE = ((typeof window !== 'undefined' && window.LIMS_API_BASE) || DEFAULT_BASE).replace(
  /\/+$/,
  '',
);
const memStore: Record<string, string> = {};
let useLocalStorage = true;
try {
  const probe = '__lims_probe__';
  globalThis.localStorage.setItem(probe, '1');
  globalThis.localStorage.removeItem(probe);
} catch {
  useLocalStorage = false;
}
const store = {
  get(k: string): string | null {
    if (useLocalStorage) return globalThis.localStorage.getItem(k);
    return memStore[k] || null;
  },
  set(k: string, v: string | null): void {
    if (useLocalStorage) {
      if (v == null) globalThis.localStorage.removeItem(k);
      else globalThis.localStorage.setItem(k, v);
    } else {
      if (v == null) delete memStore[k];
      else memStore[k] = v;
    }
  },
  clear(): void {
    ['lims.access', 'lims.refresh', 'lims.user'].forEach((k) => this.set(k, null));
  },
};
const ROLE_MAP: Record<string, string> = {
  fab_user: 'fab_user',
  lab_staff: 'lab_member',
  lab_manager: 'lab_manager',
};
const normalizeRole = (r: string): string => ROLE_MAP[r] || r;
const REQUEST_STATUS_MAP: Record<string, string> = {
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
const SAMPLE_STATUS_MAP: Record<string, string> = {
  created: 'incoming',
  shipped: 'incoming',
  received: 'received',
  receiving_exception: 'rejected',
  split: 'received',
  processing: 'processing',
  processing_exception: 'rejected',
  completed: 'completed',
  lost: 'rejected',
  returned: 'returned',
  voided: 'cancelled',
};
const DISPATCH_STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  dispatched: 'dispatched',
  running: 'running',
  unloaded: 'unloaded',
  result_recorded: 'completed',
  completed: 'completed',
  execution_exception: 'exception',
  pending_redispatch: 'exception',
  aborted: 'aborted',
};
const EQUIPMENT_STATUS_MAP: Record<string, string> = {
  available: 'idle',
  maintenance: 'maintenance',
  disabled: 'maintenance',
};
const wipCode = (id: number | string) => `WIP-${String(id).padStart(4, '0')}`;
const dispatchCode = (id: number | string) => `DP-${String(id).padStart(4, '0')}`;
const formatTimestamp = (iso: string | null | undefined): string | null => {
  if (!iso) return iso || null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function normalizeRequestRow(r: RequestRowInput) {
  return {
    id: r.id,
    title: r.title,
    status: REQUEST_STATUS_MAP[r.status] || r.status,
    rawStatus: r.status,
    raw_status: r.status,
    urgency: r.urgency || '1w',
    requester: r.requester,
    note: r.note,
    created: formatTimestamp(r.created_at),
    submitted: formatTimestamp(r.submitted_at),
    updated: formatTimestamp(r.updated_at),
    sampleCount: r.sample_count ?? 0,
    expIds: (r.experiment_types || []).map((et) => et.id),
    experiment_types: r.experiment_types || [],
    samples: [] as NormalizedSampleBrief[],
    history: [] as NormalizedApprovalLog[],
  };
}
function normalizeRequestDetail(r: RequestDetailInput) {
  return {
    ...normalizeRequestRow(r),
    expIds: (r.experiment_types || []).map((et) => et.id),
    experiment_types: r.experiment_types || [],
    samples: (r.samples || []).map((s) => ({
      id: s.id,
      wafer: s.wafer_id,
      size: s.wafer_size,
      status: SAMPLE_STATUS_MAP[s.status] || s.status,
      raw_status: s.status,
      expIds: s.experiment_type_ids || [],
    })),
    history: (r.approval_logs || []).map((log) => ({
      action: log.action.toUpperCase(),
      by: log.reviewer?.username,
      at: formatTimestamp(log.created_at),
      note: log.comment || '',
    })),
    completed_at: formatTimestamp(r.completed_at),
    closed_at: formatTimestamp(r.closed_at),
  };
}
function normalizeSampleExperiments(rows: SampleExperimentsInput) {
  return (rows || []).map((r) => ({
    experimentTypeId: r.experiment_type?.id ?? null,
    experimentName: r.experiment_type?.name ?? '',
    status: r.status,
    verdict: r.verdict ?? null,
    dispatchId: r.dispatch_id ?? null,
    result: r.result
      ? {
          id: r.result.id,
          comment: r.result.comment ?? '',
          recordedAt: formatTimestamp(r.result.created_at),
        }
      : null,
  }));
}
function normalizeSampleRow(s: SampleRowInput) {
  const mapped = SAMPLE_STATUS_MAP[s.status] || s.status;
  const hasWip = s.has_wip ?? false;
  const status = mapped === 'received' && hasWip ? 'in_wip' : mapped;
  return {
    id: s.id,
    wafer: s.wafer_id,
    size: s.wafer_size,
    requestId: s.request_id ?? s.request?.id ?? null,
    requestTitle: s.request?.title ?? null,
    status,
    raw_status: s.status,
    hasWip,
    receivedAt: formatTimestamp(s.received_at),
    arrivedAt: formatTimestamp(s.received_at),
    created: formatTimestamp(s.created_at),
  };
}
function normalizeWip(w: WipInput) {
  const samples = (w.samples || []).map((s) => ({
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
    sampleCount: typeof w.sample_count === 'number' ? w.sample_count : samples.length,
    dispatchCount:
      typeof w.dispatch_count === 'number' ? w.dispatch_count : (w.dispatches || []).length,
    samples,
    status: w.status,
    note: w.note,
    created: formatTimestamp(w.created_at),
    updated: formatTimestamp(w.updated_at),
    completed: formatTimestamp(w.completed_at),
    dispatches: (w.dispatches || []).map(normalizeDispatch),
  };
}
function normalizeDispatch(d: DispatchInput) {
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
    operator: d.created_by?.username || null,
    operatorId: d.created_by?.id || null,
    operatorDepartment: d.created_by?.department || null,
    status: DISPATCH_STATUS_MAP[d.status] || d.status,
    raw_status: d.status,
    dispatchedAt: formatTimestamp(d.dispatched_at),
    dispatchedAtIso: d.dispatched_at ?? null,
    completedAt: formatTimestamp(d.completed_at),
    completedAtIso: d.completed_at ?? null,
    created: formatTimestamp(d.created_at),
    estimatedDurationSeconds: d.estimated_duration_seconds ?? null,
    autoCompleteAtIso: d.auto_complete_at ?? null,
    note: d.note ?? '',
    result: d.result
      ? {
          id: d.result.id,
          comment: d.result.comment ?? '',
          recordedAt: formatTimestamp(d.result.created_at),
        }
      : null,
  };
}
function normalizeEquipment(e: EquipmentInput) {
  return {
    id: e.id,
    name: e.name,
    model: e.model_name,
    capacity: e.capacity,
    status: EQUIPMENT_STATUS_MAP[e.status] || e.status,
    raw_status: e.status,
    capabilities: e.capabilities || [],
    parameters: e.parameters || {},
  };
}
function normalizeRecipe(r: RecipeInput) {
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
let refreshInflight: Promise<boolean> | null = null;
async function rawFetch(path: string, opts?: RequestOpts) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const access = store.get('lims.access');
  const headers = Object.assign(
    {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    access
      ? {
          Authorization: `Bearer ${access}`,
        }
      : {},
    (opts && opts.headers) || {},
  );
  const init = Object.assign({}, opts || {}, {
    headers,
  });
  if (init.body && typeof init.body !== 'string') {
    init.body = JSON.stringify(init.body);
  }
  return fetch(url, init as RequestInit);
}
async function call(path: string, opts?: RequestOpts) {
  let res = await rawFetch(path, opts);
  if (res.status === 401 && store.get('lims.refresh') && path !== '/auth/refresh') {
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
      if (body && body.detail) {
        if (typeof body.detail === 'string') {
          detail = body.detail;
        } else if (Array.isArray(body.detail)) {
          detail = body.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ');
        } else {
          detail = JSON.stringify(body.detail);
        }
      }
    } catch {}
    throw new ApiError(detail, res.status);
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
      body: JSON.stringify({
        refresh_token: refresh,
      }),
    }).then((r) => (r.ok ? r.json() : Promise.reject()));
    store.set('lims.access', out.access_token);
    store.set('lims.refresh', out.refresh_token);
    return true;
  } catch {
    store.clear();
    return false;
  }
}
const api = {
  base: BASE,
  auth: {
    async login(username: string, password: string): Promise<User> {
      const out: Schemas['TokenOut'] = await call('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
        }),
      });
      store.set('lims.access', out.access_token);
      store.set('lims.refresh', out.refresh_token);
      const user: User = {
        id: out.id,
        username: out.username,
        role: normalizeRole(out.role),
        raw_role: out.role,
        department: out.department,
      };
      store.set('lims.user', JSON.stringify(user));
      return user;
    },
    async logout(): Promise<void> {
      const refresh = store.get('lims.refresh');
      try {
        if (refresh)
          await call('/auth/logout', {
            method: 'POST',
            body: {
              refresh_token: refresh,
            },
          });
      } catch {}
      store.clear();
    },
    async me(): Promise<User> {
      const out: Schemas['UserOut'] = await call('/auth/me');
      return {
        id: out.id,
        username: out.username,
        role: normalizeRole(out.role),
        raw_role: out.role,
        department: out.department,
      };
    },
    cachedUser(): User | null {
      try {
        const raw = store.get('lims.user');
        return raw ? (JSON.parse(raw) as User) : null;
      } catch {
        return null;
      }
    },
  },
  experimentTypes: {
    async list(q: Record<string, string> = {}) {
      const usp = new URLSearchParams(q);
      const out = await call(`/experiment-types?${usp}`);
      return out.map((e: Schemas['ExperimentTypeOut']) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        labCategory: e.lab_category,
      }));
    },
  },
  equipment: {
    async list(q: Record<string, string> = {}) {
      const usp = new URLSearchParams(q);
      const out = await call(`/equipment?${usp}`);
      return out.map(normalizeEquipment);
    },
    async create({
      name,
      modelName,
      capacity,
      status = undefined,
      experimentTypeIds = [],
      parameters = {},
    }: {
      name: string;
      modelName: string;
      capacity: number;
      status?: string;
      experimentTypeIds?: number[];
      parameters?: Record<string, unknown>;
    }) {
      const body: Record<string, unknown> = {
        name,
        model_name: modelName,
        capacity,
        experiment_type_ids: experimentTypeIds,
        parameters,
      };
      if (status !== undefined) body.status = status;
      const out = await call('/equipment/', {
        method: 'POST',
        body,
      });
      return normalizeEquipment(out);
    },
    async update(
      id: number | string,
      {
        name,
        modelName,
        capacity,
        status,
        parameters,
      }: {
        name?: string;
        modelName?: string;
        capacity?: number;
        status?: string;
        parameters?: Record<string, unknown>;
      },
    ) {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (modelName !== undefined) body.model_name = modelName;
      if (capacity !== undefined) body.capacity = capacity;
      if (status !== undefined) body.status = status;
      if (parameters !== undefined) body.parameters = parameters;
      const out = await call(`/equipment/${id}`, {
        method: 'PATCH',
        body,
      });
      return normalizeEquipment(out);
    },
    async setCapabilities(id: number | string, experimentTypeIds: number[]) {
      const out = await call(`/equipment/${id}/capabilities`, {
        method: 'POST',
        body: {
          experiment_type_ids: experimentTypeIds,
        },
      });
      return normalizeEquipment(out);
    },
  },
  recipes: {
    async list(q: Record<string, string> = {}) {
      const usp = new URLSearchParams(q);
      const out = await call(`/recipes?${usp}`);
      return out.map(normalizeRecipe);
    },
    async create({
      name,
      description = '',
      experimentTypeId,
      parameters = {},
    }: {
      name: string;
      description?: string;
      experimentTypeId: number | string;
      parameters?: Record<string, unknown>;
    }) {
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
    async update(
      id: number | string,
      {
        name,
        description,
        parameters,
      }: { name?: string; description?: string; parameters?: Record<string, unknown> },
    ) {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (description !== undefined) body.description = description;
      if (parameters !== undefined) body.parameters = parameters;
      const out = await call(`/recipes/${id}`, {
        method: 'PATCH',
        body,
      });
      return normalizeRecipe(out);
    },
    async remove(id: number | string): Promise<null> {
      await call(`/recipes/${id}`, {
        method: 'DELETE',
      });
      return null;
    },
  },
  requests: {
    async list(q: Record<string, string> = {}) {
      const usp = new URLSearchParams(q);
      const out = await call(`/requests?${usp}`);
      return out.map(normalizeRequestRow);
    },
    async get(id: unknown) {
      const out = await call(`/requests/${id}`);
      return normalizeRequestDetail(out);
    },
    async create(payload: unknown) {
      const out = await call('/requests/', {
        method: 'POST',
        body: payload,
      });
      return normalizeRequestDetail(out);
    },
    async update(id: number | string, payload: unknown) {
      const out = await call(`/requests/${id}`, {
        method: 'PATCH',
        body: payload,
      });
      return normalizeRequestDetail(out);
    },
    async submit(id: number | string) {
      return normalizeRequestDetail(
        await call(`/requests/${id}/submit`, {
          method: 'POST',
        }),
      );
    },
    async approve(id: number | string) {
      return normalizeRequestDetail(
        await call(`/requests/${id}/approve`, {
          method: 'POST',
        }),
      );
    },
    async returnRequest(id: number | string, comment: string) {
      return normalizeRequestDetail(
        await call(`/requests/${id}/return`, {
          method: 'POST',
          body: {
            comment,
          },
        }),
      );
    },
    async reject(id: number | string, comment: string) {
      return normalizeRequestDetail(
        await call(`/requests/${id}/reject`, {
          method: 'POST',
          body: {
            comment,
          },
        }),
      );
    },
    async ship(id: number | string) {
      return normalizeRequestDetail(
        await call(`/requests/${id}/ship`, {
          method: 'POST',
        }),
      );
    },
    async cancel(id: number | string, reason: string) {
      return normalizeRequestDetail(
        await call(`/requests/${id}/cancel`, {
          method: 'POST',
          body: {
            reason,
          },
        }),
      );
    },
    async close(id: number | string) {
      return normalizeRequestDetail(
        await call(`/requests/${id}/close`, {
          method: 'POST',
        }),
      );
    },
    async deleteDraft(id: number | string) {
      await call(`/requests/${id}`, {
        method: 'DELETE',
      });
    },
  },
  samples: {
    async list(q: Record<string, string> = {}) {
      const usp = new URLSearchParams(q);
      const out = await call(`/samples?${usp}`);
      return out.map(normalizeSampleRow);
    },
    async get(id: number | string) {
      return normalizeSampleRow(await call(`/samples/${id}`));
    },
    async getExperiments(id: number | string) {
      return normalizeSampleExperiments(await call(`/samples/${id}/experiments`));
    },
    async receive(id: number | string) {
      return normalizeSampleRow(
        await call(`/samples/${id}/receive`, {
          method: 'POST',
        }),
      );
    },
    async rejectReceiving(id: number | string, reason: string = '') {
      return normalizeSampleRow(
        await call(`/samples/${id}/reject-receiving`, {
          method: 'POST',
          body: {
            reason,
          },
        }),
      );
    },
    async reportLost(id: number | string) {
      return normalizeSampleRow(
        await call(`/samples/${id}/report-lost`, {
          method: 'POST',
        }),
      );
    },
    async void(id: number | string) {
      return normalizeSampleRow(
        await call(`/samples/${id}/void`, {
          method: 'POST',
        }),
      );
    },
    async return(id: number | string) {
      return normalizeSampleRow(
        await call(`/samples/${id}/return`, {
          method: 'POST',
        }),
      );
    },
  },
  wips: {
    async list(q: Record<string, string> = {}) {
      const usp = new URLSearchParams(q);
      const out = await call(`/wips?${usp}`);
      return out.map(normalizeWip);
    },
    async get(id: number | string) {
      return normalizeWip(await call(`/wips/${id}`));
    },
    async create({
      experimentTypeId,
      sampleIds,
      note = '',
    }: {
      experimentTypeId: number | string;
      sampleIds: number[];
      note?: string;
    }) {
      return normalizeWip(
        await call('/wips/', {
          method: 'POST',
          body: {
            experiment_type_id: experimentTypeId,
            sample_ids: sampleIds,
            note,
          },
        }),
      );
    },
    async createDispatch(
      wipId: number | string,
      {
        equipmentId,
        recipeId,
        estimatedDurationSeconds,
        note = '',
      }: {
        equipmentId: number | string;
        recipeId: number | string;
        estimatedDurationSeconds?: number | string | null;
        note?: string;
      },
    ) {
      const body: Record<string, unknown> = {
        equipment_id: equipmentId,
        recipe_id: recipeId,
        note,
      };
      if (estimatedDurationSeconds != null && estimatedDurationSeconds !== '') {
        body.estimated_duration_seconds = estimatedDurationSeconds;
      }
      return normalizeWip(
        await call(`/wips/${wipId}/dispatches/`, {
          method: 'POST',
          body,
        }),
      );
    },
    async complete(id: number | string) {
      return normalizeWip(
        await call(`/wips/${id}/complete`, {
          method: 'POST',
        }),
      );
    },
    async abort(id: number | string) {
      return normalizeWip(
        await call(`/wips/${id}/abort`, {
          method: 'POST',
        }),
      );
    },
  },
  dispatches: {
    async list(q: Record<string, string> = {}) {
      const usp = new URLSearchParams(q);
      const out = await call(`/dispatches?${usp}`);
      return out.map((d: Schemas['DispatchListOut']) => ({
        id: d.id,
        code: dispatchCode(d.id),
        wipId: d.wip_id,
        experimentId: d.experiment_type_id,
        equipmentId: d.equipment_id,
        recipeId: d.recipe_id,
        operator: d.created_by?.username || null,
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
    async get(id: number | string) {
      return normalizeDispatch(await call(`/dispatches/${id}`));
    },
    async start(id: number | string) {
      return normalizeDispatch(
        await call(`/dispatches/${id}/start/`, {
          method: 'POST',
        }),
      );
    },
    async unload(id: number | string) {
      return normalizeDispatch(
        await call(`/dispatches/${id}/unload/`, {
          method: 'POST',
        }),
      );
    },
    async recordResult(id: number | string, { comment = '' }: { comment?: string } = {}) {
      return normalizeDispatch(
        await call(`/dispatches/${id}/record-result/`, {
          method: 'POST',
          body: {
            comment,
          },
        }),
      );
    },
    // Simulated machine result: drives a DISPATCHED/RUNNING dispatch
    // straight to COMPLETED (unload → record_result server-side). Fired
    // by the SPA countdown when auto_complete_at elapses; the manual
    // unload→recordResult path stays available as the operator override.
    // Trailing slash required: the backend route is /automation/equipment-result/
    // and APPEND_SLASH can't redirect a POST without dropping its body.
    async autoComplete(id: number | string, { comment = '' }: { comment?: string } = {}) {
      return normalizeDispatch(
        await call(`/automation/equipment-result/`, {
          method: 'POST',
          body: {
            dispatch_id: Number(id),
            comment,
          },
        }),
      );
    },
    async complete(id: number | string) {
      return normalizeDispatch(
        await call(`/dispatches/${id}/complete/`, {
          method: 'POST',
        }),
      );
    },
    async reportException(id: number | string, note: string = '') {
      return normalizeDispatch(
        await call(`/dispatches/${id}/report-exception/`, {
          method: 'POST',
          body: {
            note,
          },
        }),
      );
    },
    async redispatch(id: number | string) {
      return normalizeDispatch(
        await call(`/dispatches/${id}/redispatch/`, {
          method: 'POST',
        }),
      );
    },
    async abort(id: number | string) {
      return normalizeDispatch(
        await call(`/dispatches/${id}/abort/`, {
          method: 'POST',
        }),
      );
    },
  },
  reports: {
    async equipmentUtilization(q: Record<string, string | number>) {
      const usp = new URLSearchParams(q as Record<string, string>);
      return call(`/reports/equipment-utilization?${usp}`);
    },
    async requestStatistics(q: Record<string, string | number>) {
      const usp = new URLSearchParams(q as Record<string, string>);
      return call(`/reports/request-statistics?${usp}`);
    },
    async trends(q: Record<string, string | number> = {}) {
      const usp = new URLSearchParams(q as Record<string, string>);
      return call(`/reports/trends?${usp}`);
    },
  },
};
export const LIMS_STATUS_MAPS = {
  request: REQUEST_STATUS_MAP,
  sample: SAMPLE_STATUS_MAP,
  dispatch: DISPATCH_STATUS_MAP,
  equipment: EQUIPMENT_STATUS_MAP,
  role: ROLE_MAP,
};
export default api;
export { api };
