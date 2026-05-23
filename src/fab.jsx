(function () {
// Fab user (廠區使用者) — Dashboard, My Requests, Drafts, New Request, Detail.
// Theme: shared lavender/pink night-sky (no blue corporate fork).
// Layout matches the dashboard / my-requests / new-request screenshots:
//  - Stat tiles with a big number in a tinted square on the left
//  - "Needs Attention" + "Request Status Breakdown" two-up row
//  - "In Progress" table card
//  - "Recent Activity" card
//  - My Requests = tab-strip + filter bar + card-per-request rows (with workflow dots)
//  - New Request = numbered sections + summary rail + bottom action bar

const { useState: uS, useMemo: uM } = React;
const F = window.I;        // icons
const FUI = window.UI;     // primitives (FlowDots, etc.)

// ── Mock requests data ─────────────────────────────────────────
const RA_EXPERIMENTS = [
  { id: 'tct',  name: 'Temperature Cycling Test', short: 'TCT',  cn: '溫度循環測試',
    desc: 'Cycle between hot and cold extremes to find solder & TSV fatigue.' },
  { id: 'hast', name: 'HAST',                     short: 'HAST', cn: '高加速應力測試',
    desc: 'Accelerated moisture stress at 85 °C / 85 %RH with bias.' },
  { id: 'btc',  name: 'Bias Temperature Cycling', short: 'BTC',  cn: '電壓溫度循環',
    desc: 'Voltage stress combined with temperature swings.' },
];
const TM_EXPERIMENTS = [
  { id: 'cp',   name: 'Circuit Probing', short: 'CP', cn: '晶圓針測',
    desc: 'Wafer-level functional probe — sort dies by parametric pass/fail.' },
  { id: 'ft',   name: 'Final Test',      short: 'FT', cn: '成品測試',
    desc: 'Packaged-part functional test prior to shipment.' },
];
const ALL_EXPERIMENTS = [...RA_EXPERIMENTS.map(e => ({ ...e, group: 'RA' })),
                         ...TM_EXPERIMENTS.map(e => ({ ...e, group: 'TM' }))];

const URGENCY_OPTS = [
  { id: '3d',  label: '3 Days', sub: 'Rush — extra fee' },
  { id: '1w',  label: '1 Week', sub: 'Standard' },
  { id: '2w',  label: '2 Weeks', sub: 'Flexible' },
];

// Live experiment-type catalogue (TCT, HAST, CP, FT, BTC, …). The id is an
// integer assigned by the backend; the frontend's old hardcoded list used
// string slugs which the new-request flow no longer touches.
const useExperimentTypes = () => {
  const [data, setData] = uS([]);
  const [loading, setLoading] = uS(true);
  const [error, setError] = uS(null);
  React.useEffect(() => {
    if (!window.api || !window.api.experimentTypes) {
      setLoading(false);
      return;
    }
    window.api.experimentTypes.list()
      .then(rs => { setData(rs); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading, error };
};

// Live request list fetched from the backend via window.api.requests.list().
// Dashboard and My Requests each call this independently — sharing the fetch
// isn't a goal; one fetch on mount per consumer is acceptable for v1.
const useRequests = () => {
  const [data, setData] = uS([]);
  const [loading, setLoading] = uS(true);
  const [error, setError] = uS(null);
  const refresh = React.useCallback(() => {
    if (!window.api || !window.api.requests) {
      setLoading(false);
      return;
    }
    setLoading(true);
    window.api.requests.list()
      .then(rs => { setData(rs); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
};

// Detail fetch for a single request (used by FabRequestDetail). Exposes
// `refresh` so state-machine actions (cancel) can refetch in place rather
// than navigate away.
const useRequestDetail = (id) => {
  const [data, setData] = uS(null);
  const [loading, setLoading] = uS(true);
  const [error, setError] = uS(null);
  const refresh = React.useCallback(() => {
    if (id == null || !window.api || !window.api.requests) {
      setLoading(false);
      return;
    }
    setLoading(true);
    window.api.requests.get(id)
      .then(r => { setData(r); setError(null); })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [id]);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
};

// TODO: drop once offline mode is removed — the standalone single-file demo
// still consumes this as a fallback dataset. The dev build now uses
// useRequests() above instead.
const REQUEST_SEED = [
  // Two fresh submissions waiting on lab_manager approval — show up in the
  // dashboard's "Waiting Approval" tile and in the manager's All Requests view.
  { id: 22, title: 'HAST 0509001',         status: 'submitted',   urgency: '3d',  expIds: ['hast'],
    samples: [{ wafer: 'W0509A', size: '300mm', status: 'pending' }],
    note: 'Critical reliability batch — requested expedited turnaround.',
    created: '2026-05-09 08:14', submitted: '2026-05-09 08:14',
    history: [] },
  { id: 21, title: 'TCT 0508004',          status: 'submitted',   urgency: '1w',  expIds: ['tct'],
    samples: [
      { wafer: 'W050801', size: '200mm', status: 'pending' },
      { wafer: 'W050802', size: '200mm', status: 'pending' },
    ], note: '', created: '2026-05-08 14:30', submitted: '2026-05-08 14:31',
    history: [] },
  { id: 14, title: 'TCT 041501',           status: 'in_progress', urgency: '3d',  expIds: ['tct'],
    samples: [{ wafer: 'W041501', size: '200mm', status: 'received' }],
    note: '', created: '2026-04-15 13:03', submitted: '2026-04-15 13:03',
    history: [{ action: 'APPROVE', by: 'ccf', at: '2026-04-15 13:03' }] },
  { id: 13, title: 'TCT 0415002',          status: 'draft',       urgency: '1w',  expIds: ['tct'],
    samples: [{ wafer: 'W0415002', size: '200mm', status: 'pending' }],
    note: 'Bench retest after recipe update.', created: '2026-04-15 09:42', submitted: null, history: [] },
  { id: 12, title: 'TCT 0415001',          status: 'cancelled',   urgency: '1w',  expIds: ['tct'],
    samples: [{ wafer: 'W0415001', size: '200mm', status: 'cancelled' }],
    note: '', created: '2026-04-15 08:30', submitted: '2026-04-15 08:32',
    history: [{ action: 'CANCEL', by: 'fab_user', at: '2026-04-15 08:55' }] },
  { id: 11, title: 'Testing_temperature_flow', status: 'in_progress', urgency: '2w', expIds: ['tct', 'hast'],
    samples: [{ wafer: 'W041201', size: '300mm', status: 'received' }],
    note: 'Long flow validation.', created: '2026-04-12 16:11', submitted: '2026-04-12 16:14',
    history: [{ action: 'APPROVE', by: 'ccf', at: '2026-04-12 17:02' }] },
  { id: 10, title: 'TCT 0408006',          status: 'in_progress', urgency: '1w',  expIds: ['tct'],
    samples: [
      { wafer: 'W040801', size: '200mm', status: 'received' },
      { wafer: 'W040802', size: '200mm', status: 'received' },
    ], note: '', created: '2026-04-12 11:08', submitted: '2026-04-12 11:09',
    history: [{ action: 'APPROVE', by: 'ccf', at: '2026-04-12 12:00' }] },
  { id: 9,  title: 'TCT 0408005',          status: 'cancelled',   urgency: '1w',  expIds: ['tct'],
    samples: [{ wafer: 'W040805', size: '200mm', status: 'cancelled' }],
    created: '2026-04-12 09:14', submitted: '2026-04-12 09:15',
    history: [{ action: 'CANCEL', by: 'fab_user', at: '2026-04-12 10:01' }] },
  { id: 8,  title: 'TCT 0408005',          status: 'in_progress', urgency: '3d',  expIds: ['tct', 'cp'],
    samples: [{ wafer: 'W040805B', size: '200mm', status: 'received' }],
    created: '2026-04-12 08:50', submitted: '2026-04-12 08:51',
    history: [{ action: 'APPROVE', by: 'ccf', at: '2026-04-12 09:30' }] },
  { id: 7,  title: 'TCT 0408005',          status: 'returned',    urgency: '1w',  expIds: ['tct'],
    samples: [{ wafer: 'W040805C', size: '200mm', status: 'returned' }],
    note: 'Returned — wrong recipe specified.',
    created: '2026-04-12 08:10', submitted: '2026-04-12 08:11',
    history: [{ action: 'RETURN', by: 'lab_manager', at: '2026-04-12 08:40', note: 'Recipe parameter missing' }] },
  { id: 6,  title: 'TCT 0408004',          status: 'cancelled',   urgency: '2w',  expIds: ['tct'],
    samples: [{ wafer: 'W040804', size: '200mm', status: 'cancelled' }],
    created: '2026-04-08 15:22', submitted: '2026-04-08 15:23',
    history: [{ action: 'CANCEL', by: 'fab_user', at: '2026-04-08 16:00' }] },
  { id: 5,  title: 'TCT 0408003',          status: 'rejected',    urgency: '1w',  expIds: ['tct'],
    samples: [
      { wafer: 'W040803A', size: '300mm', status: 'rejected' },
      { wafer: 'W040803B', size: '300mm', status: 'rejected' },
    ], created: '2026-04-08 13:00', submitted: '2026-04-08 13:01',
    history: [{ action: 'REJECT', by: 'lab_manager', at: '2026-04-08 14:20', note: 'Insufficient sample budget' }] },
  { id: 4,  title: 'TCT 0408002',          status: 'cancelled',   urgency: '2w',  expIds: ['tct'],
    samples: [{ wafer: 'W040802R', size: '200mm', status: 'cancelled' }],
    created: '2026-04-08 11:00', submitted: '2026-04-08 11:01',
    history: [{ action: 'CANCEL', by: 'fab_user', at: '2026-04-08 11:40' }] },
  { id: 3,  title: 'TCT 0408001',          status: 'in_progress', urgency: '1w',  expIds: ['tct'],
    samples: [{ wafer: 'W040801R', size: '200mm', status: 'received' }],
    created: '2026-04-08 09:30', submitted: '2026-04-08 09:31',
    history: [{ action: 'APPROVE', by: 'ccf', at: '2026-04-08 10:14' }] },
];

// ── Status / urgency pills ────────────────────────────────────
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
  '3d': { label: '3 Days', bg: '#e6f1f5', fg: '#2a7a91' },
  '1w': { label: '1 Week', bg: '#e8e7f6', fg: '#5550a0' },
  '2w': { label: '2 Weeks', bg: '#ebebf0', fg: '#5a5a6e' },
};
const SAMPLE_STATUS_LABEL = {
  pending:    { label: 'Pending',    bg: '#fef0d4', fg: '#b8720e' },
  received:   { label: 'Received',   bg: '#c8eedd', fg: '#157a4a' },
  returned:   { label: 'Returned',   bg: '#f9d7e0', fg: '#a73d56' },
  rejected:   { label: 'Rejected',   bg: '#fde4e4', fg: '#c0394a' },
  cancelled:  { label: 'Cancelled',  bg: '#ebebf0', fg: '#777788' },
};
const Pill = ({ label, bg, fg, size = 'md', dot }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: dot ? 6 : 0, justifyContent: 'center',
    padding: size === 'sm' ? '3px 9px' : '4px 11px',
    borderRadius: 999, background: bg, color: fg,
    fontSize: size === 'sm' ? 11 : 12, fontWeight: 600, letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  }}>
    {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: fg }}/>}
    {label}
  </span>
);
const StatusPill = ({ status, size = 'md' }) => {
  const m = STATUS_LABEL[status] || { label: status, bg: '#ebebf0', fg: '#5a5a6e' };
  return <Pill {...m} size={size}/>;
};
const UrgencyPill = ({ urgency, size = 'sm' }) => {
  const m = URGENCY_LABEL[urgency] || URGENCY_LABEL['1w'];
  return <Pill {...m} size={size}/>;
};
const SamplePill = ({ status, size = 'sm' }) => {
  const m = SAMPLE_STATUS_LABEL[status] || { label: status, bg: '#ebebf0', fg: '#5a5a6e' };
  return <Pill {...m} size={size}/>;
};

// ── Workflow dots: 4-stage pipeline based on wafer state ──────────
// Stages: Approved → Shipped → In Progress → Done. Returned /
// rejected / cancelled fall onto the aborted track (red). Submitted
// requests still awaiting approval render with every dot grey.
const WORKFLOW_STEPS = ['approved', 'shipped', 'in_progress', 'done'];
const WORKFLOW_LABELS = ['Approved', 'Shipped', 'In Progress', 'Done'];
const stepFromRequest = (r) => {
  if (r.status === 'draft' || r.status === 'cancelled' ||
      r.status === 'rejected' || r.status === 'returned') {
    return { aborted: true, status: r.status };
  }
  // Pre-approval: no dot is lit. FlowDots renders all-grey when the
  // `current` value isn't in `steps`.
  const raw = r.rawStatus || r.status;
  if (raw === 'submitted' || raw === 'pending_approval') {
    return { idx: -1 };
  }
  if (r.status === 'completed' || raw === 'completed' || raw === 'closed') return { idx: 3 };

  const samples = r.samples || [];
  // Detail view — samples are populated, so we can do per-wafer fine
  // splitting (Shipped if any received-not-yet-processing, In Progress
  // once anything's processing).
  if (samples.length > 0) {
    const allDone = samples.every(s => s.status === 'completed');
    if (allDone) return { idx: 3 };
    const anyProcessing = samples.some(s =>
      s.status === 'processing' || s.status === 'in_wip' || s.status === 'completed'
    );
    if (anyProcessing) return { idx: 2 };
    const anyShipped = samples.some(s =>
      s.raw_status === 'shipped' || s.status === 'received' || s.raw_status === 'received'
    );
    if (anyShipped) return { idx: 1 };
    return { idx: 0 };
  }
  // List view fallback — RequestListOut doesn't include samples, so we
  // drive the dot off the raw backend status. FE REQUEST_STATUS_MAP
  // collapses approved + sample_shipped + in_progress + exception to
  // the same FE value, but rawStatus is preserved so we can split.
  if (raw === 'approved') return { idx: 0 };
  if (raw === 'sample_shipped') return { idx: 1 };
  if (raw === 'in_progress' || raw === 'exception') return { idx: 2 };
  return { idx: 0 };
};
const RequestFlow = ({ request, label = false }) => {
  const s = stepFromRequest(request);
  if (s.aborted) {
    const colors = {
      draft:     { dot: '#a8a8b8', text: 'Draft' },
      cancelled: { dot: '#a8a8b8', text: 'Cancelled' },
      rejected:  { dot: '#c0394a', text: 'Rejected' },
      returned:  { dot: '#a73d56', text: 'Returned' },
    }[s.status] || { dot: '#a8a8b8', text: s.status };
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {[0,1,2,3].map(i => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: 999,
              background: i === 0 ? colors.dot : 'rgba(0,0,0,0.09)',
              opacity: i === 0 ? 0.7 : 1,
            }}/>
          ))}
        </span>
        {label && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{colors.text}</span>}
      </span>
    );
  }
  const idx = s.idx;
  // Pre-approval renders every dot grey by passing a `current` value
  // that isn't in WORKFLOW_STEPS (FlowDots short-circuits to indexOf=-1).
  const current = idx >= 0 ? WORKFLOW_STEPS[idx] : null;
  const labelText = idx >= 0 ? WORKFLOW_LABELS[idx] : 'Awaiting approval';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <FUI.FlowDots
        steps={WORKFLOW_STEPS}
        current={current}
        size={6} gap={4}
        doneColor="#6c67b8"
        currentColor="#6c67b8"
      />
      {label && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{labelText}</span>}
    </span>
  );
};

