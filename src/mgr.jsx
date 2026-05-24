(function () {
// Lab Manager (實驗室主管) — management surfaces stacked on top of lab pages.
// Provides three management routes:
//   mgr_all_requests   — every fab request, with approve / return / reject controls
//   mgr_recipes        — CRUD over recipes via a New WIP–style modal
//   mgr_reports        — date-range report generators

const { useState: mS, useMemo: mM } = React;
const MI = window.I;

// ── Design tokens (mirror lab.jsx so visuals stay consistent) ───
const mInk     = '#1e1e24';
const mText2   = '#5a5a6e';
const mMuted   = '#8e8ea0';
const mLine    = 'rgba(0,0,0,0.08)';
const mLineSft = 'rgba(0,0,0,0.05)';
const mAccent  = '#6c67b8';
const mBgSoft  = '#f7f7fa';

// ── Live data hooks ──────────────────────────────────────────────
// Manager-side request list. The lab manager sees every request across
// fab users; tabs filter client-side so a single fetch drives the page.
// (The /requests/ endpoint also accepts a ?status= filter — useful for
// "only Pending" optimisation later if the volume justifies it.)
const useMgrRequests = () => {
  const [data, setData] = mS([]);
  const [loading, setLoading] = mS(true);
  const [error, setError] = mS(null);
  const refresh = React.useCallback(() => {
    if (!window.api || !window.api.requests) { setLoading(false); return; }
    setLoading(true);
    window.api.requests.list()
      .then(rs => { setData(rs); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
};

// Manager Dashboard data — tile counts come from a single requests
// fetch + an equipment count fetch, both in parallel (mirrors the Lab
// Dashboard's `useLabDashboardData` pattern).
const useMgrDashboardData = () => {
  const [requests, setRequests] = mS([]);
  const [equipmentCount, setEquipmentCount] = mS(0);
  const [loading, setLoading] = mS(true);
  const [error, setError] = mS(null);
  const refresh = React.useCallback(() => {
    if (!window.api) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      window.api.requests.list(),
      window.api.equipment.list().catch(() => []),
    ])
      .then(([rs, eqs]) => {
        setRequests(rs);
        setEquipmentCount(eqs.length);
        setError(null);
      })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { requests, equipmentCount, loading, error, refresh };
};

// Live trend points for the dashboard chart. The backend `/reports/trends`
// endpoint takes a metric + window in days and returns
// `{metric, days, points: [{date, count}]}`.
const useMgrTrend = (metric = 'requests_per_day', days = 30) => {
  const [data, setData] = mS(null);
  const [loading, setLoading] = mS(true);
  const [error, setError] = mS(null);
  React.useEffect(() => {
    if (!window.api || !window.api.reports) { setLoading(false); return; }
    setLoading(true);
    window.api.reports.trends({ metric, days })
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [metric, days]);
  return { data, loading, error };
};

// Live experiment-types catalogue, used by the Recipe and Equipment
// modals to populate their dropdowns. (`fab.jsx` has its own
// `useExperimentTypes` inside that file's IIFE — not reachable here.)
const useMgrExperimentTypes = () => {
  const [data, setData] = mS([]);
  const [loading, setLoading] = mS(true);
  const [error, setError] = mS(null);
  React.useEffect(() => {
    if (!window.api || !window.api.experimentTypes) { setLoading(false); return; }
    window.api.experimentTypes.list()
      .then(rs => { setData(rs); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading, error };
};

// Best-effort mapping from a live experiment-type name to the local
// string slug RECIPE_PARAM_SCHEMA is keyed on. Lets us keep the
// schema-driven UI for the four canonical experiment types while
// gracefully degrading to a raw-JSON textarea for any custom type.
const slugForExperimentName = (name) => {
  if (!name) return null;
  const l = name.toLowerCase();
  if (l.includes('temperature cycling')) return 'tct';
  if (l.includes('hast') || l.includes('highly accelerated')) return 'hast';
  if (l.includes('bias temperature')) return 'btc';
  if (l.includes('circuit prob')) return 'cp';
  if (l.includes('final test')) return 'ft';
  return null;
};

// Manager-side recipe list. Wired for create / edit / delete via the
// RecipeModal redesign (this commit).
const useMgrRecipes = () => {
  const [data, setData] = mS([]);
  const [loading, setLoading] = mS(true);
  const [error, setError] = mS(null);
  const refresh = React.useCallback(() => {
    if (!window.api || !window.api.recipes) { setLoading(false); return; }
    setLoading(true);
    window.api.recipes.list()
      .then(rs => { setData(rs); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
};

// Manager-side equipment list. Same /equipment/ endpoint as Lab
// Equipment; both pages stay independent so the manager surface can
// add maintenance controls later without coupling lab + manager.
const useMgrEquipment = () => {
  const [data, setData] = mS([]);
  const [loading, setLoading] = mS(true);
  const [error, setError] = mS(null);
  const refresh = React.useCallback(() => {
    if (!window.api || !window.api.equipment) { setLoading(false); return; }
    setLoading(true);
    window.api.equipment.list()
      .then(es => { setData(es); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
};

// Manager-side single-request detail (samples + approval_logs inline).
// `refresh` is exposed so approve/return/reject can re-render in place.
const useMgrRequestDetail = (id) => {
  const [data, setData] = mS(null);
  const [loading, setLoading] = mS(true);
  const [error, setError] = mS(null);
  const refresh = React.useCallback(() => {
    if (id == null || !window.api || !window.api.requests) { setLoading(false); return; }
    setLoading(true);
    window.api.requests.get(id)
      .then(r => { setData(r); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [id]);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
};

// ── Domain seeds ─────────────────────────────────────────────────
// Pending requests waiting on manager approval. Mirrors the shape used by
// fab.jsx's REQUEST_SEED so the same fields render.
const MGR_REQUEST_SEED = [
  { id: 22, title: 'HAST 0509001',         status: 'submitted',   urgency: '3d', expIds: ['hast'],
    samples: [{ wafer: 'W0509A', size: '300mm', status: 'pending' }],
    note: 'Critical reliability batch — requested expedited turnaround.',
    created: '2026-05-09 08:14', submitted: '2026-05-09 08:14',
    history: [{ action: 'SUBMIT', by: 'fab_user', at: '2026-05-09 08:14' }] },
  { id: 21, title: 'TCT 0508004',          status: 'submitted',   urgency: '1w', expIds: ['tct'],
    samples: [
      { wafer: 'W050801', size: '200mm', status: 'pending' },
      { wafer: 'W050802', size: '200mm', status: 'pending' },
    ], note: '', created: '2026-05-08 14:30', submitted: '2026-05-08 14:31',
    history: [{ action: 'SUBMIT', by: 'fab_user', at: '2026-05-08 14:31' }] },
  { id: 20, title: 'CP 0508002',           status: 'submitted',   urgency: '2w', expIds: ['cp'],
    samples: [{ wafer: 'W050802C', size: '300mm', status: 'pending' }],
    note: 'Standard probe sweep.',
    created: '2026-05-08 10:02', submitted: '2026-05-08 10:03',
    history: [{ action: 'SUBMIT', by: 'fab_user', at: '2026-05-08 10:03' }] },
  // Plus a few already-resolved entries so the list feels populated.
  { id: 14, title: 'TCT 041501',           status: 'in_progress', urgency: '3d', expIds: ['tct'],
    samples: [{ wafer: 'W041501', size: '200mm', status: 'received' }],
    note: '', created: '2026-04-15 13:03', submitted: '2026-04-15 13:03',
    history: [
      { action: 'SUBMIT',  by: 'fab_user', at: '2026-04-15 13:03' },
      { action: 'APPROVE', by: 'lab_manager', at: '2026-04-15 13:08' },
    ] },
  { id: 11, title: 'Testing_temperature_flow', status: 'in_progress', urgency: '2w', expIds: ['tct', 'hast'],
    samples: [{ wafer: 'W041201', size: '300mm', status: 'received' }],
    note: 'Long flow validation.',
    created: '2026-04-12 16:11', submitted: '2026-04-12 16:14',
    history: [
      { action: 'SUBMIT',  by: 'fab_user', at: '2026-04-12 16:14' },
      { action: 'APPROVE', by: 'lab_manager', at: '2026-04-12 17:02' },
    ] },
  { id: 7,  title: 'TCT 0408005',          status: 'returned',    urgency: '1w', expIds: ['tct'],
    samples: [{ wafer: 'W040805C', size: '200mm', status: 'returned' }],
    note: 'Returned — wrong recipe specified.',
    created: '2026-04-12 08:10', submitted: '2026-04-12 08:11',
    history: [
      { action: 'SUBMIT', by: 'fab_user', at: '2026-04-12 08:11' },
      { action: 'RETURN', by: 'lab_manager', at: '2026-04-12 08:40', note: 'Recipe parameter missing' },
    ] },
  { id: 5,  title: 'TCT 0408003',          status: 'rejected',    urgency: '1w', expIds: ['tct'],
    samples: [
      { wafer: 'W040803A', size: '300mm', status: 'rejected' },
      { wafer: 'W040803B', size: '300mm', status: 'rejected' },
    ], created: '2026-04-08 13:00', submitted: '2026-04-08 13:01',
    history: [
      { action: 'SUBMIT', by: 'fab_user', at: '2026-04-08 13:01' },
      { action: 'REJECT', by: 'lab_manager', at: '2026-04-08 14:20', note: 'Insufficient sample budget' },
    ] },
  { id: 6,  title: 'TCT 0408004',          status: 'completed',   urgency: '1w', expIds: ['tct'],
    samples: [{ wafer: 'W040701', size: '200mm', status: 'completed' }],
    note: 'Reliability characterisation — Q2 lot.',
    created: '2026-04-08 09:14', submitted: '2026-04-08 09:15',
    history: [
      { action: 'SUBMIT',   by: 'fab_user',    at: '2026-04-08 09:15' },
      { action: 'APPROVE',  by: 'lab_manager', at: '2026-04-08 10:01' },
      { action: 'COMPLETE', by: 'lab_manager', at: '2026-05-09 14:10' },
    ] },
];

const MGR_EXPERIMENTS = [
  { id: 'tct',  code: 'TCT',  name: 'Temperature Cycling Test',          group: 'RA' },
  { id: 'hast', code: 'HAST', name: 'Highly Accelerated Stress Test',    group: 'RA' },
  { id: 'btc',  code: 'BTC',  name: 'Bias Temperature Cycling',          group: 'RA' },
  { id: 'cp',   code: 'CP',   name: 'Circuit Probing',                   group: 'TM' },
  { id: 'ft',   code: 'FT',   name: 'Final Test',                        group: 'TM' },
];
const MGR_EQUIPMENT = [
  { id: 'QA-TCT-01',  type: 'TCT',  model: 'ESPEC ARS-1100' },
  { id: 'QA-TCT-02',  type: 'TCT',  model: 'ESPEC ARS-1100' },
  { id: 'QA-HAST-01', type: 'HAST', model: 'Hirayama PC-422' },
  { id: 'QA-CP-A',    type: 'CP',   model: 'Accretech UF3000' },
  { id: 'QA-CP-B',    type: 'CP',   model: 'Accretech UF3000' },
  { id: 'QA-FT-1',    type: 'FT',   model: 'Advantest V93000' },
];
// Default parameter shapes per experiment type — drives the dynamic recipe form.
const RECIPE_PARAM_SCHEMA = {
  tct:  [
    { key: 'cycles',  label: 'Cycles',          placeholder: '500' },
    { key: 't_min',   label: 'T Min',           placeholder: '-55 \u00b0C' },
    { key: 't_max',   label: 'T Max',           placeholder: '125 \u00b0C' },
    { key: 'dwell',   label: 'Dwell',           placeholder: '15 min' },
    { key: 'ramp',    label: 'Ramp',            placeholder: '15 \u00b0C/min' },
  ],
  hast: [
    { key: 'temperature', label: 'Temperature', placeholder: '85 \u00b0C' },
    { key: 'humidity',    label: 'Humidity',    placeholder: '85% RH' },
    { key: 'duration',    label: 'Duration',    placeholder: '168 h' },
    { key: 'bias',        label: 'Bias',        placeholder: '5 V' },
  ],
  btc:  [
    { key: 'cycles', label: 'Cycles', placeholder: '300' },
    { key: 'bias',   label: 'Bias',   placeholder: '3.3 V' },
    { key: 'temp',   label: 'Temp',   placeholder: '125 \u00b0C' },
  ],
  cp:   [
    { key: 'sites',       label: 'Sites',       placeholder: '1024' },
    { key: 'touchdowns',  label: 'Touchdowns',  placeholder: '24' },
    { key: 'vdd',         label: 'VDD',         placeholder: '1.0 V' },
    { key: 'clock',       label: 'Clock',       placeholder: '100 MHz' },
  ],
  ft:   [
    { key: 'tests',   label: 'Tests',   placeholder: '240' },
    { key: 'voltage', label: 'Voltage', placeholder: '1.2 V' },
    { key: 'temp',    label: 'Temp',    placeholder: '25 \u00b0C' },
  ],
};
// Recipes no longer carry equipment — they're independent of the bench they
// happen to run on. (Equipment is chosen per-dispatch.)
const MGR_RECIPE_SEED = [
  { id: 'tct_std',  name: 'TCT_Standard_Reflow_Simulation_v1', expId: 'tct',
    description: 'Industry-standard JESD22 condition G profile.',
    params: { cycles: 500, t_min: '-55 \u00b0C', t_max: '125 \u00b0C', dwell: '15 min', ramp: '15 \u00b0C/min' } },
  { id: 'tct_long', name: 'TCT_Extended_1000_Cycle_v2',         expId: 'tct',
    description: 'Extended profile used for HBM reliability sweeps.',
    params: { cycles: 1000, t_min: '-65 \u00b0C', t_max: '150 \u00b0C', dwell: '10 min', ramp: '20 \u00b0C/min' } },
  { id: 'hast_std', name: 'HAST_85C_85RH_v1',                  expId: 'hast',
    description: 'Steady-state HAST with bias for packaged-part qualifications.',
    params: { temperature: '85 \u00b0C', humidity: '85% RH', duration: '168 h', bias: '5 V' } },
  { id: 'cp_full',  name: 'CP_Full_Param_Sweep_v3',            expId: 'cp',
    description: 'Full parametric sweep across the die map.',
    params: { sites: 1024, touchdowns: 24, vdd: '1.0 V', clock: '100 MHz' } },
  { id: 'ft_basic', name: 'FT_Basic_Functional_v1',            expId: 'ft',
    description: 'Basic packaged-part functional bin sort.',
    params: { tests: 240, voltage: '1.2 V', temp: '25 \u00b0C' } },
];

const STATUS_LABEL = {
  draft:       { label: 'Draft',       bg: '#ebebf0', fg: '#5a5a6e' },
  submitted:   { label: 'Submitted',   bg: '#fef0d4', fg: '#b8720e' },
  in_progress: { label: 'In Progress', bg: '#d4eaf0', fg: '#2a7a91' },
  returned:    { label: 'Returned',    bg: '#f9d7e0', fg: '#a73d56' },
  rejected:    { label: 'Rejected',    bg: '#fde4e4', fg: '#c0394a' },
  cancelled:   { label: 'Cancelled',   bg: '#ebebf0', fg: '#777788' },
  completed:   { label: 'Completed',   bg: '#dbeafe', fg: '#1d4ed8' },
};
const URGENCY_LABEL = {
  '3d': { label: '3 Days',  bg: '#fbe4e6', fg: '#a93445' },
  '1w': { label: '1 Week',  bg: '#e8e7f6', fg: '#5550a0' },
  '2w': { label: '2 Weeks', bg: '#eef0ed', fg: '#4d5a4f' },
};
const Pill = ({ kind, mapping = STATUS_LABEL, dotted }) => {
  const p = mapping[kind] || { label: kind, bg: '#ebebf0', fg: '#5a5a6e' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 999,
      background: p.bg, color: p.fg, fontSize: 11.5, fontWeight: 700,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      {dotted && <span style={{ width: 6, height: 6, borderRadius: 999, background: p.fg }}/>}
      {p.label}
    </span>
  );
};

// ── Shared primitives (small inline set to keep this file self-contained) ──
const Page = ({ title, subtitle, breadcrumb, right, children }) => (
  <div style={{ padding: '32px 44px 80px', maxWidth: 1320, margin: '0 auto' }}>
    {breadcrumb}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        {title && <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: mInk }}>{title}</h1>}
        {subtitle && <div style={{ fontSize: 13, color: mText2, marginTop: 6 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display: 'inline-flex', gap: 10, flexShrink: 0 }}>{right}</div>}
    </div>
    {children}
  </div>
);
const Card = ({ children, padding = 22, style }) => (
  <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${mLine}`, padding, ...style }}>{children}</div>
);
const CardHeader = ({ children, style }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 20px', borderBottom: `1px solid ${mLineSft}`,
    fontSize: 11, fontWeight: 700, color: mText2,
    textTransform: 'uppercase', letterSpacing: '0.08em', ...style,
  }}>{children}</div>
);
const PrimaryBtn = ({ children, onClick, icon, disabled, danger, success, style }) => {
  const bg = disabled ? '#dcdce3' : danger ? '#b9384a' : success ? '#2e6a47' : mInk;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '10px 16px', borderRadius: 8,
      background: bg, color: '#fff', border: 'none',
      fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', ...style,
    }}>{icon}{children}</button>
  );
};
const SecondaryBtn = ({ children, onClick, icon, danger, style }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 14px', borderRadius: 8,
    background: '#fff', color: danger ? '#b9384a' : mInk,
    border: `1px solid ${danger ? '#e6c2c7' : mLine}`,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', ...style,
  }}>{icon}{children}</button>
);
const FieldLabel = ({ children, required }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: mText2, marginBottom: 6 }}>
    {children}{required && <span style={{ color: '#c0394a', marginLeft: 4 }}>*</span>}
  </div>
);
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1px solid ${mLine}`, background: '#fff',
  fontSize: 13.5, color: mInk, fontFamily: 'inherit', outline: 'none',
};
const TextInput = (p) => <input {...p} style={{ ...inputStyle, ...p.style }}/>;
const SelectInput = ({ value, onChange, children, style }) => (
  <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: 'pointer', ...style }}>{children}</select>
);
const TextArea = (p) => <textarea {...p} style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', ...p.style }}/>;

const Modal = ({ open, onClose, title, children, width = 580, footer }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(20,20,28,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 20, animation: 'fade-in 0.12s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: width,
        boxShadow: '0 30px 60px -20px rgba(20,20,28,0.4)',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${mLineSft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: mInk }}>{title}</div>
          <button onClick={onClose} style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 4,
            color: mMuted, display: 'inline-flex',
          }}><MI.X size={18}/></button>
        </div>
        <div style={{ padding: 24, overflow: 'auto' }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${mLineSft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>
        )}
      </div>
    </div>
  );
};

const Breadcrumb = ({ items }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 14, fontSize: 13 }}>
    {items.map((it, i) => (
      <React.Fragment key={i}>
        {i > 0 && <MI.ChevronRight size={13} color={mMuted}/>}
        {it.onClick ? (
          <button onClick={it.onClick} style={{
            background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer',
            color: mAccent, fontWeight: 600, fontFamily: 'inherit', fontSize: 13,
          }}>{it.label}</button>
        ) : (
          <span style={{ color: mText2, fontWeight: 500, padding: '2px 4px' }}>{it.label}</span>
        )}
      </React.Fragment>
    ))}
  </div>
);

// ── All Requests page ───────────────────────────────────────────
const ALL_REQ_TABS = [
  { id: 'pending',     label: 'Pending Approval', filter: (r) => r.status === 'submitted' },
  { id: 'all',         label: 'All',              filter: () => true },
  { id: 'in_progress', label: 'In Progress',      filter: (r) => r.status === 'in_progress' },
  { id: 'completed',   label: 'Completed',        filter: (r) => r.status === 'completed' },
  { id: 'returned',    label: 'Returned',         filter: (r) => r.status === 'returned' },
  { id: 'rejected',    label: 'Rejected',         filter: (r) => r.status === 'rejected' },
];

const findExpById = (id) => MGR_EXPERIMENTS.find(e => e.id === id);

const MgrAllRequests = ({ navigate }) => {
  const { data: requests, loading, error } = useMgrRequests();
  const [tab, setTab] = mS('pending');
  const nonDraftRequests = mM(() => requests.filter(r => r.status !== 'draft'), [requests]);
  const counts = mM(() => Object.fromEntries(ALL_REQ_TABS.map(t => [t.id, nonDraftRequests.filter(t.filter).length])), [nonDraftRequests]);
  const list = nonDraftRequests.filter(ALL_REQ_TABS.find(t => t.id === tab)?.filter || (() => true));

  if (loading && requests.length === 0) {
    return (
      <Page title="All Requests" subtitle="Loading…">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: mMuted, fontSize: 14 }}>Loading…</div>
      </Page>
    );
  }

  return (
    <Page
      title="All Requests"
      subtitle="廠區送審申請 — approve, return, or reject submitted requests"
    >
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          Couldn't load requests: {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 22, borderBottom: `1px solid ${mLine}`, marginBottom: 22 }}>
        {ALL_REQ_TABS.map(t => {
          const active = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 0 14px', cursor: 'pointer',
              color: active ? mInk : mText2,
              fontSize: 14, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
              background: 'transparent', border: 'none',
            }}>
              {t.label}
              <span style={{
                minWidth: 22, height: 19, padding: '0 7px',
                borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: active ? mInk : '#ebebf0',
                color: active ? '#fff' : '#5a5a6e',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{counts[t.id]}</span>
              {active && (
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: mInk, borderRadius: 2 }}/>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, color: mMuted, marginBottom: 14 }}>
        Showing <strong style={{ color: mInk }}>{list.length}</strong> of {nonDraftRequests.length} requests
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 ? (
          <Card padding={48} style={{ textAlign: 'center', color: mMuted }}>
            <MI.ClipboardList size={32} color="#cbcbd6" style={{ marginBottom: 10 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: mText2 }}>No requests in this view</div>
          </Card>
        ) : list.map(r => {
          // RequestListOut doesn't carry experiment_types (gap §3.7) — the
          // adapter sets `expIds: []` on list rows, so we render the
          // experiment chips column as empty space. The chip column stays
          // in the grid so the layout matches the detail page.
          const sampleCount = r.sampleCount ?? r.samples.length;
          const requester = r.requester?.username || r.history[0]?.by || '—';
          return (
            <button key={r.id} onClick={() => navigate({ page: 'mgr_request', id: r.id })} style={{
              display: 'grid',
              gridTemplateColumns: '80px minmax(0,1fr) 1.3fr 110px 130px 24px',
              alignItems: 'center', gap: 18,
              padding: '18px 22px', borderRadius: 14,
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              textAlign: 'left', cursor: 'pointer',
              transition: 'border-color 0.12s',
              fontFamily: 'inherit',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#a8a8b8', letterSpacing: '0.02em' }}>
                #{String(r.id).padStart(4, '0')}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: mInk }}>{r.title}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12.5, color: mMuted, flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
                  <MI.Calendar size={12}/>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{((r.submitted || r.created) || '').split(' ')[0] || '—'}</span>
                  <span aria-hidden>·</span>
                  <span>{sampleCount} wafer{sampleCount === 1 ? '' : 's'}</span>
                  <span aria-hidden>·</span>
                  <span>by <span style={{ fontFamily: 'var(--font-mono)', color: mText2 }}>{requester}</span></span>
                </div>
              </div>
              {/* Experiment chip slot — filled when expIds are populated (offline seed only for now). */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {r.expIds.map(findExpById).filter(Boolean).map(e => (
                  <span key={e.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 9px 4px 4px', borderRadius: 999,
                    background: '#f5f5fa', border: `1px solid ${mLine}`,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                      background: e.group === 'RA' ? '#e8e7f6' : '#d4eaf0',
                      color: e.group === 'RA' ? '#5550a0' : '#2a7a91',
                      letterSpacing: '0.05em',
                    }}>{e.code}</span>
                    <span style={{ fontSize: 12.5, color: mText2, fontWeight: 500 }}>{e.name}</span>
                  </span>
                ))}
              </div>
              <Pill kind={r.urgency} mapping={URGENCY_LABEL}/>
              <Pill kind={r.status}/>
              <MI.ChevronRight size={15} color="#cbcbd6"/>
            </button>
          );
        })}
      </div>
    </Page>
  );
};

// ── Approval action modal ─────────────────────────────────────
const ApprovalModal = ({ open, onClose, action, onSubmit }) => {
  const [reason, setReason] = mS('');
  React.useEffect(() => { if (open) setReason(''); }, [open]);
  const map = {
    APPROVE: { title: 'Approve request', cta: 'Approve',  needs: false, hint: 'Optional note recorded with the approval.' },
    RETURN:  { title: 'Return request',  cta: 'Return',   needs: true,  hint: 'Tell the requester what needs to change.' },
    REJECT:  { title: 'Reject request',  cta: 'Reject',   needs: true,  hint: 'Tell the requester why.' },
  }[action] || {};
  const valid = !map.needs || reason.trim().length > 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={map.title}
      width={520}
      footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn
          disabled={!valid}
          danger={action === 'REJECT' || action === 'RETURN'}
          success={action === 'APPROVE'}
          onClick={() => onSubmit(reason.trim())}
        >{map.cta}</PrimaryBtn>
      </>}
    >
      <div>
        <FieldLabel required={map.needs}>Reason {map.needs ? '' : '(optional)'}</FieldLabel>
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={map.hint}/>
        <div style={{ fontSize: 12, color: mMuted, marginTop: 6 }}>{map.hint}</div>
      </div>
    </Modal>
  );
};

// ── Request detail (manager view) ─────────────────────────────
const MgrRequestDetail = ({ id, navigate, showToast }) => {
  const { data: r, loading, error, refresh } = useMgrRequestDetail(id);
  const [modal, setModal] = mS(null); // 'RETURN' | 'REJECT' | null
  const [busy, setBusy] = mS(false);
  const [actionError, setActionError] = mS(null);

  const runAction = async (op, label) => {
    setBusy(true);
    setActionError(null);
    try {
      await op();
      showToast && showToast(label);
      refresh();
    } catch (e) {
      setActionError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !r) {
    return (
      <Page title="Loading request…">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: mMuted, fontSize: 14 }}>Loading…</div>
      </Page>
    );
  }
  if (error || !r) {
    return (
      <Page
        breadcrumb={<Breadcrumb items={[
          { label: 'All Requests', onClick: () => navigate({ page: 'mgr_all_requests' }) },
          { label: '?' },
        ]}/>}
        title="Request not found"
      >
        <div style={{ padding: 24, color: '#c0394a', fontSize: 14 }}>
          {error || 'This request is no longer available.'}
        </div>
      </Page>
    );
  }

  const onApprove = () => {
    if (!window.confirm(`Approve "${r.title}"?`)) return;
    runAction(() => window.api.requests.approve(r.id), `#${r.id} approved`);
  };
  const onMarkComplete = () => {
    if (!window.confirm(`Mark "${r.title}" as complete? This closes the request.`)) return;
    runAction(() => window.api.requests.close(r.id), `#${r.id} closed`);
  };
  const onSubmitModal = async (reason) => {
    const action = modal;
    setModal(null);
    if (action === 'RETURN') {
      await runAction(() => window.api.requests.returnRequest(r.id, reason), `#${r.id} returned`);
    } else if (action === 'REJECT') {
      await runAction(() => window.api.requests.reject(r.id, reason), `#${r.id} rejected`);
    }
  };

  // Backend's RequestDetailOut carries `experiment_types: [{id, name, parameters}]`
  // — no `lab_category`, so the RA/TM chip color falls back to the default for
  // unknown groups. Names render correctly either way.
  const exps = (r.experiment_types || []).map(et => ({
    id: et.id,
    name: et.name,
    code: et.name ? et.name.split(/\s+/).map(t => t[0]).join('').slice(0, 4).toUpperCase() : '—',
    group: 'RA', // unknown without cross-fetch; default to RA palette
  }));
  const canAct = r.status === 'submitted';
  const canComplete = r.status === 'in_progress';

  return (
    <Page
      breadcrumb={<Breadcrumb items={[
        { label: 'All Requests', onClick: () => navigate({ page: 'mgr_all_requests' }) },
        { label: r.title },
      ]}/>}
      title={r.title}
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12.5, color: mMuted,
            letterSpacing: '0.04em', padding: '3px 9px', borderRadius: 6,
            background: '#ebebf0',
          }}>#{String(r.id).padStart(4, '0')}</span>
          <Pill kind={r.status}/>
          <Pill kind={r.urgency} mapping={URGENCY_LABEL}/>
          <span style={{ color: mText2, fontSize: 13 }}>by <strong style={{ color: mInk, fontFamily: 'var(--font-mono)' }}>{r.requester?.username || r.history[0]?.by || '—'}</strong></span>
        </span>
      }
      right={<>
        {canAct && <>
          <SecondaryBtn danger disabled={busy} onClick={() => setModal('REJECT')} icon={<MI.X size={14}/>}>Reject</SecondaryBtn>
          <SecondaryBtn disabled={busy} onClick={() => setModal('RETURN')} icon={<MI.Refresh size={14}/>}>Return</SecondaryBtn>
          <PrimaryBtn success disabled={busy} onClick={onApprove} icon={<MI.Check size={14}/>}>{busy ? '…' : 'Approve'}</PrimaryBtn>
        </>}
        {canComplete && (
          <PrimaryBtn success disabled={busy} onClick={onMarkComplete} icon={<MI.Check size={14}/>}>{busy ? '…' : 'Mark Complete'}</PrimaryBtn>
        )}
      </>}
    >
      {actionError && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          {actionError}
        </div>
      )}
      <Card padding={0} style={{ marginBottom: 18 }}>
        <CardHeader>Overview</CardHeader>
        <div style={{
          padding: '22px 24px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18,
          borderBottom: `1px solid ${mLineSft}`,
        }}>
          {[
            { label: 'Wafers',      value: r.samples.length },
            { label: 'Experiments', value: exps.length },
            { label: 'Submitted',   value: r.submitted?.split(' ')[0] || '—' },
            { label: 'Requester',   value: r.requester?.username || r.history[0]?.by || '—' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: mMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginTop: 6, letterSpacing: '-0.01em', color: mInk }}>{s.value}</div>
            </div>
          ))}
        </div>
        {r.note && (
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${mLineSft}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: mText2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Requester note</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: mInk }}>{r.note}</div>
          </div>
        )}
        <CardHeader>Submission History</CardHeader>
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {r.history.map((h, i) => {
            const c = {
              SUBMIT:  { dot: '#5550a0', bg: '#e8e7f6', fg: '#5550a0' },
              APPROVE: { dot: '#157a4a', bg: '#c8eedd', fg: '#157a4a' },
              REJECT:  { dot: '#c0394a', bg: '#fde4e4', fg: '#c0394a' },
              RETURN:  { dot: '#a73d56', bg: '#f9d7e0', fg: '#a73d56' },
              CANCEL:  { dot: '#777788', bg: '#ebebf0', fg: '#5a5a6e' },
            }[h.action] || { dot: '#a8a8b8', bg: '#f1f1f5', fg: '#5a5a6e' };
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ width: 16, height: 16, borderRadius: 999, background: '#fff', border: `3px solid ${c.dot}`, marginTop: 2 }}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.fg, letterSpacing: '0.04em' }}>{h.action}</span>
                    <span style={{ fontSize: 13.5, color: mText2 }}>by <strong style={{ color: mInk, fontFamily: 'var(--font-mono)' }}>{h.by}</strong></span>
                  </div>
                  {h.note && (
                    <div style={{ fontSize: 13, color: mText2, marginTop: 6, padding: '8px 10px', background: mBgSoft, borderRadius: 6 }}>{h.note}</div>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: mMuted, whiteSpace: 'nowrap' }}>{h.at}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding={0}>
        <CardHeader>Samples · Experiments</CardHeader>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {r.samples.map((s, si) => (
            <button key={si} onClick={() => navigate({ page: 'lab_wafer', id: s.id })} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 20px',
              alignItems: 'center', gap: 18,
              padding: '14px 18px', background: '#fff',
              borderRadius: 10, border: `1px solid ${mLine}`,
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'border-color 0.12s, background 0.12s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(108,103,184,0.4)'; e.currentTarget.style.background = '#fbfbfd'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = mLine; e.currentTarget.style.background = '#fff'; }}
              title={`Open wafer ${s.wafer}`}
            >
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <MI.Wafer size={15} color={mAccent}/>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: mInk }}>{s.wafer}</span>
                </div>
                <div style={{ fontSize: 11.5, color: mMuted, marginTop: 4, marginLeft: 23 }}>{s.size}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {exps.map(e => (
                  <span key={e.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '5px 11px 5px 6px', borderRadius: 999,
                    background: '#f5f5fa', border: `1px solid ${mLine}`,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                      background: e.group === 'RA' ? '#e8e7f6' : '#d4eaf0',
                      color: e.group === 'RA' ? '#5550a0' : '#2a7a91',
                      letterSpacing: '0.05em',
                    }}>{e.code}</span>
                    <span style={{ fontSize: 13, color: mInk, fontWeight: 500 }}>{e.name}</span>
                  </span>
                ))}
              </div>
              <MI.ChevronRight size={16} color={mMuted}/>
            </button>
          ))}
        </div>
      </Card>

      <ApprovalModal
        open={!!modal}
        action={modal}
        onClose={() => setModal(null)}
        onSubmit={onSubmitModal}
      />
    </Page>
  );
};