// ── Page chrome ────────────────────────────────────────────────
const FabPage = ({ title, subtitle, breadcrumb, right, children }) => (
  <div style={{ padding: '32px 44px 80px', maxWidth: 1280, margin: '0 auto' }}>
    {breadcrumb}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>{title}</h1>
        {subtitle && <div style={{ marginTop: 6, fontSize: 14, color: 'var(--text-secondary)' }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>{right}</div>}
    </div>
    {children}
  </div>
);

const FabCard = ({ children, padding = 22, style }) => (
  <div style={{
    background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.07)',
    padding, boxShadow: '0 1px 2px rgba(30,30,36,0.03)',
    ...style,
  }}>{children}</div>
);

const SectionLabel = ({ children, style }) => (
  <div style={{
    fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
    ...style,
  }}>{children}</div>
);

const PrimaryBtn = ({ children, onClick, type = 'button', icon, disabled, style }) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '11px 18px', borderRadius: 10,
    background: disabled ? '#cbcbd6' : '#1e1e24',
    color: '#fff', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
    transition: 'background 0.12s', cursor: disabled ? 'not-allowed' : 'pointer',
    ...style,
  }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#2d2d38'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = '#1e1e24'; }}
  >
    {icon}{children}
  </button>
);
const SecondaryBtn = ({ children, onClick, icon, style, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', borderRadius: 10,
    background: '#fff', color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 600, fontSize: 14,
    border: '1px solid rgba(0,0,0,0.16)', transition: 'background 0.12s',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    ...style,
  }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#f8f8fb'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = '#fff'; }}
  >{icon}{children}</button>
);
const DangerBtn = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    background: '#fff', color: '#c0394a', fontWeight: 600, fontSize: 13,
    border: '1px solid #f4c8c8', cursor: 'pointer',
    ...style,
  }}>{children}</button>
);

// ── Dashboard ──────────────────────────────────────────────────
// Lab-dash–style stat tile: tinted icon swatch + label + big number.
const FabStatTile = ({ label, value, icon, tint, accent, onClick }) => (
  <button onClick={onClick} style={{
    position: 'relative', textAlign: 'left', padding: '16px 18px',
    borderRadius: 14, background: '#fff',
    border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer',
    fontFamily: 'inherit', overflow: 'hidden',
    transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
  }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(108,103,184,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px -14px rgba(108,103,184,0.35)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{
        width: 30, height: 30, borderRadius: 9,
        background: tint, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
      }}>{React.cloneElement(icon, { color: accent })}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
    </div>
    <div style={{
      fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700,
      color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1,
    }}>{value}</div>
  </button>
);

const StatTile = ({ label, value, accent, valueBg }) => (
  <FabCard padding={20} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{
      width: 56, height: 56, borderRadius: 12, background: valueBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700,
        color: accent, letterSpacing: '-0.02em', lineHeight: 1,
      }}>{value}</div>
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
  </FabCard>
);

// "Lab night-sky" banner header — solid dark sidebar ink, twinkle dust,
// soft accent orb. Replaces the previous bright gradient strip on each card.
const BannerHeader = ({ icon, title, count, accent, twinkle = true, right, accentLight }) => (
  <div style={{
    position: 'relative', overflow: 'hidden',
    padding: '20px 24px 18px',
    background: '#1e1e24',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  }}>
    {/* subtle dot grid like the sidebar */}
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.45,
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
      backgroundSize: '14px 14px', pointerEvents: 'none',
    }}/>
    {/* ambient accent orb — keeps each banner's color identity */}
    <div style={{
      position: 'absolute', right: -60, top: -40,
      width: 220, height: 220, borderRadius: 999,
      background: `radial-gradient(circle at center, ${accent}55, transparent 65%)`,
      filter: 'blur(6px)', pointerEvents: 'none',
    }}/>
    {twinkle && (
      <>
        <span style={{
          position: 'absolute', right: 86, top: 14, width: 3, height: 3, borderRadius: 999,
          background: accentLight || accent, opacity: 0.85,
          animation: 'lims-twinkle 3.2s ease-in-out infinite',
        }}/>
        <span style={{
          position: 'absolute', right: 158, bottom: 12, width: 3, height: 3, borderRadius: 999,
          background: '#fff', opacity: 0.55,
          animation: 'lims-twinkle 4.1s ease-in-out 0.6s infinite',
        }}/>
      </>
    )}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        width: 32, height: 32, borderRadius: 9,
        background: `${accent}33`,
        border: `1px solid ${accent}66`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{React.cloneElement(icon, { color: accentLight || accent })}</span>
      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</span>
      {count != null && (
        <span style={{
          minWidth: 24, padding: '0 8px', height: 22, borderRadius: 999,
          background: accent, color: '#1e1e24',
          fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{count}</span>
      )}
    </div>
    {right && <div style={{ position: 'relative' }}>{right}</div>}
  </div>
);

const HeaderLinkButton = ({ children, onClick, accent }) => (
  <button onClick={onClick} style={{
    fontSize: 13, fontWeight: 700, color: '#fff',
    padding: '7px 13px', borderRadius: 8,
    background: 'rgba(255,255,255,0.10)',
    border: `1px solid ${accent}55`,
    display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  }}
    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.20)'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
  >{children}</button>
);