// ── Recipes page ──────────────────────────────────────────────
// Live-wired recipe modal. New mode → pick experiment_type + params.
// Edit mode → experiment_type is locked (backend `RecipeUpdate`
// intentionally doesn't accept it), shown as a read-only chip.
const RecipeModal = ({ open, onClose, onSaved, initial }) => {
  const { data: experimentTypes, loading: typesLoading } = useMgrExperimentTypes();
  const [name, setName] = mS('');
  const [experimentTypeId, setExperimentTypeId] = mS('');
  const [desc, setDesc] = mS('');
  const [paramsKv, setParamsKv] = mS({});
  const [paramsJson, setParamsJson] = mS('{}');
  const [busy, setBusy] = mS(false);
  const [err, setErr] = mS(null);
  const isEdit = !!initial;

  // Choose the experiment_type for the schema lookup. In new mode it
  // follows the dropdown; in edit mode it's whatever the recipe had.
  const activeExpName = isEdit
    ? initial.experimentName
    : experimentTypes.find(t => t.id === experimentTypeId)?.name;
  const slug = slugForExperimentName(activeExpName);
  const schema = slug ? (RECIPE_PARAM_SCHEMA[slug] || []) : [];

  // Reset state whenever the modal (re)opens.
  React.useEffect(() => {
    if (!open) return;
    setErr(null); setBusy(false);
    if (initial) {
      setName(initial.name);
      setExperimentTypeId(initial.experimentId);
      setDesc(initial.description || '');
      const incomingParams = initial.params || {};
      setParamsKv({ ...incomingParams });
      try { setParamsJson(JSON.stringify(incomingParams, null, 2) || '{}'); }
      catch (_e) { setParamsJson('{}'); }
    } else {
      setName('');
      setExperimentTypeId(experimentTypes[0]?.id ?? '');
      setDesc('');
      setParamsKv({});
      setParamsJson('{}');
    }
  // eslint-disable-next-line — only fire on open transition
  }, [open, initial]);

  // Auto-select the first experiment type once the list resolves (new mode only).
  React.useEffect(() => {
    if (!open || isEdit) return;
    if (!experimentTypeId && experimentTypes.length > 0) {
      setExperimentTypeId(experimentTypes[0].id);
    }
  }, [open, isEdit, experimentTypeId, experimentTypes]);

  // Initialize any missing schema keys when the active exp_type changes.
  React.useEffect(() => {
    if (!open || schema.length === 0) return;
    setParamsKv(prev => {
      const next = { ...prev };
      schema.forEach(s => { if (next[s.key] == null) next[s.key] = ''; });
      return next;
    });
  }, [open, slug, schema]);

  const valid = name.trim().length > 0 && name.trim().length <= 200 && (isEdit || !!experimentTypeId);
  const submit = async () => {
    setBusy(true); setErr(null);
    // Build the parameters payload. With a schema → only the schema keys
    // (drop stale fields). Without → parse the JSON textarea.
    let parameters;
    if (schema.length > 0) {
      parameters = Object.fromEntries(schema.map(s => [s.key, paramsKv[s.key] ?? '']));
    } else {
      const trimmed = paramsJson.trim();
      if (!trimmed) {
        parameters = {};
      } else {
        try { parameters = JSON.parse(trimmed); }
        catch (_e) { setErr('Parameters must be valid JSON.'); setBusy(false); return; }
        if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
          setErr('Parameters must be a JSON object.'); setBusy(false); return;
        }
      }
    }
    try {
      if (isEdit) {
        await window.api.recipes.update(initial.id, {
          name: name.trim(), description: desc.trim(), parameters,
        });
      } else {
        await window.api.recipes.create({
          name: name.trim(), description: desc.trim(),
          experimentTypeId, parameters,
        });
      }
      onSaved && onSaved();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  // Edit-mode chip — read-only display of the locked experiment_type.
  const lockedExpName = isEdit ? (initial.experimentName || '—') : null;
  const lockedExpCode = lockedExpName
    ? (slug ? slug.toUpperCase() : lockedExpName.split(/\s+/).map(t => t[0]).join('').slice(0, 4).toUpperCase())
    : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Recipe' : 'New Recipe'}
      width={620}
      footer={<>
        <SecondaryBtn onClick={onClose} disabled={busy}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid || busy || typesLoading} onClick={submit}>
          {busy ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Recipe')}
        </PrimaryBtn>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {err && (
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: '#fde4e4', color: '#c0394a', fontSize: 13, fontWeight: 500,
            border: '1px solid #f6c4c4',
          }}>{err}</div>
        )}
        <div>
          <FieldLabel required>Name</FieldLabel>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. TCT_Standard_Reflow_Simulation_v1"/>
        </div>
        <div>
          <FieldLabel required>Experiment Type</FieldLabel>
          {isEdit ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 10px 6px 6px', borderRadius: 999,
              background: '#ecebf3', color: '#4f4a8f',
            }} title="Experiment type can't be changed after creation.">
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                background: '#fff', color: '#4f4a8f', letterSpacing: '0.05em',
              }}>{lockedExpCode}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{lockedExpName}</span>
              <span style={{ fontSize: 11, color: mMuted, marginLeft: 4 }}>(locked)</span>
            </div>
          ) : (
            <SelectInput
              value={experimentTypeId === '' ? '' : String(experimentTypeId)}
              onChange={(e) => setExperimentTypeId(e.target.value ? Number(e.target.value) : '')}
            >
              {typesLoading && <option value="">Loading…</option>}
              {!typesLoading && experimentTypes.length === 0 && <option value="">No experiment types</option>}
              {experimentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectInput>
          )}
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <TextArea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="When this recipe is used and why."/>
        </div>
        <div>
          <FieldLabel>Parameters</FieldLabel>
          {schema.length > 0 ? (
            <>
              <div style={{
                padding: '14px 14px 10px', borderRadius: 10,
                border: `1px solid ${mLine}`, background: mBgSoft,
                display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12,
              }}>
                {schema.map(s => (
                  <div key={s.key}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: mMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                    <TextInput
                      value={paramsKv[s.key] ?? ''}
                      onChange={(e) => setParamsKv(p => ({ ...p, [s.key]: e.target.value }))}
                      placeholder={s.placeholder}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: mMuted, marginTop: 6 }}>
                Schema-driven fields for {activeExpName || 'this experiment type'}.
              </div>
            </>
          ) : (
            <>
              <TextArea
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
                placeholder='{"key": "value"}'
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, minHeight: 120 }}
              />
              <div style={{ fontSize: 12, color: mMuted, marginTop: 6 }}>
                No schema defined for {activeExpName || 'this experiment type'} — enter a JSON object. Leave as <code>{'{}'}</code> for none.
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

const MgrRecipes = ({ showToast }) => {
  const { data: recipes, loading, error, refresh } = useMgrRecipes();
  const [modalOpen, setModalOpen] = mS(false);
  const [editing, setEditing] = mS(null);
  const [busyDeleteId, setBusyDeleteId] = mS(null);
  const [deleteError, setDeleteError] = mS(null);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (rec) => { setEditing(rec); setModalOpen(true); };
  const closeModal = () => { setEditing(null); setModalOpen(false); };
  const onSaved = () => {
    const wasEdit = !!editing;
    closeModal();
    showToast && showToast(wasEdit ? 'Recipe updated' : 'Recipe created');
    refresh();
  };
  const onDelete = async (rec) => {
    if (!window.confirm(`Delete recipe "${rec.name}"? This can't be undone.`)) return;
    setBusyDeleteId(rec.id);
    setDeleteError(null);
    try {
      await window.api.recipes.remove(rec.id);
      showToast && showToast(`${rec.name} deleted`);
      refresh();
    } catch (e) {
      setDeleteError(e.message || String(e));
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (loading && recipes.length === 0) {
    return (
      <Page title="Recipes" subtitle="Loading…">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: mMuted, fontSize: 14 }}>Loading…</div>
      </Page>
    );
  }

  return (
    <Page
      title="Recipes"
      subtitle="食譜 — experiment recipes referenced by dispatches"
      right={<PrimaryBtn icon={<MI.Plus size={14}/>} onClick={openNew}>New Recipe</PrimaryBtn>}
    >
      {deleteError && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          {deleteError}
        </div>
      )}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          Couldn't load recipes: {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes.length === 0 ? (
          <Card padding={48} style={{ textAlign: 'center', color: mMuted }}>
            <MI.ClipboardList size={32} color="#cbcbd6" style={{ marginBottom: 10 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: mText2 }}>No recipes yet</div>
          </Card>
        ) : recipes.map(rec => {
          // Backend recipe shape: { id, name, description, experimentId,
          // experimentName, params, active }. The local string-slug
          // `findExpById` may match for legacy seed rows; otherwise we
          // derive a chip code from the experiment name's initials.
          const expCode = (findExpById(rec.experimentId)?.code) || (rec.experimentName ? rec.experimentName.split(/\s+/).map(t => t[0]).join('').slice(0, 4).toUpperCase() : '—');
          const expName = rec.experimentName || findExpById(rec.experimentId)?.name || '—';
          const paramEntries = rec.params ? Object.entries(rec.params) : [];
          return (
            <div key={rec.id} style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.4fr) 180px minmax(0,1.6fr) 110px',
              alignItems: 'center', gap: 18,
              padding: '18px 22px', borderRadius: 14,
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: mInk, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.name}</div>
                {rec.description && (
                  <div style={{ fontSize: 12.5, color: mMuted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.description}</div>
                )}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                  background: '#e8e7f6', color: '#5550a0',
                  letterSpacing: '0.05em',
                }}>{expCode}</span>
                <span style={{ fontSize: 13, color: mInk }}>{expName}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {paramEntries.slice(0, 4).map(([k, v]) => (
                  <span key={k} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11.5, color: mText2,
                    padding: '2px 8px', borderRadius: 6, background: mBgSoft,
                    border: `1px solid ${mLineSft}`,
                  }}>{k} <strong style={{ color: mInk }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong></span>
                ))}
                {paramEntries.length > 4 && (
                  <span style={{ fontSize: 11.5, color: mMuted, alignSelf: 'center' }}>+{paramEntries.length - 4} more</span>
                )}
                {paramEntries.length === 0 && (
                  <span style={{ fontSize: 12, color: mMuted, fontStyle: 'italic' }}>No parameters</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => openEdit(rec)} disabled={busyDeleteId === rec.id} style={{
                  background: 'transparent', border: 'none',
                  cursor: busyDeleteId === rec.id ? 'not-allowed' : 'pointer',
                  color: mAccent, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', padding: 0,
                  opacity: busyDeleteId === rec.id ? 0.5 : 1,
                }}>Edit</button>
                <button onClick={() => onDelete(rec)} disabled={busyDeleteId === rec.id} style={{
                  background: 'transparent', border: 'none',
                  cursor: busyDeleteId === rec.id ? 'not-allowed' : 'pointer',
                  color: '#b9384a', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', padding: 0,
                  opacity: busyDeleteId === rec.id ? 0.5 : 1,
                }}>{busyDeleteId === rec.id ? 'Deleting…' : 'Delete'}</button>
              </div>
            </div>
          );
        })}
      </div>

      <RecipeModal
        open={modalOpen}
        onClose={closeModal}
        initial={editing}
        onSaved={onSaved}
      />
    </Page>
  );
};