const StatusBars = ({ requests }) => {
  const buckets = [
    { key: 'in_progress', label: 'In Progress', color: '#9ebbc8' },
    { key: 'returned',    label: 'Returned',    color: '#f4a8bf' },
    { key: 'rejected',    label: 'Rejected',    color: '#e89aa8' },
    { key: 'draft',       label: 'Draft',       color: '#a8a8b8' },
    { key: 'cancelled',   label: 'Cancelled',   color: '#888899' },
  ];
  const max = Math.max(1, ...buckets.map(b => requests.filter(r => r.status === b.key).length));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {buckets.map(b => {
        const n = requests.filter(r => r.status === b.key).length;
        const pct = (n / max) * 100;
        return (
          <div key={b.key} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 28px', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{b.label}</span>
            <div style={{ height: 8, background: '#f1f1f5', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: b.color, borderRadius: 999, transition: 'width 0.4s' }}/>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
};

// Per-wafer phase pipeline — derived from request + sample status.
// Phases: Approved → Shipped → Processing → Done.
const WAFER_PHASES = ['Approved', 'Shipped', 'Received', 'Processing', 'Done'];
const phaseIndexFor = (sample, request) => {
  // Pre-approval states: nothing in the pipeline is true yet. Returning
  // -1 tells PhasePipeline to leave every dot/connector grey. The adapter
  // collapses backend `pending_approval` → FE `submitted`, so check both
  // the rawStatus and the FE status to stay safe across call sites.
  const rawReq = request.rawStatus || request.status;
  if (rawReq === 'draft' || rawReq === 'submitted' || rawReq === 'pending_approval') return -1;
  if (request.status === 'completed' || sample.status === 'completed') return 4;
  // Processing: sample is in a non-terminal WIP, or backend split/
  // processing_exception, or backend's explicit `processing` state (set
  // once the sample enters a dispatch).
  if (sample.status === 'in_wip'
      || sample.status === 'processing'
      || sample.raw_status === 'processing'
      || sample.raw_status === 'processing_exception'
      || sample.raw_status === 'split') return 3;
  // Received: physically at the lab, not yet pulled into a WIP.
  if (sample.status === 'received' || sample.raw_status === 'received') return 2;
  // Shipped: backend marked the sample as shipped (request transitioned via /ship).
  if (sample.raw_status === 'shipped') return 1;
  // Otherwise we're approved-but-not-yet-shipped (sample still `created`/`incoming`).
  return 0;
};

const PhasePipeline = ({ idx, compact = false }) => {
  const dot = (active, done) => (
    <span style={{
      width: active ? 11 : 9, height: active ? 11 : 9, borderRadius: 999,
      background: done || active ? '#6c67b8' : '#e2e2ea',
      boxShadow: active ? '0 0 0 3px rgba(108,103,184,0.18)' : 'none',
      transition: 'all 0.2s',
      display: 'inline-block', flexShrink: 0,
    }}/>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      {WAFER_PHASES.map((p, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <React.Fragment key={p}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {dot(active, done)}
              {!compact && (
                <span style={{
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? '#6c67b8' : (done ? 'var(--text-secondary)' : 'var(--text-muted)'),
                  whiteSpace: 'nowrap',
                }}>{p}</span>
              )}
            </div>
            {i < WAFER_PHASES.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 16,
                background: i < idx ? '#6c67b8' : '#e2e2ea',
                margin: compact ? '0 2px' : '0 4px',
                marginBottom: compact ? 0 : 22,
              }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const InProgressRow = ({ request, navigate, open, onToggle }) => {
  // List endpoint doesn't carry the samples array — `request.sampleCount`
  // is the only count we have until we load the detail. The detail fetch
  // is lazy: only when the row is first opened, and cached in local state
  // so collapsing + re-opening doesn't re-hit the API.
  const sampleCount = request.sampleCount ?? request.samples?.length ?? 0;
  const [detail, setDetail] = uS(null);
  const [detailLoading, setDetailLoading] = uS(false);
  const [detailError, setDetailError] = uS(null);
  React.useEffect(() => {
    if (!open || detail || detailLoading || !window.api?.requests) return;
    setDetailLoading(true);
    setDetailError(null);
    window.api.requests.get(request.id)
      .then(d => setDetail(d))
      .catch(e => setDetailError(e.message || String(e)))
      .finally(() => setDetailLoading(false));
  }, [open, detail, detailLoading, request.id]);

  const wafers = detail?.samples || [];
  const overallIdx = wafers.length
    ? Math.min(...wafers.map(s => phaseIndexFor(s, detail || request)))
    : null;

  return (
    <div style={{ borderTop: '1px solid #f5f5f9' }}>
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: '80px 1fr 130px 130px 24px',
        padding: '14px 24px', alignItems: 'center', gap: 16,
        background: '#fff', cursor: 'pointer', transition: 'background 0.1s',
        fontFamily: 'inherit',
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#fafafd'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>#{request.id}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6c67b8' }}>{request.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Currently: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              {overallIdx == null ? '—' : (overallIdx >= 0 ? WAFER_PHASES[overallIdx] : '—')}
            </span>
          </div>
        </div>
        <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{sampleCount} wafer{sampleCount === 1 ? '' : 's'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' }}>{request.submitted ? request.submitted.split(' ')[0] : '—'}</span>
        <F.ChevronDown size={15} color="#a8a8b8" style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.18s',
        }}/>
      </button>
      {open && (
        <div style={{ padding: '4px 24px 22px', background: '#fafafd', borderTop: '1px solid #f1f1f5' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '14px 0 12px',
          }}>Wafer Phases</div>
          {detailLoading && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading wafer phases…
            </div>
          )}
          {detailError && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: '#fde4e4', color: '#c0394a', fontSize: 13, fontWeight: 500,
              border: '1px solid #f6c4c4',
            }}>{detailError}</div>
          )}
          {!detailLoading && !detailError && wafers.length === 0 && (
            <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
              No wafers on this request.
            </div>
          )}
          {wafers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {wafers.map((w, i) => {
                const idx = phaseIndexFor(w, detail || request);
                return (
                  <div key={w.id ?? i} style={{
                    display: 'grid', gridTemplateColumns: '160px 1fr',
                    alignItems: 'center', gap: 18,
                    padding: '12px 16px',
                    background: '#fff', borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{w.wafer}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{w.size}</div>
                    </div>
                    <PhasePipeline idx={idx}/>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={(e) => { e.stopPropagation(); navigate({ page: 'fab_request', id: request.id }); }} style={{
              fontSize: 13, fontWeight: 600, color: '#6c67b8',
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            }}>Open request <F.ArrowRight size={13}/></button>
          </div>
        </div>
      )}
    </div>
  );
};

const FabDashboard = ({ navigate }) => {
  const { data: requests, loading, error } = useRequests();
  const inProgress = requests.filter(r => r.status === 'in_progress').slice(0, 5);
  const drafts = requests.filter(r => r.status === 'draft');
  const attention = requests.filter(r => r.status === 'returned' || r.status === 'rejected').slice(0, 3);
  const waitingApproval = requests.filter(r => r.status === 'submitted');
  // Accordion exclusivity: only one row open at a time. `undefined` means
  // "not yet initialised" (we'll seed it with the first id once the list
  // resolves); `null` is the user-driven "collapse everything" state and
  // must persist — don't re-open the first row when that happens.
  const [expandedId, setExpandedId] = uS(undefined);
  React.useEffect(() => {
    if (expandedId === undefined && inProgress.length > 0) setExpandedId(inProgress[0].id);
  }, [inProgress, expandedId]);
  const activity = uM(() => {
    const items = [];
    requests.forEach(r => {
      r.history.forEach(h => {
        if (h.action === 'CANCEL') return; // filter noise — shows in detail history only
        if (h.action === 'APPROVE' && r.status === 'in_progress') {
          items.push({ ...h, action: 'APPROVE_DISPATCH', request: r });
        } else {
          items.push({ ...h, request: r });
        }
      });
      // Synthesize "sample received" events for in-progress requests
      if (r.status === 'in_progress' && r.submitted) {
        r.samples.filter(s => s.status === 'received').forEach((s, i) => {
          // Stagger the synthetic timestamp slightly after submitted so it sorts naturally
          const at = r.submitted;
          items.push({ action: 'RECEIVE', by: 'lab', at, sample: s, request: r });
        });
      }
    });
    return items.sort((a,b) => b.at.localeCompare(a.at)).slice(0, 5);
  }, [requests]);

  if (loading && requests.length === 0) {
    return (
      <FabPage
        title="Dashboard"
        subtitle="Welcome back, fab_user"
        right={<PrimaryBtn icon={<F.Plus size={16}/>} onClick={() => navigate({ page: 'fab_new' })}>New Request</PrimaryBtn>}
      >
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading…
        </div>
      </FabPage>
    );
  }

  return (
    <FabPage
      title="Dashboard"
      subtitle="Welcome back, fab_user"
      right={<PrimaryBtn icon={<F.Plus size={16}/>} onClick={() => navigate({ page: 'fab_new' })}>New Request</PrimaryBtn>}
    >
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          Failed to load requests: {error}
        </div>
      )}
      {/* Top stat tiles — mirrors the lab dashboard's quick counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <FabStatTile
          label="Waiting Approval" value={waitingApproval.length}
          icon={<F.Clock size={16}/>} tint="#fef0d4" accent="#b8720e"
          onClick={() => navigate({ page: 'fab_requests', tab: 'all' })}
        />
        <FabStatTile
          label="In Progress" value={inProgress.length}
          icon={<F.Activity size={16}/>} tint="#ecebf3" accent="#5550a0"
          onClick={() => navigate({ page: 'fab_requests', tab: 'in_progress' })}
        />
        <FabStatTile
          label="Needs Attention" value={attention.length}
          icon={<F.CircleAlert size={16}/>} tint="#fceef2" accent="#a73d56"
          onClick={() => navigate({ page: 'fab_requests', tab: 'returned' })}
        />
        <FabStatTile
          label="Drafts" value={drafts.length}
          icon={<F.FilePlus size={16}/>} tint="#e3eef3" accent="#2a7a91"
          onClick={() => navigate({ page: 'fab_drafts' })}
        />
      </div>

      {/* In Progress — moved to top, expandable rows with per-wafer phase pipelines */}
      <FabCard padding={0} style={{ marginBottom: 18, overflow: 'hidden' }}>
        <BannerHeader
          icon={<F.Activity size={16}/>}
          title="In Progress"
          count={inProgress.length}
          accent="#bbb7e8"
          accentLight="#d6d3f0"
          right={<HeaderLinkButton accent="#bbb7e8" onClick={() => navigate({ page: 'fab_requests', tab: 'in_progress' })}>View all <F.ArrowRight size={13}/></HeaderLinkButton>}
        />
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 130px 130px 24px',
          padding: '10px 24px', borderTop: '1px solid #f1f1f5',
          fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.06em', gap: 16,
        }}>
          <div>ID</div><div>Title · Phase</div><div>Wafers</div><div>Submitted</div><div/>
        </div>
        {inProgress.map(r => (
          <InProgressRow
            key={r.id}
            request={r}
            navigate={navigate}
            open={expandedId === r.id}
            onToggle={() => setExpandedId(prev => prev === r.id ? null : r.id)}
          />
        ))}
      </FabCard>

      {/* Two-up: Needs Attention + Quick navigation to Drafts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* Needs Attention */}
        <FabCard padding={0} style={{ overflow: 'hidden' }}>
          <BannerHeader
            icon={<F.CircleAlert size={16}/>}
            title="Needs Attention"
            count={attention.length}
            accent="#f4a8bf"
            accentLight="#fbd0dc"
          />
          <div>
            {attention.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nothing flagged. Good work.
              </div>
            ) : attention.map((r) => (
              <button key={r.id} onClick={() => navigate({ page: 'fab_request', id: r.id })} style={{
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderTop: '1px solid #f1f1f5', background: '#fff',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fafafd'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                    #{r.id} · {r.created.split(' ')[0]}
                  </div>
                </div>
                <StatusPill status={r.status} size="sm"/>
                <F.ChevronRight size={15} color="#cbcbd6"/>
              </button>
            ))}
          </div>
        </FabCard>

        {/* Quick navigation — Drafts */}
        <FabCard padding={0} style={{ overflow: 'hidden' }}>
          <BannerHeader
            icon={<F.FilePlus size={16}/>}
            title="Drafts"
            count={drafts.length}
            accent="#9ebbc8"
            accentLight="#c7dde6"
            right={<HeaderLinkButton accent="#9ebbc8" onClick={() => navigate({ page: 'fab_drafts' })}>Open Drafts <F.ArrowRight size={13}/></HeaderLinkButton>}
          />
          <div>
            {drafts.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No drafts saved.
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => navigate({ page: 'fab_new' })} style={{
                    fontSize: 13, fontWeight: 600, color: '#6c67b8',
                    display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                  }}><F.Plus size={13}/> Start a new request</button>
                </div>
              </div>
            ) : drafts.slice(0, 4).map((r) => (
              <button key={r.id} onClick={() => navigate({ page: 'fab_draft_edit', id: r.id })} style={{
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderTop: '1px solid #f1f1f5', background: '#fff',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fafafd'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                <F.FilePlus size={16} color="#6c67b8" style={{ flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.title || 'Untitled draft'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                    #{r.id} · {(r.sampleCount ?? r.samples.length)} wafer{(r.sampleCount ?? r.samples.length) === 1 ? '' : 's'} · {r.created.split(' ')[0]}
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6c67b8' }}>Continue →</span>
              </button>
            ))}
          </div>
        </FabCard>
      </div>

      {/* Recent Activity — bold ink header, timeline grouped by day */}
      <FabCard padding={0} style={{ overflow: 'hidden' }}>
        <BannerHeader
          icon={<F.Clock size={16}/>}
          title="Recent Activity"
          count={activity.length}
          accent="#a8a8b8"
          accentLight="#d4d4dc"
          right={<span style={{
            fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.72)',
          }}>Last 5 events</span>}
        />

        <div style={{ padding: '24px 28px 26px' }}>
          {(() => {
            const STYLES = {
              APPROVE:          { dot: '#1f8a5b', tintBg: '#e8f6ee', tintFg: '#157a4a', verb: 'Approved',     icon: (c) => <F.Check size={12} color={c} strokeWidth={3}/>,    text: (a) => <>{a.request.title} approved by <span style={{ fontFamily: 'var(--font-mono)' }}>{a.by}</span></> },
              APPROVE_DISPATCH: { dot: '#1f8a5b', tintBg: '#e8f6ee', tintFg: '#157a4a', verb: 'Dispatched',   icon: (c) => <F.Check size={12} color={c} strokeWidth={3}/>,    text: (a) => <>{a.request.title} approved and dispatched</> },
              RETURN:           { dot: '#c1556e', tintBg: '#fceef2', tintFg: '#a73d56', verb: 'Returned',     icon: (c) => <F.Refresh size={11} color={c} strokeWidth={2.5}/>, text: (a) => <>{a.request.title} returned for correction</> },
              REJECT:           { dot: '#d24a5d', tintBg: '#fde6e6', tintFg: '#c0394a', verb: 'Rejected',     icon: (c) => <F.X size={11} color={c} strokeWidth={3}/>,         text: (a) => <>{a.request.title} rejected</> },
              RECEIVE:          { dot: '#6c67b8', tintBg: '#ecebf7', tintFg: '#5550a0', verb: 'Received',     icon: (c) => <F.ArrowDown size={11} color={c} strokeWidth={2.5}/>, text: (a) => <><span style={{ fontFamily: 'var(--font-mono)' }}>{a.sample?.wafer || a.request.title}</span> received at lab</> },
            };
            const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            // Group by day
            const groups = {};
            activity.forEach(a => {
              const day = a.at.split(' ')[0];
              (groups[day] = groups[day] || []).push(a);
            });
            const days = Object.keys(groups).sort().reverse();

            return (
              <div style={{ position: 'relative' }}>
                {/* vertical connector line */}
                <div style={{
                  position: 'absolute', left: 76, top: 8, bottom: 8, width: 2,
                  background: 'linear-gradient(180deg, #e2e2ea 0%, #f1f1f5 100%)',
                  borderRadius: 2,
                }}/>

                {days.map((day, di) => {
                  const [, m, d] = day.split('-');
                  const items = groups[day];
                  return (
                    <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: di === days.length - 1 ? 0 : 22 }}>
                      {items.map((a, i) => {
                        const s = STYLES[a.action];
                        if (!s) return null;
                        const time = a.at.split(' ')[1];
                        return (
                          <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '60px 36px 1fr', alignItems: 'center', gap: 16 }}>
                            {/* day chip — only show for first item of each day */}
                            {i === 0 ? (
                              <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: '6px 0', borderRadius: 8,
                                background: '#1e1e24', color: '#fff',
                              }}>
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.66)' }}>{MONTH[parseInt(m,10)-1]}</span>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, lineHeight: 1, marginTop: 2 }}>{String(parseInt(d,10)).padStart(2,'0')}</span>
                              </div>
                            ) : <div/>}
                            {/* dot on line */}
                            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 999,
                                background: '#fff', border: `2px solid ${s.dot}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 0 0 4px #fff, 0 1px 4px rgba(30,30,36,0.08)`,
                              }}>{s.icon(s.dot)}</div>
                            </div>
                            {/* content */}
                            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{
                                padding: '3px 9px', borderRadius: 999,
                                background: s.tintBg, color: s.tintFg,
                                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                              }}>{s.verb}</span>
                              <span style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                                {s.text(a)}
                              </span>
                              <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{time}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </FabCard>
    </FabPage>
  );
};

// ── My Requests / Drafts ───────────────────────────────────────
const TABS = [
  { id: 'all',         label: 'All',         filter: (r) => r.status !== 'draft' },
  { id: 'in_progress', label: 'In Progress', filter: (r) => r.status === 'in_progress' },
  { id: 'returned',    label: 'Returned',    filter: (r) => r.status === 'returned' },
  { id: 'rejected',    label: 'Rejected',    filter: (r) => r.status === 'rejected' },
  { id: 'cancelled',   label: 'Cancelled',   filter: (r) => r.status === 'cancelled' },
];

const FabRequestList = ({ navigate, initialTab = 'all', titleOverride, drafts = false }) => {
  const { data: requests, loading, error } = useRequests();
  const [tab, setTab] = uS(initialTab);
  const [search, setSearch] = uS('');
  const [urgency, setUrgency] = uS('all');
  const [sort, setSort] = uS('newest');

  const counts = uM(() => Object.fromEntries(TABS.map(t => [t.id, requests.filter(t.filter).length])), [requests]);
  const baseList = drafts ? requests.filter(r => r.status === 'draft') : requests;
  const tabFilter = drafts ? () => true : (TABS.find(t => t.id === tab)?.filter || (() => true));

  const list = uM(() => {
    let l = baseList.filter(tabFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      l = l.filter(r => r.title.toLowerCase().includes(q) || String(r.id).includes(q));
    }
    if (urgency !== 'all') l = l.filter(r => r.urgency === urgency);
    if (sort === 'newest') l = [...l].sort((a,b) => b.id - a.id);
    if (sort === 'oldest') l = [...l].sort((a,b) => a.id - b.id);
    return l;
  }, [baseList, tab, search, urgency, sort, drafts]);

  const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
  const onRowClick = (r) => navigate(
    drafts ? { page: 'fab_draft_edit', id: r.id } : { page: 'fab_request', id: r.id }
  );

  if (loading && requests.length === 0) {
    return (
      <FabPage
        title={titleOverride || 'My Requests'}
        subtitle=""
        right={<PrimaryBtn icon={<F.Plus size={16}/>} onClick={() => navigate({ page: 'fab_new' })}>New Request</PrimaryBtn>}
      >
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading…
        </div>
      </FabPage>
    );
  }

  return (
    <FabPage
      title={titleOverride || 'My Requests'}
      subtitle={drafts
        ? `${baseList.length} draft${baseList.length === 1 ? '' : 's'} — finish and submit`
        : `${requests.length} total · ${inProgressCount} in progress`}
      right={<PrimaryBtn icon={<F.Plus size={16}/>} onClick={() => navigate({ page: 'fab_new' })}>New Request</PrimaryBtn>}
    >
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          Failed to load requests: {error}
        </div>
      )}
      {/* Tabs */}
      {!drafts && (
        <div style={{ display: 'flex', gap: 22, borderBottom: '1px solid rgba(0,0,0,0.07)', marginBottom: 22 }}>
          {TABS.map(t => {
            const active = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 0 14px', cursor: 'pointer',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 14, fontWeight: active ? 700 : 500,
              }}>
                {t.label}
                <span style={{
                  minWidth: 22, height: 19, padding: '0 7px',
                  borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: active ? '#1e1e24' : '#ebebf0',
                  color: active ? '#fff' : '#5a5a6e',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{counts[t.id]}</span>
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, right: 0, bottom: -1, height: 2,
                    background: '#1e1e24', borderRadius: 2,
                  }}/>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 380 }}>
          <F.Search size={14} color="#a8a8b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or ID..." style={{
            width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 13.5, color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'inherit',
          }}
            onFocus={(e) => { e.target.style.borderColor = '#6c67b8'; e.target.style.boxShadow = '0 0 0 3px rgba(108,103,184,0.12)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Urgency:</span>
          {[
            { id: 'all', label: 'All' },
            { id: '3d',  label: '3 Days' },
            { id: '1w',  label: '1 Week' },
            { id: '2w',  label: '2 Weeks' },
          ].map(u => {
            const active = urgency === u.id;
            return (
              <button key={u.id} onClick={() => setUrgency(u.id)} style={{
                padding: '6px 14px', borderRadius: 999,
                background: active ? '#e8e7f6' : 'transparent',
                color: active ? '#5550a0' : 'var(--text-secondary)',
                border: active ? '1px solid #c9c4ee' : '1px solid transparent',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>{u.label}</button>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Sort:</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{
            padding: '8px 32px 8px 12px', borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.1)', background: '#fff',
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            appearance: 'none', cursor: 'pointer',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23777788\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            fontFamily: 'inherit',
          }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
        Showing <strong style={{ color: 'var(--text-primary)' }}>{list.length}</strong> of {baseList.length} requests
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 ? (
          <FabCard padding={48} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <F.ClipboardList size={32} color="#cbcbd6" style={{ marginBottom: 10 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No requests match these filters</div>
          </FabCard>
        ) : list.map(r => (
          <button key={r.id} onClick={() => onRowClick(r)} style={{
            display: 'grid',
            // drafts only show flow indicator; full list shows urgency + status pills too
            gridTemplateColumns: drafts
              ? '72px minmax(0,1fr) 180px 24px'
              : '72px minmax(0,1fr) 140px 110px 130px 24px',
            alignItems: 'center', gap: 18,
            padding: '18px 22px', borderRadius: 14,
            background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
            textAlign: 'left', cursor: 'pointer', transition: 'border 0.12s, background 0.12s',
            fontFamily: 'inherit',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#a8a8b8', letterSpacing: '0.02em' }}>
              #{String(r.id).padStart(4, '0')}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{r.title || 'Untitled draft'}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <F.Calendar size={12}/>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{r.created.split(' ')[0]}</span>
                <span>·</span>
                <span>{(r.sampleCount ?? r.samples.length)} wafer{(r.sampleCount ?? r.samples.length) === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              {drafts
                ? <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6c67b8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <F.FilePlus size={13}/> Continue editing
                  </span>
                : <RequestFlow request={r}/>}
            </div>
            {!drafts && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <UrgencyPill urgency={r.urgency} size="md"/>
              </div>
            )}
            {!drafts && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <StatusPill status={r.status} size="md"/>
              </div>
            )}
            <F.ChevronRight size={15} color="#cbcbd6"/>
          </button>
        ))}
      </div>
    </FabPage>
  );
};

// ── New Request ────────────────────────────────────────────────
const SectionStep = ({ n, title, subtitle, children }) => (
  <FabCard padding={0} style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '22px 24px 18px' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 999, background: '#1e1e24',
        color: '#fff', fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{n}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ padding: '0 24px 24px' }}>{children}</div>
  </FabCard>
);

const FieldLabel = ({ children, required }) => (
  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
    {children}{required && <span style={{ color: '#c0394a', marginLeft: 4 }}>*</span>}
  </label>
);
const inputBase = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.12)', background: '#f8f8fb',
  fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit',
};
const onFocus = (e) => { e.target.style.borderColor = '#6c67b8'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(108,103,184,0.12)'; };
const onBlur = (e) => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; e.target.style.background = '#f8f8fb'; e.target.style.boxShadow = 'none'; };

const UrgencyTile = ({ opt, active, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 12, flex: 1,
    padding: '14px 16px', borderRadius: 12,
    background: active ? '#f5f4fb' : '#fff',
    border: `1px solid ${active ? '#6c67b8' : 'rgba(0,0,0,0.12)'}`,
    boxShadow: active ? '0 0 0 3px rgba(108,103,184,0.12)' : 'none',
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
    fontFamily: 'inherit',
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
    </div>
    <span style={{
      width: 20, height: 20, borderRadius: 999, flexShrink: 0,
      border: `2px solid ${active ? '#6c67b8' : 'rgba(0,0,0,0.16)'}`,
      background: active ? '#6c67b8' : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {active && <F.Check size={11} color="#fff" strokeWidth={3}/>}
    </span>
  </button>
);

// Expanded card-style picker — category badge + full experiment name +
// description. No short-code chip: backend collapsed to 7 full-name
// records and the names are descriptive enough on their own.
const CATEGORY_BADGE = {
  RA: { bg: '#e8e7f6', fg: '#5550a0' },  // Reliability / stress
  TM: { bg: '#d4eaf0', fg: '#2a7a91' },  // Test & measurement
  MA: { bg: '#dfe8d9', fg: '#3f6a32' },  // Materials analysis
  FA: { bg: '#fbe1d1', fg: '#9a4715' },  // Failure analysis
};
const ExpCard = ({ exp, active, onClick }) => {
  const badge = CATEGORY_BADGE[exp.group] || { bg: '#ecedf0', fg: '#5a5a6e' };
  return (
    <button onClick={onClick} style={{
      display: 'block', textAlign: 'left', width: '100%', padding: '14px 16px',
      borderRadius: 12, fontFamily: 'inherit', cursor: 'pointer',
      background: active ? '#f5f4fb' : '#fff',
      border: `1px solid ${active ? '#6c67b8' : 'rgba(0,0,0,0.12)'}`,
      boxShadow: active ? '0 0 0 3px rgba(108,103,184,0.10)' : 'none',
      transition: 'all 0.12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: badge.bg, color: badge.fg, letterSpacing: '0.05em',
        }}>{exp.group || '—'}</span>
        <span style={{ fontSize: 14.5, color: 'var(--text-primary)', fontWeight: 700, flex: 1 }}>{exp.name}</span>
        <span style={{
          width: 18, height: 18, borderRadius: 999, flexShrink: 0,
          border: `2px solid ${active ? '#6c67b8' : 'rgba(0,0,0,0.16)'}`,
          background: active ? '#6c67b8' : '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{active && <F.Check size={10} color="#fff" strokeWidth={3}/>}</span>
      </div>
      {exp.desc && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{exp.desc}</div>
      )}
    </button>
  );
};

const FabNewRequest = ({ navigate, draft, isEdit = false, showToast }) => {
  // Edit mode now POSTs the same shape as create — backend lims-backend
  // SHA 6c187f4 widened PATCH /requests/:id to accept experiment_type_ids
  // and samples on drafts. (Non-draft requests still 422 on those fields,
  // which surfaces via the inline error banner.)
  const { data: liveExperiments, error: experimentsError } = useExperimentTypes();
  const experimentChoices = liveExperiments.map(e => ({
    id: e.id,
    name: e.name,
    desc: e.description,
    group: e.labCategory,
  }));

  const [title, setTitle] = uS(draft?.title || '');
  const [note, setNote] = uS(draft?.note || '');
  const [urgency, setUrgency] = uS(draft?.urgency || '1w');
  const [wafers, setWafers] = uS(draft?.samples?.length ? draft.samples.map(s => ({ wafer: s.wafer, size: s.size, expIds: draft.expIds || [] })) : [{ wafer: '', size: '200mm', expIds: [] }]);
  const [busy, setBusy] = uS(false);
  const [apiError, setApiError] = uS(null);

  const addWafer = () => setWafers(w => [...w, { wafer: '', size: '200mm', expIds: [] }]);
  const removeWafer = (i) => setWafers(w => w.length === 1 ? w : w.filter((_, j) => j !== i));
  const updateWafer = (i, key, value) => setWafers(w => w.map((s, j) => j === i ? { ...s, [key]: value } : s));
  const toggleExp = (i, expId) => setWafers(w => w.map((s, j) => j === i ? {
    ...s, expIds: s.expIds.includes(expId) ? s.expIds.filter(x => x !== expId) : [...s.expIds, expId],
  } : s));

  const totalExp = wafers.reduce((acc, w) => acc + w.expIds.length, 0);
  const basicValid = title.trim().length > 0;
  const samplesValid = wafers.every(w => w.wafer.trim() && w.expIds.length > 0);
  const valid = basicValid && samplesValid;

  const handle = async (publish) => {
    setBusy(true);
    setApiError(null);
    try {
      const expIdsAll = Array.from(new Set(wafers.flatMap(w => w.expIds)));
      const samples = wafers.map(w => ({ wafer_id: w.wafer.trim(), wafer_size: w.size }));
      const payload = {
        title: title.trim(),
        note: note.trim(),
        urgency,
        experiment_type_ids: expIdsAll,
        samples,
      };

      if (isEdit) {
        // Full PATCH — backend lims-backend SHA 6c187f4 widened
        // RequestUpdateIn on drafts. Non-draft requests will 422 on
        // experiment_type_ids/samples and surface in the banner.
        await window.api.requests.update(draft.id, payload);
        if (publish) {
          await window.api.requests.submit(draft.id);
          showToast && showToast(`Draft #${draft.id} submitted — awaiting approval`);
          navigate({ page: 'fab_request', id: draft.id });
        } else {
          showToast && showToast(`Draft #${draft.id} updated`);
          navigate({ page: 'fab_drafts' });
        }
        return;
      }

      const created = await window.api.requests.create(payload);
      if (publish) {
        await window.api.requests.submit(created.id);
        showToast && showToast(`Request #${created.id} submitted — awaiting approval`);
        navigate({ page: 'fab_requests' });
      } else {
        showToast && showToast(`Draft #${created.id} saved`);
        navigate({ page: 'fab_drafts' });
      }
    } catch (err) {
      setApiError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FabPage
      breadcrumb={
        <button onClick={() => navigate(isEdit ? { page: 'fab_drafts' } : { page: 'fab_requests' })} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 13, fontWeight: 600, color: '#6c67b8', marginBottom: 14, cursor: 'pointer',
        }}><F.ChevronLeft size={14}/> {isEdit ? 'Drafts' : 'My Requests'}</button>
      }
      title={isEdit ? `Edit Draft #${String(draft?.id ?? '').padStart(4, '0')}` : 'New Request'}
      subtitle={isEdit ? 'Continue where you left off — submit when ready' : undefined}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 22, alignItems: 'flex-start' }}>
        <div>
          {/* Section 1 — Basic Info */}
          <SectionStep n={1} title="Basic Information" subtitle="Title, notes, and how urgent">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <FieldLabel required>Title</FieldLabel>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. TCT 050901 — Q2 reliability batch"
                  style={inputBase} onFocus={onFocus} onBlur={onBlur}/>
              </div>
              <div>
                <FieldLabel>Note (optional)</FieldLabel>
                <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  rows={3} placeholder="Special handling, related work orders, etc."
                  style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={onFocus} onBlur={onBlur}/>
              </div>
              <div>
                <FieldLabel required>Urgency</FieldLabel>
                <div style={{ display: 'flex', gap: 12 }}>
                  {URGENCY_OPTS.map(o => (
                    <UrgencyTile key={o.id} opt={o} active={urgency === o.id} onClick={() => setUrgency(o.id)}/>
                  ))}
                </div>
              </div>
            </div>
          </SectionStep>

          {/* Section 2 — Samples & Experiments */}
          <SectionStep n={2} title="Samples & Experiments" subtitle={`${wafers.length} wafer${wafers.length === 1 ? '' : 's'} · ${totalExp} experiment${totalExp === 1 ? '' : 's'} total — pick experiments for each wafer`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {wafers.map((w, i) => (
                <div key={i} style={{
                  border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
                  padding: '14px 16px', background: '#fff',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 130px 36px', gap: 10, alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                      color: 'var(--text-secondary)', textAlign: 'center',
                    }}>#{String(i + 1).padStart(2, '0')}</span>
                    <input value={w.wafer} onChange={(e) => updateWafer(i, 'wafer', e.target.value)}
                      placeholder="Wafer ID (e.g. W001)"
                      style={inputBase} onFocus={onFocus} onBlur={onBlur}/>
                    <select value={w.size} onChange={(e) => updateWafer(i, 'size', e.target.value)} style={{
                      ...inputBase, paddingRight: 32, appearance: 'none', cursor: 'pointer',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23777788\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                    }}>
                      <option value="100mm">100mm</option>
                      <option value="150mm">150mm</option>
                      <option value="200mm">200mm</option>
                      <option value="300mm">300mm</option>
                    </select>
                    <button onClick={() => removeWafer(i)} disabled={wafers.length === 1}
                      title="Remove wafer" style={{
                        width: 36, height: 36, borderRadius: 8,
                        color: wafers.length === 1 ? '#cbcbd6' : '#a8a8b8',
                        cursor: wafers.length === 1 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, color 0.1s',
                      }}
                      onMouseEnter={(e) => { if (wafers.length > 1) { e.currentTarget.style.background = '#fde4e4'; e.currentTarget.style.color = '#c0394a'; } }}
                      onMouseLeave={(e) => { if (wafers.length > 1) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a8a8b8'; } }}
                    ><F.Trash size={15}/></button>
                  </div>

                  <div style={{ marginTop: 14, paddingLeft: 48 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Experiments <span style={{ color: '#c0394a' }}>*</span>
                      </span>
                      {w.expIds.length === 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#c0394a' }}>Pick at least one</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      {experimentChoices.length === 0 && experimentsError && (
                        <div style={{ gridColumn: '1 / -1', fontSize: 13, color: '#c0394a', padding: '12px 14px', background: '#fde4e4', border: '1px solid #f6c4c4', borderRadius: 10 }}>
                          Couldn't load experiment types: {experimentsError}
                        </div>
                      )}
                      {experimentChoices.map(e => (
                        <ExpCard key={e.id} exp={e} active={w.expIds.includes(e.id)} onClick={() => toggleExp(i, e.id)}/>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addWafer} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '14px 16px', borderRadius: 12,
                border: '1px dashed rgba(0,0,0,0.18)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 13.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.12s, color 0.12s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6c67b8'; e.currentTarget.style.color = '#6c67b8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              ><F.Plus size={14}/> Add another wafer</button>
            </div>
          </SectionStep>
        </div>

        {/* Right rail — Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 32 }}>
          <FabCard padding={20}>
            <SectionLabel style={{ marginBottom: 10 }}>Summary</SectionLabel>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              <span style={{ flex: 1, height: 4, borderRadius: 999, background: basicValid ? '#6c67b8' : '#ebebf0' }}/>
              <span style={{ flex: 1, height: 4, borderRadius: 999, background: samplesValid ? '#6c67b8' : '#ebebf0' }}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Title</div>
                <div style={{ fontSize: 13.5, marginTop: 4, color: title ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: title ? 600 : 400 }}>{title || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Urgency</div>
                <div style={{ marginTop: 6 }}><UrgencyPill urgency={urgency}/></div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Wafers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {wafers.map((w, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: w.wafer ? 'var(--text-primary)' : 'var(--text-muted)' }}>{w.wafer || `Wafer ${String(i+1).padStart(2,'0')}`}</span>
                      <span style={{ fontSize: 12, color: w.expIds.length === 0 ? '#c0394a' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{w.expIds.length} exp</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FabCard>
        </div>
      </div>

      {apiError && (
        <div style={{
          padding: '12px 16px', marginTop: 16, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          {apiError}
        </div>
      )}

      {/* Bottom action bar */}
      <div style={{
        position: 'sticky', bottom: 0, marginTop: 24, marginLeft: -44, marginRight: -44,
        padding: '16px 44px',
        background: 'rgba(255,255,255,0.88)', borderTop: '1px solid rgba(0,0,0,0.07)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{(basicValid ? 1 : 0) + (samplesValid ? 1 : 0)}/2</strong> sections complete
          {!valid && ' — every wafer needs an ID and at least one experiment'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SecondaryBtn onClick={() => navigate(isEdit ? { page: 'fab_drafts' } : { page: 'fab_requests' })}>Cancel</SecondaryBtn>
          <SecondaryBtn disabled={busy} onClick={() => handle(false)}>{busy ? 'Saving…' : (isEdit ? 'Save & Stay Draft' : 'Save Draft')}</SecondaryBtn>
          <PrimaryBtn disabled={!valid || busy} onClick={() => handle(true)}>{busy ? 'Submitting…' : (isEdit ? 'Submit Draft' : 'Submit Request')}</PrimaryBtn>
        </div>
      </div>
    </FabPage>
  );
};

// ── Detail ─────────────────────────────────────────────────────
// Plain card-header strip — matches the style of the lab dispatch detail
// (no gradient, just an uppercase eyebrow on a thin border).
const PlainCardHeader = ({ children, right }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)',
    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  }}>
    {children}
    {right && <div style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>{right}</div>}
  </div>
);

const DetailWaferRow = ({ wafer, request }) => {
  const idx = phaseIndexFor(wafer, request);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)',
      alignItems: 'center', gap: 22,
      padding: '16px 18px',
      background: '#fff', borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.07)',
    }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <F.Wafer size={15} color="#6c67b8"/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{wafer.wafer}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginLeft: 23 }}>{wafer.size}</div>
      </div>
      <PhasePipeline idx={idx}/>
    </div>
  );
};

const HistoryDot = ({ action }) => {
  const c = {
    APPROVE: { dot: '#157a4a', bg: '#c8eedd', fg: '#157a4a' },
    REJECT:  { dot: '#c0394a', bg: '#fde4e4', fg: '#c0394a' },
    RETURN:  { dot: '#a73d56', bg: '#f9d7e0', fg: '#a73d56' },
    CANCEL:  { dot: '#777788', bg: '#ebebf0', fg: '#5a5a6e' },
  }[action] || { dot: '#a8a8b8', bg: '#f1f1f5', fg: '#5a5a6e' };
  return c;
};

// Modal that prompts for a non-empty cancellation reason. Backend
// `/requests/:id/cancel` accepts a `reason` field with Ninja min_length=1,
// so the Confirm button stays disabled until the textarea has content.
const CancelRequestModal = ({ requestId, onClose, onCancelled, showToast }) => {
  const [reason, setReason] = uS('');
  const [busy, setBusy] = uS(false);
  const [err, setErr] = uS(null);
  const canConfirm = reason.trim().length > 0 && !busy;
  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await window.api.requests.cancel(requestId, reason.trim());
      showToast && showToast(`Request #${requestId} cancelled`);
      onCancelled && onCancelled();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(20,20,28,0.42)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(460px, 100%)', background: '#fff', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(20,20,28,0.32)', padding: 24,
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Cancel Request #{String(requestId).padStart(4, '0')}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          Cancellation is permanent. The lab will see your reason in the request history.
        </div>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Reason <span style={{ color: '#c0394a' }}>*</span>
        </label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          rows={4} autoFocus
          placeholder="Why is this request being cancelled?"
          style={{
            width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.16)', fontSize: 13.5, fontFamily: 'inherit',
            resize: 'vertical', outline: 'none',
          }}/>
        {err && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8,
            background: '#fde4e4', color: '#c0394a', fontSize: 13, fontWeight: 500,
            border: '1px solid #f6c4c4' }}>
            {err}
          </div>
        )}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <SecondaryBtn onClick={onClose} disabled={busy}>Keep request</SecondaryBtn>
          <PrimaryBtn disabled={!canConfirm} onClick={confirm} style={{ background: canConfirm ? '#c0394a' : '#cbcbd6' }}>
            {busy ? 'Cancelling…' : 'Cancel request'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
};

// Per-sample experiment rollup lookup. The request detail payload only
// carries the request-level experiment list — done/pending state lives
// on /samples/:id/experiments (gap §2.8). Fetch one rollup per sample in
// parallel and return a Map keyed by sample id so the experiments-by-wafer
// card can look up each row in O(1).
const useSampleExperimentsForRequest = (samples) => {
  const [byId, setById] = uS({});
  const [loading, setLoading] = uS(false);
  const ids = (samples || []).map(s => s.id).filter(v => v != null);
  const key = ids.join(',');
  React.useEffect(() => {
    if (!window.api || !window.api.samples || ids.length === 0) {
      setById({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(ids.map(sid =>
      window.api.samples.getExperiments(sid)
        .then(rows => [sid, rows])
        .catch(() => [sid, []])
    ))
      .then(pairs => {
        if (cancelled) return;
        const next = {};
        pairs.forEach(([sid, rows]) => { next[sid] = rows; });
        setById(next);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);
  return { byId, loading };
};

const FabRequestDetail = ({ id, navigate, showToast }) => {
  const { data: r, loading, error, refresh } = useRequestDetail(id);
  const { data: liveTypes } = useExperimentTypes();
  const { byId: expsBySample } = useSampleExperimentsForRequest(r?.samples);
  const [cancelOpen, setCancelOpen] = uS(false);
  const [shipBusy, setShipBusy] = uS(false);

  const onShip = async () => {
    if (!r) return;
    if (!window.confirm('Ship all wafers for this request to the lab?')) return;
    setShipBusy(true);
    try {
      await window.api.requests.ship(r.id);
      showToast && showToast('Wafers shipped');
      refresh();
    } catch (e) {
      showToast && showToast(`Ship failed: ${e.message || e}`);
    } finally {
      setShipBusy(false);
    }
  };

  if (loading && !r) {
    return (
      <FabPage title="Loading request…">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading…
        </div>
      </FabPage>
    );
  }
  if (error || !r) {
    return (
      <FabPage
        breadcrumb={
          <button onClick={() => navigate({ page: 'fab_requests' })} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, fontWeight: 600, color: '#6c67b8', marginBottom: 14, cursor: 'pointer',
          }}><F.ChevronLeft size={14}/> My Requests</button>
        }
        title="Request not found"
      >
        <div style={{ padding: '24px', color: '#c0394a', fontSize: 14 }}>
          {error || 'This request is no longer available.'}
        </div>
      </FabPage>
    );
  }

  // Backend's RequestDetailOut.experiment_types only carries id + name +
  // parameters; lab_category lives on the standalone /experiment-types/
  // endpoint. Join in-place so the experiment chips can still show their
  // RA/MA/FA/TM group label.
  const labCategoryById = new Map(liveTypes.map(t => [t.id, t.labCategory]));
  const exps = (r.experiment_types || []).map(et => ({
    id: et.id,
    name: et.name,
    group: labCategoryById.get(et.id) || '',
  }));
  const canCancel = r.status === 'in_progress' || r.status === 'submitted';
  const overallIdx = r.samples.length ? Math.min(...r.samples.map(s => phaseIndexFor(s, r))) : 0;

  const completedAt = (r.status === 'completed' && r.history.length)
    ? r.history[r.history.length - 1].at.split(' ')[0]
    : null;
  const stateMap = {
    in_progress: 'In Progress', returned: 'Returned',
    rejected: 'Rejected', cancelled: 'Cancelled',
    draft: 'Draft', submitted: 'Submitted',
  };
  const metrics = [
    { label: 'Wafers',      value: r.samples.length },
    { label: 'Experiments', value: exps.length },
    { label: 'Submitted',   value: r.submitted ? r.submitted.split(' ')[0] : '—' },
    { label: 'Completed',   value: completedAt || stateMap[r.status] || '—' },
  ];

  return (
    <FabPage
      breadcrumb={
        <button onClick={() => navigate({ page: 'fab_requests' })} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 13, fontWeight: 600, color: '#6c67b8', marginBottom: 14, cursor: 'pointer',
        }}><F.ChevronLeft size={14}/> My Requests</button>
      }
      title={r.title}
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)',
            letterSpacing: '0.04em', padding: '3px 9px', borderRadius: 6,
            background: '#ebebf0',
          }}>#{String(r.id).padStart(4, '0')}</span>
          <StatusPill status={r.status} size="md"/>
          <UrgencyPill urgency={r.urgency} size="md"/>
          {r.status !== 'draft' && r.status !== 'cancelled' && r.status !== 'submitted' && overallIdx >= 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Currently at <strong style={{ color: 'var(--text-primary)' }}>{WAFER_PHASES[overallIdx]}</strong>
            </span>
          )}
        </span>
      }
      right={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {r.rawStatus === 'approved' && (
            <button onClick={onShip} disabled={shipBusy} style={{
              padding: '9px 15px', borderRadius: 8,
              background: shipBusy ? '#cbcbd6' : '#6c67b8', color: '#fff',
              fontWeight: 600, fontSize: 13, cursor: shipBusy ? 'not-allowed' : 'pointer',
              border: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
            }}><F.Package size={14} strokeWidth={2.5}/> {shipBusy ? 'Shipping…' : 'Ship Wafers'}</button>
          )}
          {canCancel && (
            <button onClick={() => setCancelOpen(true)} style={{
              padding: '9px 15px', borderRadius: 8,
              background: '#fff', color: '#c0394a',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              border: '1px solid #f4c8c8',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
            }}><F.X size={14} strokeWidth={2.5}/> Cancel Request</button>
          )}
        </span>
      }
    >
      {/* Overview card — metrics + approval history all in the first block */}
      <FabCard padding={0} style={{ marginBottom: 18 }}>
        <PlainCardHeader>Overview</PlainCardHeader>
        <div style={{
          padding: '22px 24px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18,
          borderBottom: r.history.length > 0 || r.note ? '1px solid rgba(0,0,0,0.06)' : 'none',
        }}>
          {metrics.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginTop: 6, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {r.note && (
          <div style={{ padding: '16px 24px', borderBottom: r.history.length > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Note</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-primary)' }}>{r.note}</div>
          </div>
        )}

        {r.history.length > 0 && (
          <>
            <PlainCardHeader>Approval History</PlainCardHeader>
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {r.history.map((h, i) => {
                const c = HistoryDot({ action: h.action });
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 14, alignItems: 'flex-start',
                  }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 999, background: '#fff',
                      border: `3px solid ${c.dot}`, marginTop: 2,
                    }}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.fg, letterSpacing: '0.04em' }}>{h.action}</span>
                        <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                          by <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{h.by}</strong>
                        </span>
                      </div>
                      {h.note && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, padding: '8px 10px', background: '#f8f8fb', borderRadius: 6 }}>{h.note}</div>
                      )}
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h.at}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </FabCard>

      {/* Wafer Phases — full width so the pipeline labels never truncate */}
      <FabCard padding={0} style={{ marginBottom: 18 }}>
        <PlainCardHeader right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.samples.length} wafer{r.samples.length === 1 ? '' : 's'}</span>}>
          <F.Layers size={13} color="var(--text-secondary)"/>
          Wafer Phases
        </PlainCardHeader>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, background: '#fafafd' }}>
          {r.samples.map((s, i) => <DetailWaferRow key={i} wafer={s} request={r}/>)}
        </div>
      </FabCard>

      {/* Experiments by Wafer — shows result + verdict + note when an experiment is done */}
      <FabCard padding={0}>
        <PlainCardHeader right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: '#157a4a' }}/>Pass
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: '#a93445' }}/>Fail
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: 'transparent', border: '1.5px dashed #cbcbd6' }}/>Pending
            </span>
          </span>
        }>
          <F.ClipboardList size={13} color="var(--text-secondary)"/>
          Experiments by Wafer
        </PlainCardHeader>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, background: '#fafafd' }}>
          {r.samples.map((s, si) => {
            // Wafer-side rollup from /samples/:id/experiments (gap §2.8).
            // Joined with the request's exps so we render in a stable
            // experiment-order and fall back to "pending" before the
            // per-sample fetch lands.
            const rollup = expsBySample[s.id] || [];
            const rollupByExpId = new Map(rollup.map(row => [row.experimentTypeId, row]));
            const total = exps.length;
            const doneCount = exps.filter(e => rollupByExpId.get(e.id)?.status === 'done').length;
            return (
              <div key={si} style={{
                background: '#fff', borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '200px 1fr 80px',
                  alignItems: 'center', gap: 18,
                  padding: '14px 18px',
                }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <F.Wafer size={15} color="#6c67b8"/>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{s.wafer}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, marginLeft: 23 }}>{s.size}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {exps.map(e => {
                      const row = rollupByExpId.get(e.id);
                      const st  = row?.status || 'pending';
                      const v   = row?.verdict || null;
                      const done = st === 'done';
                      const pass = done && v === 'pass';
                      const fail = done && v === 'fail';
                      return (
                        <span key={e.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '6px 12px 6px 7px', borderRadius: 999,
                          background: fail ? '#fde4e4' : done ? '#e7f6ec' : '#f4f4f7',
                          border: `1px solid ${fail ? '#f4b4b9' : done ? '#9ad9b7' : 'rgba(0,0,0,0.08)'}`,
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999,
                            background: fail ? '#a93445' : done ? '#157a4a' : '#cbcbd6',
                            color: '#fff', letterSpacing: '0.05em',
                          }}>{e.group}</span>
                          <span style={{
                            fontSize: 13, fontWeight: 500,
                            color: fail ? '#5a1a22' : done ? '#1f3d2c' : '#a8a8b8',
                          }}>{e.name}</span>
                          {fail
                            ? <F.X size={13} color="#a93445" strokeWidth={3}/>
                            : done
                              ? <F.Check size={13} color="#157a4a" strokeWidth={3}/>
                              : <span style={{ width: 13, height: 13, borderRadius: 999, border: '1.5px dashed #cbcbd6' }}/>}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: doneCount === total && total > 0 ? '#157a4a' : '#1e1e24', letterSpacing: '-0.01em' }}>
                      {doneCount}<span style={{ color: '#a8a8b8', fontWeight: 500 }}>/{total}</span>
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>done</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </FabCard>

      {cancelOpen && (
        <CancelRequestModal
          requestId={r.id}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => { setCancelOpen(false); refresh(); }}
          showToast={showToast}
        />
      )}
    </FabPage>
  );
};

// ── Root container ────────────────────────────────────────────
const FabDraftEdit = ({ id, navigate, showToast }) => {
  // Fetch the draft via the live API and hand it to FabNewRequest in edit
  // mode. The legacy path looked up the draft on FabApp's seed-only local
  // state, so anything created after login was unreachable from the
  // Drafts → Continue button.
  const { data: draft, loading, error } = useRequestDetail(id);
  if (loading && !draft) {
    return (
      <FabPage title="Loading draft…">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading…
        </div>
      </FabPage>
    );
  }
  if (error || !draft) {
    return (
      <FabPage
        breadcrumb={
          <button onClick={() => navigate({ page: 'fab_drafts' })} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, fontWeight: 600, color: '#6c67b8', marginBottom: 14, cursor: 'pointer',
          }}><F.ChevronLeft size={14}/> Drafts</button>
        }
        title="Draft not found"
      >
        <div style={{ padding: 24, color: '#c0394a', fontSize: 14 }}>
          {error || 'This draft is no longer available.'}
        </div>
      </FabPage>
    );
  }
  return <FabNewRequest navigate={navigate} draft={draft} isEdit showToast={showToast}/>;
};

const FabApp = ({ route, navigate }) => {
  const [toast, setToast] = uS(null);

  const showToast = (msg) => {
    setToast({ msg, t: Date.now() });
    setTimeout(() => setToast(null), 2200);
  };

  let page = null;
  if (route.page === 'fab_dashboard') page = <FabDashboard navigate={navigate}/>;
  else if (route.page === 'fab_requests') page = <FabRequestList navigate={navigate} initialTab={route.tab || 'all'}/>;
  else if (route.page === 'fab_drafts') page = <FabRequestList navigate={navigate} drafts titleOverride="Drafts"/>;
  else if (route.page === 'fab_new')      page = <FabNewRequest navigate={navigate} showToast={showToast}/>;
  else if (route.page === 'fab_draft_edit') page = <FabDraftEdit id={route.id} navigate={navigate} showToast={showToast}/>;
  else if (route.page === 'fab_request')  page = <FabRequestDetail id={route.id} navigate={navigate} showToast={showToast}/>;
  else page = <FabDashboard navigate={navigate}/>;

  return (
    <>
      {page}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: 10,
          background: '#1e1e24', color: '#fff', fontSize: 14, fontWeight: 500,
          boxShadow: '0 12px 36px rgba(30,30,36,0.32)',
          animation: 'slide-in 0.18s ease-out', zIndex: 100,
        }}>{toast.msg}</div>
      )}
    </>
  );
};

window.FabApp = FabApp;
})();