// ── Reports page ──────────────────────────────────────────────
// `onGenerate` is async and returns either an array of {label, value}
// rows (rendered as a 3-up summary) or {error: 'message'} which surfaces
// in a red banner inside the card.
const ReportCard = ({ title, subtitle, accent, accentBg, icon, onGenerate }) => {
  const [start, setStart] = mS('');
  const [end, setEnd] = mS('');
  const [generated, setGenerated] = mS(null);
  const [busy, setBusy] = mS(false);
  const [err, setErr] = mS(null);
  const valid = start && end;
  const handle = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const summary = await onGenerate({ start, end });
      setGenerated(summary);
    } catch (e) {
      setErr(e.message || String(e));
      setGenerated(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding={0}>
      <CardHeader>
        <span style={{
          width: 26, height: 26, borderRadius: 8, background: accentBg,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{React.cloneElement(icon, { color: accent })}</span>
        <span style={{ color: mInk, fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>{title}</span>
      </CardHeader>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 12.5, color: mText2, marginBottom: 14 }}>{subtitle}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)}/>
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <TextInput type="date" value={end} onChange={(e) => setEnd(e.target.value)}/>
          </div>
        </div>
        <PrimaryBtn disabled={!valid || busy} onClick={handle} icon={<MI.TrendUp size={14}/>}>{busy ? 'Generating…' : 'Generate'}</PrimaryBtn>
        {err && (
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8,
            background: '#fde4e4', color: '#c0394a', fontSize: 13, fontWeight: 500,
            border: '1px solid #f6c4c4',
          }}>{err}</div>
        )}
        {generated && (
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 10,
            background: accentBg, border: `1px solid ${accent}33`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Result</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {generated.map(g => (
                <div key={g.label}>
                  <div style={{ fontSize: 11, color: mText2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{g.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: mInk, letterSpacing: '-0.01em', marginTop: 4 }}>{g.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

const MgrReports = () => {
  // Backend `EquipmentUtilizationOut` returns `{period, start_date, end_date,
  // data: [{equipment: {id, name}, wip_count, sample_count}]}`. Collapse to
  // the 3-up summary the card layout expects: units covered, total WIPs
  // recorded across them, total sample-runs through.
  const equipmentReport = async ({ start, end }) => {
    const out = await window.api.reports.equipmentUtilization({
      period: 'custom', start_date: start, end_date: end,
    });
    const totalWips = (out.data || []).reduce((s, e) => s + (e.wip_count || 0), 0);
    const totalSamples = (out.data || []).reduce((s, e) => s + (e.sample_count || 0), 0);
    return [
      { label: 'Units covered', value: (out.data || []).length },
      { label: 'Total WIPs',    value: totalWips },
      { label: 'Sample runs',   value: totalSamples },
    ];
  };
  // Backend `RequestStatisticsOut` returns `{period, status_distribution: {...},
  // average_tat_hours, total_requests}`. The mock surface focused on Submitted
  // / Approved / Rejected; keep that shape but pull the numbers from the live
  // status_distribution map.
  const requestReport = async ({ start, end }) => {
    const out = await window.api.reports.requestStatistics({
      start_date: start, end_date: end,
    });
    const dist = out.status_distribution || {};
    const approvedLike = (dist.approved || 0) + (dist.sample_shipped || 0) + (dist.in_progress || 0) + (dist.completed || 0) + (dist.closed || 0);
    return [
      { label: 'Total',    value: out.total_requests ?? 0 },
      { label: 'Approved', value: approvedLike },
      { label: 'Rejected', value: dist.rejected || 0 },
    ];
  };

  return (
    <Page
      title="Reports"
      subtitle="報表 — generate equipment utilization and request statistics"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <ReportCard
          title="Equipment Utilization"
          subtitle="Per-equipment WIP + sample counts across the window."
          accent="#2563eb" accentBg="#dbeafe"
          icon={<MI.TrendUp size={14}/>}
          onGenerate={equipmentReport}
        />
        <ReportCard
          title="Request Statistics"
          subtitle="Total / approved / rejected requests in the window."
          accent="#157a4a" accentBg="#c8eedd"
          icon={<MI.ClipboardList size={14}/>}
          onGenerate={requestReport}
        />
      </div>
    </Page>
  );
};

// ── Dashboard (manager) ───────────────────────────────────────
// Lab-dashboard–style tiles + an "Awaiting your Response" queue of
// submitted requests so the manager can drop straight into the approval flow.
const MgrStatTile = ({ label, value, icon, tint, accent, onClick }) => (
  <button onClick={onClick} disabled={!onClick} style={{
    position: 'relative', textAlign: 'left', padding: '16px 18px',
    borderRadius: 14, background: '#fff',
    border: `1px solid ${mLine}`, cursor: onClick ? 'pointer' : 'default',
    fontFamily: 'inherit', overflow: 'hidden',
    transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
  }}
    onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = 'rgba(108,103,184,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px -14px rgba(108,103,184,0.35)'; } }}
    onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.borderColor = mLine; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{
        width: 30, height: 30, borderRadius: 9, background: tint,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{React.cloneElement(icon, { color: accent })}</span>
      <span style={{ fontSize: 12, color: mText2, fontWeight: 600 }}>{label}</span>
    </div>
    <div style={{
      fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700,
      color: mInk, letterSpacing: '-0.02em', lineHeight: 1,
    }}>{value}</div>
  </button>
);

// ── Resource utilization / capacity trend ──────────────────────
// Dual-line area chart: daily dispatch volume (blue) + average equipment
// utilization (violet). Data is synthesized — seeded from request submitted
// dates so peaks line up with the demo data.
const DEMO_TODAY = '2026-05-19';
const ymd = (s) => s;
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (s, n) => {
  const d = new Date(s);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Catmull-Rom → cubic Bezier smoothing for the chart lines.
const smoothPath = (pts) => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
};

const TrendChart = () => {
  // Backend `/reports/trends` is `days`-based, not range-based — drop the
  // date pickers in favor of a fixed 30-day rolling window.
  const { data: trend, loading, error } = useMgrTrend('requests_per_day', 30);

  // Derive the chart series. `days` is an array of {date, dispatches,
  // utilization}; "utilization" is a smoothed multiplier of the count
  // (kept from the mock UI for the two-line visual — gap §4's trends
  // endpoint only ships request volume, not real equipment usage).
  const days = mM(() => {
    const points = trend?.points || [];
    const arr = points.map(p => ({ date: p.date, dispatches: p.count }));
    for (let i = 0; i < arr.length; i++) {
      const prev = i > 0 ? arr[i - 1].dispatches : 0;
      arr[i].utilization = Math.min(100, (arr[i].dispatches * 0.6 + prev * 0.4) * 24);
    }
    return arr;
  }, [trend]);

  if (loading && !trend) {
    return (
      <Card padding={22} style={{ marginTop: 18, textAlign: 'center', color: mMuted, fontSize: 13 }}>
        Loading trend…
      </Card>
    );
  }
  if (error) {
    return (
      <Card padding={22} style={{ marginTop: 18 }}>
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>Couldn't load trend: {error}</div>
      </Card>
    );
  }
  if (days.length === 0) {
    return (
      <Card padding={22} style={{ marginTop: 18, textAlign: 'center', color: mMuted, fontSize: 13 }}>
        No trend data yet.
      </Card>
    );
  }

  const maxDispatches = Math.max(1, ...days.map(d => d.dispatches));
  const W = 880, H = 220, PL = 36, PR = 56, PT = 24, PB = 36;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;
  const x = (i) => PL + (days.length === 1 ? chartW / 2 : (i / (days.length - 1)) * chartW);
  const yDispatch = (v) => PT + chartH - (v / maxDispatches) * chartH;
  const yUtil = (v) => PT + chartH - (v / 100) * chartH;

  const dispatchPts = days.map((d, i) => [x(i), yDispatch(d.dispatches)]);
  const utilPts = days.map((d, i) => [x(i), yUtil(d.utilization)]);
  const dispatchPath = smoothPath(dispatchPts);
  const utilPath = smoothPath(utilPts);
  // Area-fill versions close the curve down to the baseline.
  const baselineY = PT + chartH;
  const areaPath = (pts) => pts.length
    ? smoothPath(pts) + ` L ${pts[pts.length-1][0]},${baselineY} L ${pts[0][0]},${baselineY} Z`
    : '';

  // X-axis tick labels — show ~every other day if range is dense, else all.
  const tickStep = days.length > 14 ? Math.ceil(days.length / 8) : 2;
  const ticks = days.map((d, i) => ({ i, label: d.date.slice(5).replace('-', '/'), show: i === 0 || i === days.length - 1 || i % tickStep === 0 }));

  return (
    <Card padding={0} style={{ marginTop: 18 }}>
      <div style={{
        padding: '18px 22px', borderBottom: `1px solid ${mLineSft}`,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#6c67b8', boxShadow: '0 0 10px rgba(108,103,184,0.45)' }}/>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: mInk, letterSpacing: '-0.01em' }}>資源利用 / 產能趨勢</div>
          <div style={{ fontSize: 12, color: mMuted, marginTop: 2 }}>設備稼動率與每日派工量</div>
        </div>
        <div style={{
          marginLeft: 'auto', fontSize: 12, color: mMuted, fontWeight: 600,
          padding: '6px 12px', borderRadius: 999, background: mBgSoft, border: `1px solid ${mLineSft}`,
        }}>Last {trend?.days ?? 30} days</div>
      </div>

      <div style={{ padding: '14px 22px 20px' }}>
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, marginBottom: 4, fontSize: 12, color: mText2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid #2563eb', background: '#fff' }}/>
            每日派工量
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid #6c67b8', background: '#fff' }}/>
            設備稼動率 (%)
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="dispFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#2563eb" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="utilFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#6c67b8" stopOpacity="0.16"/>
              <stop offset="100%" stopColor="#6c67b8" stopOpacity="0"/>
            </linearGradient>
          </defs>

          {/* Horizontal gridlines (every 10% on the utilization axis) */}
          {[0, 20, 40, 60, 80, 100].map(p => {
            const yy = yUtil(p);
            return (
              <g key={p}>
                <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#eef0f4" strokeWidth="1"/>
                <text x={W - PR + 6} y={yy + 4} fontSize="10.5" fill="#8e8ea0" fontFamily="var(--font-mono)">{p}%</text>
              </g>
            );
          })}
          {/* Left y-axis: dispatches */}
          {[0, maxDispatches].map((v, i) => (
            <text key={i} x={PL - 8} y={yDispatch(v) + 4} fontSize="10.5" fill="#8e8ea0" textAnchor="end" fontFamily="var(--font-mono)">{v}</text>
          ))}

          {/* Areas */}
          <path d={areaPath(dispatchPts)} fill="url(#dispFill)"/>
          <path d={areaPath(utilPts)}     fill="url(#utilFill)"/>
          {/* Lines */}
          <path d={dispatchPath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          <path d={utilPath}     fill="none" stroke="#6c67b8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

          {/* X-axis ticks */}
          {ticks.map(t => t.show && (
            <text key={t.i} x={x(t.i)} y={H - PB + 18} fontSize="10.5" fill="#8e8ea0" textAnchor="middle" fontFamily="var(--font-mono)">{t.label}</text>
          ))}
        </svg>
      </div>
    </Card>
  );
};

const MgrDashboard = ({ navigate }) => {
  const { requests, equipmentCount, loading: countsLoading, error: countsError } = useMgrDashboardData();
  const pending = requests.filter(r => r.status === 'submitted');
  const inProgress = requests.filter(r => r.status === 'in_progress').length;
  const completed = requests.filter(r => r.status === 'completed').length;

  // Show "—" while the initial fetch is in flight rather than the
  // misleading "0" that an empty filter would produce.
  const initialLoad = countsLoading && requests.length === 0;
  const v = (n) => initialLoad ? '—' : n;

  return (
    <Page
      title="Dashboard"
      subtitle="Welcome back, lab_manager"
    >
      {countsError && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          Couldn't load tile counts: {countsError}
        </div>
      )}
      {/* To approve first \u2014 it's the manager's primary action. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <MgrStatTile
          label="To approve" value={v(pending.length)}
          icon={<MI.Clock size={16}/>} tint="#fef0d4" accent="#b8720e"
          onClick={() => navigate({ page: 'mgr_all_requests' })}
        />
        <MgrStatTile
          label="In Progress" value={v(inProgress)}
          icon={<MI.Activity size={16}/>} tint="#ecebf3" accent="#5550a0"
          onClick={() => navigate({ page: 'mgr_all_requests' })}
        />
        <MgrStatTile
          label="Completed" value={v(completed)}
          icon={<MI.CircleCheck size={16}/>} tint="#dbeafe" accent="#1d4ed8"
        />
        <MgrStatTile
          label="Equipment" value={v(equipmentCount)}
          icon={<MI.Equipment size={16}/>} tint="#ecebf3" accent="#4f4a8f"
          onClick={() => navigate({ page: 'lab_equipment' })}
        />
      </div>

      <Card padding={0} style={{
        borderColor: 'rgba(108,103,184,0.32)',
        boxShadow: '0 8px 28px -18px rgba(108,103,184,0.45)',
      }}>
        <CardHeader style={{
          background: 'linear-gradient(90deg, rgba(244,168,191,0.12), rgba(187,183,232,0.12))',
        }}>
          <MI.ClipboardList size={13} color={mAccent}/>
          <span>Awaiting your Response</span>
          <span style={{
            marginLeft: 'auto', padding: '2px 8px', borderRadius: 999,
            background: '#ecebf3', color: '#4f4a8f', fontSize: 11, fontWeight: 700,
          }}>{pending.length}</span>
        </CardHeader>
        {pending.length === 0 ? (
          <div style={{ padding: '28px 22px', textAlign: 'center', color: mMuted, fontSize: 13 }}>
            All clear — nothing waiting on you.
          </div>
        ) : pending.map(r => (
          <button key={r.id} onClick={() => navigate({ page: 'mgr_request', id: r.id })} style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 110px 130px auto',
            alignItems: 'center', gap: 14, width: '100%',
            padding: '14px 22px', borderTop: `1px solid ${mLineSft}`,
            background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'inherit', transition: 'background 0.12s',
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fafafd'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: mMuted }}>
              #{String(r.id).padStart(4, '0')}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: mInk }}>{r.title}</div>
              <div style={{ fontSize: 12, color: mMuted, marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
                <MI.Calendar size={11}/>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{(r.submitted || r.created || '').split(' ')[0] || '—'}</span>
                <span aria-hidden>·</span>
                <span>{(r.sampleCount ?? r.samples.length)} wafer{(r.sampleCount ?? r.samples.length) === 1 ? '' : 's'}</span>
                <span aria-hidden>·</span>
                <span>by <span style={{ fontFamily: 'var(--font-mono)', color: mText2 }}>{r.requester?.username || r.history[0]?.by || '—'}</span></span>
              </div>
            </div>
            <Pill kind={r.urgency} mapping={URGENCY_LABEL}/>
            <Pill kind={r.status}/>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: mAccent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Respond <MI.ArrowRight size={12} color={mAccent}/>
            </span>
          </button>
        ))}
      </Card>

      <TrendChart/>
    </Page>
  );
};

// ── Root container ────────────────────────────────────────────
const MgrApp = ({ route, navigate }) => {
  const [requests, setRequests] = mS(MGR_REQUEST_SEED);
  const [recipes, setRecipes] = mS(MGR_RECIPE_SEED);
  const [toast, setToast] = mS(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

  const onAction = (id, action, reason) => {
    const at = now();
    setRequests(rs => rs.map(r => {
      if (r.id !== id) return r;
      const nextStatus =
        action === 'APPROVE'  ? 'in_progress' :
        action === 'RETURN'   ? 'returned'    :
        action === 'COMPLETE' ? 'completed'   :
                                'rejected';
      return {
        ...r,
        status: nextStatus,
        history: [...r.history, { action, by: 'lab_manager', at, note: reason || '' }],
      };
    }));
    showToast(`#${id} ${action.toLowerCase()}d`);
  };

  const createRecipe = (rec) => { setRecipes(rs => [rec, ...rs]); showToast('Recipe created'); };
  const updateRecipe = (rec) => { setRecipes(rs => rs.map(x => x.id === rec.id ? rec : x)); showToast('Recipe updated'); };
  const deleteRecipe = (id) => { setRecipes(rs => rs.filter(x => x.id !== id)); showToast('Recipe deleted'); };

  let page = null;
  const p = route.page;
  if (p === 'mgr_dashboard')      page = <MgrDashboard navigate={navigate}/>;
  else if (p === 'mgr_all_requests') page = <MgrAllRequests navigate={navigate}/>;
  else if (p === 'mgr_request')   page = <MgrRequestDetail id={route.id} navigate={navigate} showToast={showToast}/>;
  else if (p === 'mgr_recipes')   page = <MgrRecipes showToast={showToast}/>;
  else if (p === 'mgr_reports')   page = <MgrReports/>;
  else page = <MgrDashboard navigate={navigate}/>;

  return (
    <>
      {page}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: 10,
          background: mInk, color: '#fff', fontSize: 14, fontWeight: 500,
          boxShadow: '0 12px 36px rgba(20,20,28,0.32)',
          animation: 'slide-in 0.18s ease-out', zIndex: 300,
        }}>{toast}</div>
      )}
    </>
  );
};

window.MgrApp = MgrApp;
window.MGR_REQUEST_SEED = MGR_REQUEST_SEED;
})();
