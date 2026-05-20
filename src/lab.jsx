(function () {
// Lab member — Dashboard, Samples, WIP, Dispatches, Equipment.
// Neutral palette, no gradients; flat cards with soft borders.

const { useState: lS, useMemo: lM } = React;
const LF = window.I;

// ── Domain ──────────────────────────────────────────────────────
const TODAY = '2026-05-11';

const EXPERIMENTS = [
  { id: 'tct',  code: 'TCT',  name: 'Temperature Cycling Test' },
  { id: 'hast', code: 'HAST', name: 'Highly Accelerated Stress Test' },
  { id: 'cp',   code: 'CP',   name: 'Circuit Probe' },
  { id: 'ft',   code: 'FT',   name: 'Final Test' },
];

const RECIPES = [
  { id: 'tct_std',  expId: 'tct',  name: 'TCT_Standard_Reflow_Simulation_v1',
    params: { cycles: 500, t_min: '-55°C', t_max: '125°C', dwell: '15 min', ramp: '15°C/min' } },
  { id: 'tct_long', expId: 'tct',  name: 'TCT_Extended_1000_Cycle_v2',
    params: { cycles: 1000, t_min: '-65°C', t_max: '150°C', dwell: '10 min', ramp: '20°C/min' } },
  { id: 'hast_std', expId: 'hast', name: 'HAST_85C_85RH_v1',
    params: { temperature: '85°C', humidity: '85% RH', duration: '168 h', bias: '5V' } },
  { id: 'cp_full',  expId: 'cp',   name: 'CP_Full_Param_Sweep_v3',
    params: { sites: 1024, touchdowns: 24, vdd: '1.0 V', clock: '100 MHz' } },
  { id: 'ft_basic', expId: 'ft',   name: 'FT_Basic_Functional_v1',
    params: { tests: 240, voltage: '1.2 V', temp: '25°C' } },
];

const EQUIPMENT_SEED = [
  { id: 'QA-TCT-01',  name: 'TCT Bench 01',      type: 'TCT',  model: 'ESPEC ARS-1100', capacity: 6,  status: 'running',     currentWipId: 'WIP-7700' },
  { id: 'QA-TCT-02',  name: 'TCT Bench 02',      type: 'TCT',  model: 'ESPEC ARS-1100', capacity: 6,  status: 'idle',        currentWipId: null },
  { id: 'QA-HAST-01', name: 'HAST Chamber',      type: 'HAST', model: 'Hirayama PC-422',capacity: 12, status: 'running',     currentWipId: 'WIP-7701' },
  { id: 'QA-CP-A',    name: 'CP Probe A',        type: 'CP',   model: 'Accretech UF3000',capacity: 1, status: 'maintenance', currentWipId: null },
  { id: 'QA-CP-B',    name: 'CP Probe B',        type: 'CP',   model: 'Accretech UF3000',capacity: 1, status: 'running',     currentWipId: 'WIP-7699' },
  { id: 'QA-FT-1',    name: 'Final Test Cell 1', type: 'FT',   model: 'Advantest V93000',capacity: 4, status: 'idle',        currentWipId: null },
];

const WAFER_SEED = [
  { id: 'W041501',  size: '200mm', requestId: 14, urgency: '3d', arrivedAt: '2026-05-11 09:12', status: 'in_wip',   wipId: 'WIP-7700', expIds: ['tct'] },
  { id: 'W041501B', size: '200mm', requestId: 14, urgency: '3d', arrivedAt: '2026-05-11 09:12', status: 'received', wipId: null,       expIds: ['tct'] },
  { id: 'W0415002', size: '200mm', requestId: 13, urgency: '1w', arrivedAt: '2026-05-11 08:42', status: 'incoming', wipId: null,       expIds: ['tct'] },
  { id: 'W041201',  size: '300mm', requestId: 11, urgency: '2w', arrivedAt: '2026-05-10 16:20', status: 'in_wip',   wipId: 'WIP-7701', expIds: ['tct', 'hast'] },
  { id: 'W040801',  size: '200mm', requestId: 10, urgency: '1w', arrivedAt: '2026-05-10 11:50', status: 'received', wipId: null,       expIds: ['tct'] },
  { id: 'W040802',  size: '200mm', requestId: 10, urgency: '1w', arrivedAt: '2026-05-10 11:50', status: 'received', wipId: null,       expIds: ['tct'] },
  { id: 'W040805B', size: '200mm', requestId: 8,  urgency: '3d', arrivedAt: '2026-05-10 09:30', status: 'in_wip',   wipId: 'WIP-7699', expIds: ['tct', 'cp'] },
  { id: 'W040805C', size: '200mm', requestId: 7,  urgency: '1w', arrivedAt: '2026-05-09 14:08', status: 'rejected', wipId: null,       expIds: ['tct'], reason: 'Wrong recipe specified' },
  { id: 'W040701',  size: '200mm', requestId: 6,  urgency: '1w', arrivedAt: '2026-05-08 15:30', status: 'completed', wipId: null,      expIds: ['tct'] },
  // Wafers attached to manager-side submitted requests — still incoming so the
  // manager can drill into them from the All Requests detail page.
  { id: 'W0509A',   size: '300mm', requestId: 22, urgency: '3d', arrivedAt: '2026-05-09 08:14', status: 'incoming', wipId: null,       expIds: ['hast'] },
  { id: 'W050801',  size: '200mm', requestId: 21, urgency: '1w', arrivedAt: '2026-05-08 14:30', status: 'incoming', wipId: null,       expIds: ['tct'] },
  { id: 'W050802',  size: '200mm', requestId: 21, urgency: '1w', arrivedAt: '2026-05-08 14:30', status: 'incoming', wipId: null,       expIds: ['tct'] },
  { id: 'W050802C', size: '300mm', requestId: 20, urgency: '2w', arrivedAt: '2026-05-08 10:02', status: 'incoming', wipId: null,       expIds: ['cp'] },
];

const WIP_SEED = [
  { id: 'WIP-7701', equipmentId: 'QA-HAST-01', experimentId: 'hast', waferIds: ['W041201'],            note: 'Long flow validation', status: 'in_progress', createdAt: '2026-05-11 07:00', dispatchIds: ['DP-3305'] },
  { id: 'WIP-7700', equipmentId: 'QA-TCT-01',  experimentId: 'tct',  waferIds: ['W041501'],            note: '',                     status: 'in_progress', createdAt: '2026-05-11 08:15', dispatchIds: ['DP-3308'] },
  { id: 'WIP-7699', equipmentId: 'QA-CP-B',    experimentId: 'cp',   waferIds: ['W040805B'],           note: 'Testing for micro-crack propagation in TSV structures.', status: 'in_progress', createdAt: '2026-05-11 09:45', dispatchIds: ['DP-3304'] },
  { id: 'WIP-7698', equipmentId: 'QA-TCT-02',  experimentId: 'tct',  waferIds: ['W040701'],            note: '',                     status: 'completed',   createdAt: '2026-05-08 10:00', dispatchIds: ['DP-3300'] },
];

// Live tile-count fetch for the Lab Dashboard. Mirrors the fab dashboard's
// useRequests pattern but pulls three lists in parallel so the four count
// tiles (Incoming wafers / Active WIPs / Dispatches live / To record) all
// reflect the same snapshot. Returns the raw normalized lists; the
// dashboard derives the counts client-side.
const useLabDashboardData = () => {
  const [samples, setSamples] = lS([]);
  const [wips, setWips] = lS([]);
  const [dispatches, setDispatches] = lS([]);
  const [loading, setLoading] = lS(true);
  const [error, setError] = lS(null);
  const refresh = React.useCallback(() => {
    if (!window.api) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      window.api.samples.list(),
      window.api.wips.list(),
      window.api.dispatches.list(),
    ])
      .then(([ss, ws, ds]) => {
        setSamples(ss); setWips(ws); setDispatches(ds); setError(null);
      })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return { samples, wips, dispatches, loading, error, refresh };
};

// Live samples list. Co-fetches /requests/ so each row can show the
// urgency window (urgency lives on the parent request, not the sample —
// see INTEGRATION_GAPS.md §3.7). Returns frontend-shaped wafers with the
// integer PK as `id` and the human-readable wafer id as `wafer`.
const useLabSamples = () => {
  const [samples, setSamples] = lS([]);
  const [requestsById, setRequestsById] = lS(new Map());
  const [loading, setLoading] = lS(true);
  const [error, setError] = lS(null);
  const refresh = React.useCallback(() => {
    if (!window.api || !window.api.samples) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      window.api.samples.list(),
      window.api.requests.list().catch(() => []),
    ])
      .then(([ss, rs]) => {
        setSamples(ss);
        setRequestsById(new Map(rs.map(r => [r.id, r])));
        setError(null);
      })
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);

  // Join urgency from the parent request so the countdown widget works.
  // Default to '1w' if the request isn't visible to the current user.
  const wafers = samples.map(s => ({
    ...s,
    urgency: requestsById.get(s.requestId)?.urgency || '1w',
  }));
  return { wafers, loading, error, refresh };
};

const DISPATCH_SEED = [
  { id: 'DP-3308', wipId: 'WIP-7700', equipmentId: 'QA-TCT-01',  experimentId: 'tct',  recipeId: 'tct_std',  operator: 'lab_member', status: 'running',        dispatchedAt: '2026-05-11 08:30', startedAt: '2026-05-11 08:35', endedAt: null,               result: null },
  { id: 'DP-3305', wipId: 'WIP-7701', equipmentId: 'QA-HAST-01', experimentId: 'hast', recipeId: 'hast_std', operator: 'lab_member', status: 'running',        dispatchedAt: '2026-05-11 07:05', startedAt: '2026-05-11 07:10', endedAt: null,               result: null },
  { id: 'DP-3304', wipId: 'WIP-7699', equipmentId: 'QA-CP-B',    experimentId: 'cp',   recipeId: 'cp_full',  operator: 'lab_member', status: 'pending',        dispatchedAt: '2026-05-11 10:05', startedAt: null,               endedAt: null,               result: null },
  { id: 'DP-3303', wipId: 'WIP-7698', equipmentId: 'QA-TCT-02',  experimentId: 'tct',  recipeId: 'tct_std',  operator: 'lab_member', status: 'result_recorded',dispatchedAt: '2026-05-08 10:20', startedAt: '2026-05-08 10:25', endedAt: '2026-05-09 13:40', result: { summary: 'All cycles completed nominally.', verdict: 'pass', data: '{"cycles": 500, "failures": 0}', note: '', recordedAt: '2026-05-09 14:05' } },
  { id: 'DP-3302', wipId: 'WIP-7698', equipmentId: 'QA-TCT-02',  experimentId: 'tct',  recipeId: 'tct_std',  operator: 'lab_member', status: 'unloaded',       dispatchedAt: '2026-05-08 14:00', startedAt: '2026-05-08 14:05', endedAt: '2026-05-09 16:00', result: null },
];

// ── Lookups + design tokens ────────────────────────────────────
const ink     = '#1e1e24';
const text2   = '#5a5a6e';
const muted   = '#8e8ea0';
const line    = 'rgba(0,0,0,0.08)';
const lineSoft= 'rgba(0,0,0,0.05)';
const surface = '#fff';
const bgSoft  = '#f7f7fa';
const accent  = '#6c67b8';

const PILL = {
  // wafer
  incoming:  { label: 'Incoming',  bg: '#fef4dd', fg: '#a06618' },
  received:  { label: 'Received',  bg: '#e7f0e9', fg: '#2e6a47' },
  rejected:  { label: 'Rejected',  bg: '#fbe4e6', fg: '#a93445' },
  in_wip:    { label: 'In WIP',    bg: '#ecebf3', fg: '#4f4a8f' },
  completed: { label: 'Completed', bg: '#dbeafe', fg: '#1d4ed8' },
  // urgency
  '3d':      { label: '3 Days',    bg: '#fbe4e6', fg: '#a93445' },
  '1w':      { label: '1 Week',    bg: '#ecebf3', fg: '#4f4a8f' },
  '2w':      { label: '2 Weeks',   bg: '#eef0ed', fg: '#4d5a4f' },
  // wip
  in_progress: { label: 'In Progress', bg: '#ecebf3', fg: '#4f4a8f' },
  aborted:     { label: 'Aborted',     bg: '#fbe4e6', fg: '#a93445' },
  // dispatch
  dispatched:      { label: 'Dispatched',      bg: '#ecedf0', fg: '#5a5a6e' },
  pending:         { label: 'Pending',         bg: '#fef4dd', fg: '#a06618' },
  running:         { label: 'Running',         bg: '#ecebf3', fg: '#4f4a8f' },
  unloaded:        { label: 'Unloaded',        bg: '#e3eef3', fg: '#356a82' },
  exception:       { label: 'Exception',       bg: '#fde9d8', fg: '#9a4715' },
  result_recorded: { label: 'Result Recorded', bg: '#e7f0e9', fg: '#2e6a47' },
  // equipment
  idle:        { label: 'Idle',        bg: '#e7f0e9', fg: '#2e6a47' },
  maintenance: { label: 'Maintenance', bg: '#fbe4e6', fg: '#a93445' },
  // verdict
  pass:        { label: 'Pass',        bg: '#e7f0e9', fg: '#2e6a47' },
  fail:        { label: 'Fail',        bg: '#fbe4e6', fg: '#a93445' },
};

const findExp     = (id) => EXPERIMENTS.find(e => e.id === id);
const findEq      = (id, eqs) => eqs.find(e => e.id === id);
const findWaf     = (id, wfs) => wfs.find(w => w.id === id);
const findWip     = (id, wps) => wps.find(w => w.id === id);
const findRecipe  = (id) => RECIPES.find(r => r.id === id);
const recipesFor  = (expId) => RECIPES.filter(r => r.expId === expId);
const dispatchesOf= (wipId, dps) => dps.filter(d => d.wipId === wipId);

// ── Primitives ──────────────────────────────────────────────────
const Page = ({ title, subtitle, breadcrumb, right, children }) => (
  <div style={{ padding: '32px 44px 80px', maxWidth: 1320, margin: '0 auto' }}>
    {breadcrumb}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        {title && <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: ink }}>{title}</h1>}
        {subtitle && <div style={{ fontSize: 13, color: text2, marginTop: 6 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display: 'inline-flex', gap: 10, flexShrink: 0 }}>{right}</div>}
    </div>
    {children}
  </div>
);

const Card = ({ children, padding = 22, style }) => (
  <div style={{
    background: surface, borderRadius: 12, border: `1px solid ${line}`,
    padding, ...style,
  }}>{children}</div>
);

const CardHeader = ({ children, style }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 20px', borderBottom: `1px solid ${lineSoft}`,
    fontSize: 11, fontWeight: 700, color: text2,
    textTransform: 'uppercase', letterSpacing: '0.08em', ...style,
  }}>{children}</div>
);

const FieldLabel = ({ children, required }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: text2, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {children}{required && <span style={{ color: '#c0394a' }}>*</span>}
  </div>
);

const PrimaryBtn = ({ children, onClick, icon, disabled, style, danger, success }) => {
  const bg = disabled ? '#dcdce3'
           : danger   ? '#b9384a'
           : success  ? '#2e6a47'
           :            ink;
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
const SecondaryBtn = ({ children, onClick, icon, style, danger, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 14px', borderRadius: 8,
    background: '#fff', color: disabled ? muted : (danger ? '#b9384a' : ink),
    border: `1px solid ${danger ? '#e6c2c7' : line}`,
    fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    fontFamily: 'inherit', ...style,
  }}>{icon}{children}</button>
);

const Pill = ({ kind, dotted }) => {
  const p = PILL[kind] || { label: kind, bg: '#ecedf0', fg: '#5a5a6e' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 999,
      background: p.bg, color: p.fg, fontSize: 11.5, fontWeight: 700,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      {dotted && <span style={{ width: 6, height: 6, borderRadius: 999, background: p.fg, animation: kind === 'running' ? 'pulse 1.4s ease-in-out infinite' : 'none' }}/>}
      {p.label}
    </span>
  );
};

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1px solid ${line}`, background: '#fff',
  fontSize: 13.5, color: ink, fontFamily: 'inherit', outline: 'none',
};

const TextInput = (p) => <input {...p} style={{ ...inputStyle, ...p.style }}/>;
const SelectInput = ({ value, onChange, children, style }) => (
  <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: 'pointer', ...style }}>{children}</select>
);
const TextArea = (p) => <textarea {...p} style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', ...p.style }}/>;

// Modal shell
const Modal = ({ open, onClose, title, children, width = 540, footer }) => {
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
          padding: '20px 24px', borderBottom: `1px solid ${lineSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: ink }}>{title}</div>
          <button onClick={onClose} style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 4,
            color: muted, display: 'inline-flex',
          }}><LF.X size={18}/></button>
        </div>
        <div style={{ padding: 24, overflow: 'auto' }}>{children}</div>
        {footer && (
          <div style={{
            padding: '14px 24px', borderTop: `1px solid ${lineSoft}`,
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
};

const Breadcrumb = ({ items }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 14, fontSize: 13 }}>
    {items.map((it, i) => (
      <React.Fragment key={i}>
        {i > 0 && <LF.ChevronRight size={13} color={muted}/>}
        {it.onClick ? (
          <button onClick={it.onClick} style={{
            background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer',
            color: accent, fontWeight: 600, fontFamily: 'inherit', fontSize: 13,
          }}>{it.label}</button>
        ) : (
          <span style={{ color: text2, fontWeight: 500, padding: '2px 4px' }}>{it.label}</span>
        )}
      </React.Fragment>
    ))}
  </div>
);

// ── Dashboard ───────────────────────────────────────────────────
const DashHero = ({ counts, navigate }) => {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Deterministic "stars" so the layout is stable across renders.
  const stars = lM(() => {
    const arr = [];
    const rng = (seed) => { let x = seed * 9301 + 49297; return ((x % 233280) / 233280); };
    for (let i = 0; i < 38; i++) {
      arr.push({
        left: rng(i + 1) * 100,
        top:  rng(i + 17) * 100,
        size: 1 + rng(i + 31) * 2.4,
        delay: rng(i + 47) * 6,
        dur:  3.5 + rng(i + 53) * 4,
      });
    }
    return arr;
  }, []);

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 18, marginBottom: 22,
      background: 'linear-gradient(135deg, #1a1726 0%, #2a2342 45%, #3a2a4f 100%)',
      color: '#fff', padding: '36px 40px 32px',
      boxShadow: '0 14px 40px -16px rgba(36, 28, 64, 0.45)',
    }}>
      {/* dot grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.3,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '20px 20px', pointerEvents: 'none',
      }}/>
      {/* twinkle stars */}
      {stars.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size, borderRadius: 999,
          background: i % 3 === 0 ? '#f4a8bf' : i % 3 === 1 ? '#bbb7e8' : '#fff',
          opacity: 0.6, pointerEvents: 'none',
          animation: `lims-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
        }}/>
      ))}
      {/* glow orb */}
      <div style={{
        position: 'absolute', right: -120, top: -80,
        width: 360, height: 360, borderRadius: 999,
        background: 'radial-gradient(circle at center, rgba(244,168,191,0.35), rgba(244,168,191,0) 65%)',
        pointerEvents: 'none', filter: 'blur(8px)',
      }}/>
      <div style={{
        position: 'absolute', right: 80, bottom: -100,
        width: 280, height: 280, borderRadius: 999,
        background: 'radial-gradient(circle at center, rgba(108,103,184,0.45), rgba(108,103,184,0) 65%)',
        pointerEvents: 'none', filter: 'blur(8px)',
      }}/>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'flex-end', gap: 32 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#bbb7e8', marginBottom: 14 }}>
            ✦ Lab Operations · {TODAY}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 600, margin: 0,
            letterSpacing: '-0.02em', lineHeight: 1.1, color: '#fff',
          }}>
            {greeting},<br/>
            <span style={{
              background: 'linear-gradient(90deg, #f4a8bf, #bbb7e8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>lab_member</span>
          </h1>
          <div style={{ marginTop: 14, fontSize: 14, color: '#d8d4eb', maxWidth: 520, lineHeight: 1.55 }}>
            {counts.running > 0
              ? <>{counts.running} experiment{counts.running === 1 ? '' : 's'} running. {counts.needsRecord > 0 ? `${counts.needsRecord} awaiting your result.` : 'No results pending.'}</>
              : counts.incoming > 0
                ? <>{counts.incoming} wafer{counts.incoming === 1 ? '' : 's'} just arrived from the fab.</>
                : <>Quiet shift. All chambers clear.</>}
          </div>
        </div>

        {/* Mini stat orbs */}
        <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
          {[
            { v: counts.running,      l: 'Running',  c: '#f4a8bf', onClick: () => navigate({ page: 'lab_dispatches', tab: 'active' }), pulse: counts.running > 0 },
            { v: counts.needsRecord,  l: 'To record', c: '#bbb7e8', onClick: () => navigate({ page: 'lab_dispatches', tab: 'record' }) },
            { v: counts.incoming,     l: 'Incoming', c: '#6c67b8', onClick: () => navigate({ page: 'lab_samples', tab: 'incoming' }) },
          ].map(s => (
            <button key={s.l} onClick={s.onClick} style={{
              width: 110, padding: '14px 12px', borderRadius: 14,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(6px)', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'center', position: 'relative',
              transition: 'transform 0.18s, background 0.18s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{
                position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 6,
              }}>
                {s.pulse && <span style={{
                  position: 'absolute', inset: -2, borderRadius: 999,
                  border: `2px solid ${s.c}`, opacity: 0.6,
                  animation: 'pulse 1.6s ease-in-out infinite',
                }}/>}
                <span style={{
                  width: 8, height: 8, borderRadius: 999, background: s.c,
                  boxShadow: `0 0 10px ${s.c}`,
                }}/>
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700,
                color: '#fff', letterSpacing: '-0.02em', lineHeight: 1,
              }}>{s.v}</div>
              <div style={{ fontSize: 11, color: '#bbb7e8', marginTop: 6, fontWeight: 600, letterSpacing: '0.04em' }}>{s.l}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const RunningDispatchRow = ({ d, wip, navigate }) => {
  const exp = findExp(d.experimentId);
  const isRunning = d.status === 'running';
  // Soft progress estimate based on elapsed time vs. assumed 24h cycle.
  const pct = lM(() => {
    if (!d.startedAt) return 0;
    const start = new Date(d.startedAt.replace(' ', 'T')).getTime();
    const elapsed = Date.now() - start;
    return Math.max(8, Math.min(94, (elapsed / (1000 * 60 * 60 * 24)) * 100));
  }, [d.startedAt]);

  return (
    <button onClick={() => navigate({ page: 'lab_dispatch_detail', id: d.id })} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: '16px 22px', borderTop: `1px solid ${lineSoft}`,
      background: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      transition: 'background 0.15s',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#faf9fc'}
      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: muted, marginBottom: 3 }}>
            <span>{d.id}</span>
            <span style={{ color: '#cdcdda' }}>·</span>
            <span>{d.equipmentId || wip?.equipmentId || '—'}</span>
            <span style={{ color: '#cdcdda' }}>·</span>
            <span>{wip?.waferIds.length} wafer{wip?.waferIds.length === 1 ? '' : 's'}</span>
          </div>
          <div style={{ fontSize: 14.5, color: ink, fontWeight: 600 }}>{exp?.name}</div>
        </div>
        <Pill kind={d.status} dotted/>
      </div>
      {isRunning && (
        <div style={{ position: 'relative', height: 6, background: '#f1eef9', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${pct}%`,
            background: 'linear-gradient(90deg, #f4a8bf, #6c67b8)',
            borderRadius: 999,
          }}/>
          <div style={{
            position: 'absolute', top: -2, left: `calc(${pct}% - 5px)`,
            width: 10, height: 10, borderRadius: 999,
            background: '#fff', border: '2px solid #6c67b8',
            boxShadow: '0 0 0 0 rgba(108,103,184,0.4)',
            animation: 'ringpulse 1.8s ease-out infinite',
          }}/>
        </div>
      )}
    </button>
  );
};

const EquipmentDots = ({ used, capacity }) => {
  const cells = Array.from({ length: capacity });
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
      {cells.map((_, i) => (
        <span key={i} style={{
          width: 9, height: 9, borderRadius: 999,
          background: i < used ? '#6c67b8' : '#ececf2',
          boxShadow: i < used ? '0 0 6px rgba(108,103,184,0.45)' : 'none',
        }}/>
      ))}
    </div>
  );
};

const LabDashboard = ({ wafers, wips, dispatches, equipment, navigate }) => {
  // Tile counts come from a live fetch (samples + wips + dispatches in
  // parallel). The lower panels — Now Running, Awaiting Your Result,
  // Equipment — still render from the seed-fed props until those sections
  // get their own wiring pass.
  const { samples: liveSamples, wips: liveWips, dispatches: liveDispatches, loading: countsLoading, error: countsError } = useLabDashboardData();
  const incoming   = liveSamples.filter(s => s.status === 'incoming').length;
  const activeWips = liveWips.filter(w => w.status === 'in_progress').length;
  const runningDps = liveDispatches.filter(d => d.status === 'running').length;
  const needsRecord= liveDispatches.filter(d => d.status === 'unloaded' || d.status === 'exception').length;

  const activeDispatches = dispatches.filter(d => d.status === 'running' || d.status === 'pending');
  const toRecord = dispatches.filter(d => d.status === 'unloaded' || d.status === 'exception');

  // While the initial fetch is in flight, render "—" on the tiles rather
  // than the misleading "0" that an empty filter would produce.
  const initialLoad = countsLoading && liveSamples.length === 0 && liveWips.length === 0 && liveDispatches.length === 0;
  const v = (n) => initialLoad ? '—' : n;
  const tiles = [
    { label: 'Incoming wafers', value: v(incoming),    onClick: () => navigate({ page: 'lab_samples', tab: 'incoming' }), icon: <LF.Inbox size={16} color="#a06618"/>, tint: '#fef4dd' },
    { label: 'Active WIPs',     value: v(activeWips),  onClick: () => navigate({ page: 'lab_wip' }),                       icon: <LF.WIP   size={16} color="#4f4a8f"/>, tint: '#ecebf3' },
    { label: 'Dispatches live', value: v(runningDps),  onClick: () => navigate({ page: 'lab_dispatches', tab: 'active' }), icon: <LF.Activity size={16} color="#a93445"/>, tint: '#fbe4e6' },
    { label: 'To record',       value: v(needsRecord), onClick: () => navigate({ page: 'lab_dispatches', tab: 'record' }), icon: <LF.ClipboardList size={16} color="#2e6a47"/>, tint: '#e7f0e9' },
  ];

  return (
    <Page
      title="Dashboard"
      subtitle={`Welcome back, lab_member · ${TODAY}`}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {tiles.map(t => (
          <button key={t.label} onClick={t.onClick} style={{
            position: 'relative', textAlign: 'left', padding: '16px 18px',
            borderRadius: 14, background: surface,
            border: `1px solid ${line}`, cursor: 'pointer',
            fontFamily: 'inherit', overflow: 'hidden',
            transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(108,103,184,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px -14px rgba(108,103,184,0.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = line; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9,
                background: t.tint, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
              }}>{t.icon}</span>
              <span style={{ fontSize: 12, color: text2, fontWeight: 600 }}>{t.label}</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700,
              color: ink, letterSpacing: '-0.02em', lineHeight: 1,
            }}>{t.value}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card padding={0}>
            <CardHeader>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 999, background: '#f4a8bf',
                  boxShadow: '0 0 10px #f4a8bf',
                  animation: 'pulse 1.6s ease-in-out infinite',
                }}/>
                Now Running
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: muted, fontWeight: 600 }}>{activeDispatches.length} active</span>
            </CardHeader>
            <div>
              {activeDispatches.length === 0 && (
                <div style={{ padding: '28px 22px', textAlign: 'center', color: muted, fontSize: 13 }}>No active dispatches</div>
              )}
              {activeDispatches.map(d => (
                <RunningDispatchRow key={d.id} d={d} wip={findWip(d.wipId, wips)} navigate={navigate}/>
              ))}
            </div>
          </Card>

          {toRecord.length > 0 && (
            <Card padding={0} style={{
              borderColor: 'rgba(108,103,184,0.32)',
              boxShadow: '0 8px 28px -18px rgba(108,103,184,0.45)',
            }}>
              <CardHeader style={{
                background: 'linear-gradient(90deg, rgba(244,168,191,0.12), rgba(187,183,232,0.12))',
                borderBottom: `1px solid ${lineSoft}`,
              }}>
                <LF.ClipboardList size={13} color={accent}/>
                <span>Awaiting Your Result</span>
                <span style={{
                  marginLeft: 'auto', padding: '2px 8px', borderRadius: 999,
                  background: '#ecebf3', color: '#4f4a8f', fontSize: 11, fontWeight: 700,
                }}>{toRecord.length}</span>
              </CardHeader>
              {toRecord.map(d => {
                const wip = findWip(d.wipId, wips);
                return (
                  <button key={d.id} onClick={() => navigate({ page: 'lab_dispatch_detail', id: d.id })} style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 130px auto',
                    alignItems: 'center', gap: 12, width: '100%',
                    padding: '13px 22px', borderTop: `1px solid ${lineSoft}`,
                    background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: text2 }}>{d.id}</span>
                    <span style={{ fontSize: 13.5, color: ink, fontWeight: 600 }}>{findExp(d.experimentId)?.name}</span>
                    <Pill kind={d.status}/>
                    <span style={{ fontSize: 12, color: accent, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Record <LF.ArrowRight size={12} color={accent}/>
                    </span>
                  </button>
                );
              })}
            </Card>
          )}
        </div>

        <Card padding={0}>
          <CardHeader>
            <LF.Equipment size={13} color={text2}/>
            <span>Equipment</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: muted, fontWeight: 600 }}>
              {equipment.filter(e => e.status === 'running').length}/{equipment.length} live
            </span>
          </CardHeader>
          <div>
            {equipment.map(e => {
              const wip = e.currentWipId ? findWip(e.currentWipId, wips) : null;
              const used = wip ? wip.waferIds.length : 0;
              return (
                <button key={e.id} onClick={() => navigate({ page: 'lab_equipment' })} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '14px 20px', borderTop: `1px solid ${lineSoft}`,
                  background: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = '#faf9fc'}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = '#fff'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: ink }}>{e.id}</span>
                    <Pill kind={e.status} dotted={e.status === 'running'}/>
                  </div>
                  <div style={{ fontSize: 11.5, color: muted }}>
                    {wip ? `${wip.id} · ${used}/${e.capacity}` : e.status === 'maintenance' ? 'Under maintenance' : `Idle · cap ${e.capacity}`}
                  </div>
                  <EquipmentDots used={used} capacity={e.capacity}/>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </Page>
  );
};

// ── Samples ─────────────────────────────────────────────────────
// Time-remaining countdown — starts when the wafer is received, urgency
// defines the window (3 Days / 1 Week / 2 Weeks). Rows tinted red are
// at or past the deadline.
const URGENCY_DAYS = { '3d': 3, '1w': 7, '2w': 14 };
// Pinned "now" so the demo data is meaningful regardless of when the file is
// opened — matches the TODAY const used elsewhere on the lab side.
const TODAY_MS = new Date(TODAY + 'T12:00:00').getTime();
const computeRemaining = (w) => {
  // Until a wafer is received the countdown hasn't started — show nothing.
  // Rejected wafers also don't carry a meaningful deadline.
  if (w.status === 'incoming' || w.status === 'rejected') return null;
  const days = URGENCY_DAYS[w.urgency] ?? 7;
  const start = new Date(w.arrivedAt.replace(' ', 'T') + ':00').getTime();
  const deadline = start + days * 86400000;
  return deadline - TODAY_MS;
};
const formatRemaining = (ms) => {
  if (ms == null) return { text: '—', level: 'none' };
  if (ms < 0) {
    const d = Math.ceil(-ms / 86400000);
    return { text: `Overdue ${d}d`, level: 'overdue' };
  }
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d === 0) return { text: h <= 0 ? 'Due now' : `${h}h left`, level: 'critical' };
  if (d <= 1) return { text: `${d}d ${h}h left`, level: 'critical' };
  if (d <= 3) return { text: `${d}d left`, level: 'warning' };
  return { text: `${d}d left`, level: 'normal' };
};
const REMAINING_STYLE = {
  overdue:  { bg: '#fbd5d9', fg: '#9a283a', rowBg: '#fce3e6' }, // bold rose — past deadline
  critical: { bg: '#fde4e4', fg: '#c0394a', rowBg: '#fcecee' }, // due today / tomorrow
  warning:  { bg: '#fef0d4', fg: '#b8720e', rowBg: '#fdf6e6' }, // 2–3 days
  normal:   { bg: '#ecedf0', fg: '#5a5a6e', rowBg: '#fff'    }, // 4+ days
  none:     { bg: '#ecedf0', fg: '#8e8ea0', rowBg: '#fff'    }, // not started
};

const LabSamples = ({ navigate, defaultTab = 'all', showToast }) => {
  const { wafers, loading, error, refresh } = useLabSamples();
  const [tab, setTab] = lS(defaultTab);
  const [busyIds, setBusyIds] = lS(new Set());
  const [actionError, setActionError] = lS(null);

  const runAction = async (id, op, label) => {
    setBusyIds(prev => new Set(prev).add(id));
    setActionError(null);
    try {
      await op();
      showToast && showToast(label);
      refresh();
    } catch (e) {
      setActionError(e.message || String(e));
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  const handleReceive = (w) => runAction(w.id, () => window.api.samples.receive(w.id), `${w.wafer} received`);
  // reason is optional on the backend; pass empty so the sample note isn't
  // littered with a placeholder string. A real reason prompt can come later.
  const handleReject = (w) => runAction(w.id, () => window.api.samples.rejectReceiving(w.id, ''), `${w.wafer} rejected`);
  const handleBulkReceive = () => {
    wafers
      .filter(w => w.status === 'incoming' && !busyIds.has(w.id))
      .forEach(handleReceive);
  };

  const tabs = [
    { id: 'all',       label: 'All',       count: wafers.length },
    { id: 'incoming',  label: 'Incoming',  count: wafers.filter(w => w.status === 'incoming').length },
    { id: 'received',  label: 'Received',  count: wafers.filter(w => w.status === 'received').length },
    { id: 'in_wip',    label: 'In WIP',    count: wafers.filter(w => w.status === 'in_wip').length },
    { id: 'completed', label: 'Completed', count: wafers.filter(w => w.status === 'completed').length },
    { id: 'rejected',  label: 'Rejected',  count: wafers.filter(w => w.status === 'rejected').length },
  ];
  const list = tab === 'all' ? wafers : wafers.filter(w => w.status === tab);

  if (loading && wafers.length === 0) {
    return (
      <Page title="Samples" subtitle="Loading…">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: muted, fontSize: 14 }}>
          Loading…
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Samples"
      subtitle="Wafers from fab — countdown starts when received. Red rows are past deadline."
      right={
        <SecondaryBtn icon={<LF.Inbox size={14}/>} onClick={handleBulkReceive}>Bulk receive incoming</SecondaryBtn>
      }
    >
      {(error || actionError) && (
        <div style={{
          padding: '12px 16px', marginBottom: 14, borderRadius: 10,
          background: '#fde4e4', color: '#c0394a', fontSize: 13.5, fontWeight: 500,
          border: '1px solid #f6c4c4',
        }}>
          {error || actionError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: `1px solid ${line}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 14px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? ink : 'transparent'}`,
            color: tab === t.id ? ink : text2, fontWeight: 600, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
          }}>
            {t.label}
            <span style={{
              padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: tab === t.id ? '#ecebf3' : '#f1f1f5',
              color: tab === t.id ? '#4f4a8f' : muted,
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, color: muted, marginBottom: 14 }}>
        Showing <strong style={{ color: ink }}>{list.length}</strong> of {wafers.length} wafer{wafers.length === 1 ? '' : 's'}
      </div>

      {/* Card-row list — same chrome as fab's My Requests */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 ? (
          <Card padding={48} style={{ textAlign: 'center', color: muted }}>
            <LF.Inbox size={32} color="#cbcbd6" style={{ marginBottom: 10 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: text2 }}>No wafers in this view</div>
          </Card>
        ) : list.map(w => {
          const remaining = computeRemaining(w);
          const fmt = formatRemaining(remaining);
          const style = REMAINING_STYLE[fmt.level];
          const showDot = fmt.level === 'overdue' || fmt.level === 'critical';
          const busy = busyIds.has(w.id);
          return (
            <button key={w.id} onClick={() => navigate({ page: 'lab_wafer', id: w.id })} style={{
              display: 'grid',
              gridTemplateColumns: '110px minmax(0,1fr) 150px 130px 150px 24px',
              alignItems: 'center', gap: 18,
              padding: '18px 22px', borderRadius: 14,
              background: style.rowBg,
              border: `1px solid ${fmt.level === 'overdue' ? '#f1b9c0' : 'rgba(0,0,0,0.08)'}`,
              textAlign: 'left', cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
              fontFamily: 'inherit',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = fmt.level === 'overdue' ? '#e88a93' : 'rgba(0,0,0,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = fmt.level === 'overdue' ? '#f1b9c0' : 'rgba(0,0,0,0.08)'; }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {showDot && <span title="Past or near deadline" style={{ width: 6, height: 6, borderRadius: 999, background: '#c0394a', flexShrink: 0 }}/>}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: ink, letterSpacing: '0.02em' }}>{w.wafer}</span>
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: ink }}>
                  {w.size} <span style={{ color: muted, fontWeight: 500 }}>· #{String(w.requestId).padStart(4,'0')}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12.5, color: muted }}>
                  <LF.Calendar size={12}/>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{w.arrivedAt || '—'}</span>
                  <span>·</span>
                  <span>{(URGENCY_DAYS[w.urgency] === 3 ? '3-day' : URGENCY_DAYS[w.urgency] === 7 ? '1-week' : '2-week')} window</span>
                </div>
              </div>
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 11px', borderRadius: 999,
                  background: style.bg, color: style.fg,
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap',
                }}>
                  {fmt.level !== 'none' && <LF.Clock size={11} color={style.fg}/>}
                  {fmt.text}
                </span>
              </div>
              <div><Pill kind={w.status}/></div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}
                onClick={(e) => e.stopPropagation()}>
                {w.status === 'incoming' ? (
                  <>
                    <SecondaryBtn onClick={() => handleReceive(w)} disabled={busy} style={{ padding: '5px 10px', fontSize: 12 }}>{busy ? '…' : 'Receive'}</SecondaryBtn>
                    <SecondaryBtn danger onClick={() => handleReject(w)} disabled={busy} style={{ padding: '5px 10px', fontSize: 12 }}>{busy ? '…' : 'Reject'}</SecondaryBtn>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: muted }}>—</span>
                )}
              </div>
              <LF.ChevronRight size={15} color="#cbcbd6"/>
            </button>
          );
        })}
      </div>
    </Page>
  );
};

// ── Wafer detail ────────────────────────────────────────────────
const LabWaferDetail = ({ id, wafers, wips, dispatches, navigate, onReceive, onReject }) => {
  const w = findWaf(id, wafers);
  if (!w) return <Page title="Wafer not found"/>;
  const wip = w.wipId ? findWip(w.wipId, wips) : null;
  const wipDispatches = wip ? dispatchesOf(wip.id, dispatches) : [];

  // Resolve every required experiment + its execution state for this wafer.
  // A dispatch with status=result_recorded against a WIP we passed through counts
  // as "done"; running/pending counts as "in progress"; otherwise it's pending.
  const expRows = (w.expIds || []).map(expId => {
    const exp = findExp(expId);
    // Look across all dispatches for this wafer's current WIP that match this experiment.
    const dps = wipDispatches.filter(d => d.experimentId === expId);
    const recorded = dps.find(d => d.status === 'result_recorded');
    const running  = dps.find(d => d.status === 'running' || d.status === 'pending' || d.status === 'dispatched');
    let state = 'pending';
    if (recorded) state = 'recorded';
    else if (running) state = 'running';
    return { exp, state, dispatch: recorded || running || null };
  });

  return (
    <Page
      breadcrumb={<Breadcrumb items={[
        { label: 'Samples', onClick: () => navigate({ page: 'lab_samples' }) },
        { label: w.id },
      ]}/>}
      title={w.id}
      subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', color: muted }}>Request #{String(w.requestId).padStart(4,'0')}</span>
        <Pill kind={w.status}/>
        <Pill kind={w.urgency}/>
      </span>}
      right={w.status === 'incoming' && (<>
        <SecondaryBtn danger onClick={() => onReject(w.id)} icon={<LF.X size={14}/>}>Reject</SecondaryBtn>
        <PrimaryBtn onClick={() => onReceive(w.id)} icon={<LF.Check size={14}/>}>Receive</PrimaryBtn>
      </>)}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card padding={0}>
            <CardHeader>Wafer Info</CardHeader>
            <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 12 }}>
              <div style={{ fontSize: 13, color: text2 }}>Wafer ID</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: ink }}>{w.id}</div>
              <div style={{ fontSize: 13, color: text2 }}>Size</div>
              <div style={{ fontSize: 14, color: ink }}>{w.size}</div>
              <div style={{ fontSize: 13, color: text2 }}>From request</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: ink }}>#{String(w.requestId).padStart(4,'0')}</div>
              <div style={{ fontSize: 13, color: text2 }}>Urgency</div>
              <div><Pill kind={w.urgency}/></div>
              <div style={{ fontSize: 13, color: text2 }}>Arrived at</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: ink }}>{w.arrivedAt}</div>
              <div style={{ fontSize: 13, color: text2 }}>Status</div>
              <div><Pill kind={w.status}/></div>
              {w.reason && <>
                <div style={{ fontSize: 13, color: text2 }}>Reject reason</div>
                <div style={{ fontSize: 14, color: ink }}>{w.reason}</div>
              </>}
            </div>
          </Card>

          {expRows.length > 0 && (
            <Card padding={0}>
              <CardHeader>
                <span>Experiments</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: muted, fontWeight: 600 }}>
                  {expRows.filter(r => r.state === 'recorded').length}/{expRows.length} done
                </span>
              </CardHeader>
              <div>
                {expRows.map(({ exp, state, dispatch }) => {
                  const stateInfo = state === 'recorded'
                    ? { bg: '#e7f0e9', fg: '#2e6a47', label: 'Done' }
                    : state === 'running'
                      ? { bg: '#ecebf3', fg: '#4f4a8f', label: 'In Progress' }
                      : { bg: '#fef4dd', fg: '#a06618', label: 'Pending' };
                  return (
                    <div key={exp.id} style={{
                      padding: '14px 20px', borderTop: `1px solid ${lineSoft}`,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                          background: '#ecebf3', color: '#4f4a8f', letterSpacing: '0.05em',
                        }}>{exp.code}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: ink, flex: 1 }}>{exp.name}</span>
                        <span style={{
                          padding: '3px 9px', borderRadius: 999,
                          background: stateInfo.bg, color: stateInfo.fg,
                          fontSize: 11.5, fontWeight: 700,
                        }}>{stateInfo.label}</span>
                      </div>
                      {dispatch?.result && (
                        <div style={{
                          padding: '10px 12px', background: bgSoft,
                          border: `1px solid ${lineSoft}`, borderRadius: 8,
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Pill kind={dispatch.result.verdict}/>
                            <span style={{ fontSize: 12, color: muted, fontFamily: 'var(--font-mono)' }}>{dispatch.id}</span>
                            <button onClick={() => navigate({ page: 'lab_dispatch_detail', id: dispatch.id })} style={{
                              marginLeft: 'auto', background: 'transparent', border: 'none', padding: 0,
                              cursor: 'pointer', color: accent, fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
                            }}>Open dispatch \u2192</button>
                          </div>
                          <div style={{ fontSize: 13, color: ink, lineHeight: 1.5 }}>{dispatch.result.summary}</div>
                          {dispatch.result.note && (
                            <div style={{ fontSize: 12.5, color: text2, fontStyle: 'italic' }}>{dispatch.result.note}</div>
                          )}
                        </div>
                      )}
                      {state === 'running' && dispatch && (
                        <div style={{ fontSize: 12.5, color: text2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#4f4a8f', animation: 'pulse 1.4s infinite' }}/>
                          Running on <strong style={{ color: ink, fontFamily: 'var(--font-mono)' }}>{dispatch.equipmentId}</strong> \u00b7 dispatch {dispatch.id}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {wip && (
            <Card padding={0}>
              <CardHeader>Current WIP</CardHeader>
              <button onClick={() => navigate({ page: 'lab_wip_detail', id: wip.id })} style={{
                width: '100%', textAlign: 'left', background: '#fff', border: 'none',
                padding: '16px 22px', cursor: 'pointer', fontFamily: 'inherit',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: ink }}>{wip.id}</div>
                  <div style={{ fontSize: 12.5, color: text2, marginTop: 4 }}>
                    {findExp(wip.experimentId)?.name}{wip.equipmentId ? ` → ${wip.equipmentId}` : ''}
                  </div>
                </div>
                <Pill kind={wip.status}/>
              </button>
              {wipDispatches.length > 0 && (
                <div style={{ borderTop: `1px solid ${lineSoft}` }}>
                  {wipDispatches.map(d => (
                    <button key={d.id} onClick={() => navigate({ page: 'lab_dispatch_detail', id: d.id })} style={{
                      display: 'grid', gridTemplateColumns: '90px 1fr 130px',
                      gap: 12, alignItems: 'center', width: '100%',
                      padding: '12px 22px', borderTop: `1px solid ${lineSoft}`,
                      background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit',
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: text2 }}>{d.id}</span>
                      <span style={{ fontSize: 13, color: ink }}>{findExp(d.experimentId)?.name}</span>
                      <Pill kind={d.status}/>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <Card padding={22}>
          <div style={{ fontSize: 11, fontWeight: 700, color: text2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Lifecycle</div>
          {[
            { k: 'incoming',  l: 'Arrived from fab' },
            { k: 'received',  l: 'Received at lab' },
            { k: 'in_wip',    l: 'Processing' },
            { k: 'completed', l: 'Experiment(s) done' },
          ].map((s, i, arr) => {
            const order = { incoming: 0, received: 1, in_wip: 2, completed: 3, rejected: 1 };
            const cur = order[w.status] ?? 0;
            const reached = i <= cur && w.status !== 'rejected';
            return (
              <div key={s.k} style={{ display: 'flex', gap: 10, paddingBottom: 12, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 999,
                    background: reached ? accent : '#e5e5ec',
                    border: '3px solid #fff',
                    boxShadow: `0 0 0 1.5px ${reached ? accent : '#e5e5ec'}`,
                  }}/>
                  {i < arr.length - 1 && <div style={{ flex: 1, width: 2, background: reached && i < cur ? accent : '#ececf2', marginTop: 2 }}/>}
                </div>
                <div style={{ paddingTop: 0, fontSize: 13, color: reached ? ink : muted, fontWeight: reached ? 600 : 500 }}>{s.l}</div>
              </div>
            );
          })}
          {w.status === 'rejected' && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#fbe4e6', color: '#a93445', fontSize: 12.5 }}>
              <strong>Rejected.</strong> {w.reason}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
};

// ── WIP list ────────────────────────────────────────────────────
const LabWipList = ({ wips, wafers, dispatches, navigate, openNewWip }) => {
  const [tab, setTab] = lS('active');
  const filtered = tab === 'active'
    ? wips.filter(w => w.status === 'in_progress')
    : tab === 'completed'
      ? wips.filter(w => w.status !== 'in_progress')
      : wips;

  return (
    <Page
      title="WIP"
      subtitle="Work-in-progress units — each WIP runs one experiment on one piece of equipment"
      right={<PrimaryBtn icon={<LF.Plus size={14}/>} onClick={openNewWip}>New WIP</PrimaryBtn>}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: `1px solid ${line}` }}>
        {[
          { id: 'active',    label: 'Active',    n: wips.filter(w => w.status === 'in_progress').length },
          { id: 'completed', label: 'Completed', n: wips.filter(w => w.status !== 'in_progress').length },
          { id: 'all',       label: 'All',       n: wips.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 14px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? ink : 'transparent'}`,
            color: tab === t.id ? ink : text2, fontWeight: 600, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
          }}>
            {t.label}
            <span style={{
              padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: tab === t.id ? '#ecebf3' : '#f1f1f5',
              color: tab === t.id ? '#4f4a8f' : muted,
            }}>{t.n}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, color: muted, marginBottom: 14 }}>
        Showing <strong style={{ color: ink }}>{filtered.length}</strong> of {wips.length} WIP{wips.length === 1 ? '' : 's'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <Card padding={48} style={{ textAlign: 'center', color: muted }}>
            <LF.WIP size={32} color="#cbcbd6" style={{ marginBottom: 10 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: text2 }}>No WIPs in this view</div>
          </Card>
        ) : filtered.map(w => {
          const exp = findExp(w.experimentId);
          return (
            <button key={w.id} onClick={() => navigate({ page: 'lab_wip_detail', id: w.id })} style={{
              display: 'grid',
              gridTemplateColumns: '110px minmax(0,1fr) 130px 80px 100px 140px 24px',
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: ink, letterSpacing: '0.02em' }}>{w.id}</span>
              <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                  background: '#ecebf3', color: '#4f4a8f', letterSpacing: '0.05em', flexShrink: 0,
                }}>{exp?.code}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp?.name}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
                    {w.note ? w.note : `created ${w.createdAt.split(' ')[0]}`}
                  </div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: w.equipmentId ? text2 : muted }}>{w.equipmentId || '—'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: text2 }}>
                <LF.Wafer size={12} color={muted} style={{ verticalAlign: '-2px', marginRight: 4 }}/>
                {w.waferIds.length}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: text2 }}>
                <LF.Dispatch size={12} color={muted} style={{ verticalAlign: '-2px', marginRight: 4 }}/>
                {w.dispatchIds.length}
              </span>
              <span><Pill kind={w.status} dotted={w.status === 'in_progress'}/></span>
              <LF.ChevronRight size={15} color="#cbcbd6"/>
            </button>
          );
        })}
      </div>
    </Page>
  );
};

// ── WIP detail (like screenshot 1) ──────────────────────────────
const LabWipDetail = ({ id, wips, wafers, dispatches, equipment, navigate, onCreateDispatch, onCompleteWip, onAbortWip }) => {
  const w = findWip(id, wips);
  if (!w) return <Page title="WIP not found"/>;
  const eq = w.equipmentId ? findEq(w.equipmentId, equipment) : null;
  const exp = findExp(w.experimentId);
  const wipDps = dispatchesOf(w.id, dispatches);
  const wWafers = w.waferIds.map(wid => findWaf(wid, wafers)).filter(Boolean);

  // The WIP already has an experiment type — dispatches inherit it. Only choices
  // left for a new dispatch: which piece of equipment, which recipe.
  const eligibleEquipment = equipment.filter(e => e.type === exp?.code);
  const firstFreeEq = eligibleEquipment.find(e => e.status !== 'maintenance' && (!e.currentWipId || e.currentWipId === w.id));
  const [newEqId, setNewEqId] = lS(w.equipmentId || firstFreeEq?.id || '');
  const [newRecipeId, setNewRecipeId] = lS(recipesFor(w.experimentId)[0]?.id || '');
  const [newNote, setNewNote] = lS('');
  const newRecipe = findRecipe(newRecipeId);

  const handleCreate = () => {
    if (!newRecipeId || !newEqId) return;
    onCreateDispatch(w.id, { experimentId: w.experimentId, equipmentId: newEqId, recipeId: newRecipeId, note: newNote });
    setNewNote('');
  };

  return (
    <Page
      breadcrumb={<Breadcrumb items={[
        { label: 'WIP', onClick: () => navigate({ page: 'lab_wip' }) },
        { label: w.id },
      ]}/>}
      title={w.id}
      subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Pill kind={w.status} dotted={w.status === 'in_progress'}/>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 999,
          background: '#ecebf3', color: '#4f4a8f',
          fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
            background: '#fff', color: '#4f4a8f', letterSpacing: '0.05em',
          }}>{exp?.code}</span>
          {exp?.name}
        </span>
        {w.equipmentId
          ? <span style={{ color: text2, fontSize: 13 }}>Equipment: <strong style={{ color: ink, fontFamily: 'var(--font-mono)' }}>{w.equipmentId}</strong></span>
          : <span style={{ color: muted, fontSize: 13, fontStyle: 'italic' }}>Equipment not yet assigned</span>}
        <span style={{ color: muted, fontSize: 13 }}>· {w.waferIds.length} wafer{w.waferIds.length === 1 ? '' : 's'}</span>
      </span>}
      right={w.status === 'in_progress' && <>
        <SecondaryBtn danger onClick={() => onAbortWip(w.id)}>Abort</SecondaryBtn>
        <PrimaryBtn success onClick={() => onCompleteWip(w.id)} icon={<LF.Check size={14}/>}>Complete WIP</PrimaryBtn>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card padding={0}>
            <CardHeader>Dispatches</CardHeader>
            {wipDps.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: muted, fontSize: 13 }}>No dispatches yet — create one below</div>
            ) : (
              <>
                <div style={{
                  display: 'grid', gridTemplateColumns: '70px 1.4fr 1.6fr 130px 80px',
                  padding: '10px 20px', borderBottom: `1px solid ${lineSoft}`, background: bgSoft,
                  fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  <div>ID</div><div>Exp. Type</div><div>Recipe</div><div>Status</div><div style={{ textAlign: 'right' }}>Action</div>
                </div>
                {wipDps.map(d => {
                  const rec = findRecipe(d.recipeId);
                  return (
                    <div key={d.id} style={{
                      display: 'grid', gridTemplateColumns: '70px 1.4fr 1.6fr 130px 80px',
                      alignItems: 'center', gap: 8,
                      padding: '13px 20px', borderTop: `1px solid ${lineSoft}`,
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: muted }}>#{d.id.replace('DP-','')}</span>
                      <span style={{ fontSize: 13, color: ink }}>{findExp(d.experimentId)?.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec?.name}</span>
                      <span><Pill kind={d.status} dotted={d.status === 'running'}/></span>
                      <button onClick={() => navigate({ page: 'lab_dispatch_detail', id: d.id })} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: accent, fontWeight: 600, fontSize: 12.5, textAlign: 'right', padding: 0, fontFamily: 'inherit',
                      }}>Manage</button>
                    </div>
                  );
                })}
              </>
            )}
          </Card>

          {w.status === 'in_progress' && (
            <Card padding={0}>
              <CardHeader>Add Dispatch</CardHeader>
              <div style={{ padding: 22 }}>
                {/* Experiment is fixed at WIP creation — display it, don't repick. */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  background: '#f7f6fb', border: `1px solid ${line}`,
                  marginBottom: 14,
                }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                    background: '#ecebf3', color: '#4f4a8f', letterSpacing: '0.05em',
                  }}>{exp?.code}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Experiment (from WIP)</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ink, marginTop: 2 }}>{exp?.name}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <FieldLabel required>Equipment</FieldLabel>
                    <SelectInput value={newEqId} onChange={(e) => setNewEqId(e.target.value)}>
                      <option value="">— select equipment —</option>
                      {eligibleEquipment.map(e => (
                        <option key={e.id} value={e.id} disabled={e.status === 'maintenance' || (e.currentWipId && e.currentWipId !== w.id)}>
                          {e.id} · {e.model} {e.status === 'maintenance' ? '(maintenance)' : (e.currentWipId && e.currentWipId !== w.id) ? '(busy)' : ''}
                        </option>
                      ))}
                    </SelectInput>
                    {eligibleEquipment.length === 0 && (
                      <div style={{ fontSize: 12, color: '#a93445', marginTop: 6 }}>No equipment of type {exp?.code} available.</div>
                    )}
                  </div>
                  <div>
                    <FieldLabel required>Recipe</FieldLabel>
                    <SelectInput value={newRecipeId} onChange={(e) => setNewRecipeId(e.target.value)}>
                      {recipesFor(w.experimentId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      {recipesFor(w.experimentId).length === 0 && <option value="">No recipes available</option>}
                    </SelectInput>
                  </div>
                </div>

                {/* Recipe parameter preview — expands once a recipe is chosen */}
                {newRecipe && (
                  <div style={{
                    padding: '14px 16px', marginBottom: 14,
                    border: `1px solid ${line}`, borderRadius: 10,
                    background: '#fbfbfd',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: text2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recipe Parameters</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: muted }}>{newRecipe.name}</span>
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12,
                    }}>
                      {Object.entries(newRecipe.params).map(([k, v]) => (
                        <div key={k} style={{
                          padding: '8px 10px', background: '#fff',
                          border: `1px solid ${lineSoft}`, borderRadius: 8,
                        }}>
                          <div style={{ fontSize: 10.5, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{k.replace(/_/g, ' ')}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: ink, marginTop: 3 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <FieldLabel>Note</FieldLabel>
                  <TextInput placeholder="Optional" value={newNote} onChange={(e) => setNewNote(e.target.value)}/>
                </div>
                <PrimaryBtn onClick={handleCreate} disabled={!newRecipeId || !newEqId}>Create Dispatch</PrimaryBtn>
              </div>
            </Card>
          )}

          {w.note && (
            <Card padding={0}>
              <CardHeader>Note</CardHeader>
              <div style={{ padding: 22, fontSize: 14, color: ink, lineHeight: 1.55 }}>{w.note}</div>
            </Card>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card padding={0}>
            <CardHeader>Equipment</CardHeader>
            {eq ? (
              <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 10 }}>
                <div style={{ fontSize: 12.5, color: text2 }}>Name</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: ink }}>{eq.id}</div>
                <div style={{ fontSize: 12.5, color: text2 }}>Model</div>
                <div style={{ fontSize: 13.5, color: ink }}>{eq.model}</div>
                <div style={{ fontSize: 12.5, color: text2 }}>Capacity</div>
                <div style={{ fontSize: 13.5, color: ink }}>{wWafers.length}/{eq.capacity} wafers</div>
              </div>
            ) : (
              <div style={{ padding: '22px 22px', color: muted, fontSize: 13 }}>
                No equipment yet. Create a dispatch to assign one.
              </div>
            )}
          </Card>

          <Card padding={0}>
            <CardHeader>Samples ({wWafers.length})</CardHeader>
            <div>
              {wWafers.map(s => (
                <button key={s.id} onClick={() => navigate({ page: 'lab_wafer', id: s.id })} style={{
                  width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8,
                  padding: '13px 20px', borderTop: `1px solid ${lineSoft}`,
                  background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: ink }}>{s.id}</div>
                    <div style={{ fontSize: 11.5, color: muted, marginTop: 2 }}>{s.size} — Req #{String(s.requestId).padStart(4,'0')}</div>
                  </div>
                  <Pill kind={s.status}/>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
};

// ── Dispatch list ───────────────────────────────────────────────
const LabDispatchList = ({ dispatches, wips, navigate, defaultTab = 'active' }) => {
  const [tab, setTab] = lS(defaultTab);
  const groups = {
    active: ['dispatched', 'pending', 'running'],
    record: ['unloaded', 'exception'],
    done:   ['result_recorded', 'aborted'],
    all:    null,
  };
  const filtered = groups[tab] === null
    ? dispatches
    : dispatches.filter(d => groups[tab].includes(d.status));

  const tabs = [
    { id: 'active', label: 'Active' },
    { id: 'record', label: 'Needs Result' },
    { id: 'done',   label: 'Closed' },
    { id: 'all',    label: 'All' },
  ];

  return (
    <Page title="Dispatches" subtitle="One experiment run on one piece of equipment, derived from a WIP">
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: `1px solid ${line}` }}>
        {tabs.map(t => {
          const n = (groups[t.id] === null ? dispatches : dispatches.filter(d => groups[t.id].includes(d.status))).length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? ink : 'transparent'}`,
              color: tab === t.id ? ink : text2, fontWeight: 600, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            }}>
              {t.label}
              <span style={{
                padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: tab === t.id ? '#ecebf3' : '#f1f1f5',
                color: tab === t.id ? '#4f4a8f' : muted,
              }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, color: muted, marginBottom: 14 }}>
        Showing <strong style={{ color: ink }}>{filtered.length}</strong> of {dispatches.length} dispatch{dispatches.length === 1 ? '' : 'es'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <Card padding={48} style={{ textAlign: 'center', color: muted }}>
            <LF.Activity size={32} color="#cbcbd6" style={{ marginBottom: 10 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: text2 }}>No dispatches</div>
          </Card>
        ) : filtered.map(d => {
          const wip = findWip(d.wipId, wips);
          const eqId = d.equipmentId || wip?.equipmentId;
          const exp = findExp(d.experimentId);
          let pct = 0, remainLabel = null;
          if (d.status === 'running' && d.startedAt) {
            const start = new Date(d.startedAt.replace(' ', 'T')).getTime();
            const elapsed = Math.max(0, Date.now() - start);
            const total = 24 * 60 * 60 * 1000;
            pct = Math.max(4, Math.min(96, (elapsed / total) * 100));
            const remain = Math.max(0, total - elapsed);
            const h = Math.floor(remain / 3600000);
            const m = Math.floor((remain % 3600000) / 60000);
            remainLabel = `~${h}h ${String(m).padStart(2,'0')}m remaining`;
          }
          return (
            <button key={d.id} onClick={() => navigate({ page: 'lab_dispatch_detail', id: d.id })} style={{
              display: 'block', width: '100%',
              padding: '18px 22px', borderRadius: 14,
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              textAlign: 'left', cursor: 'pointer',
              transition: 'border-color 0.12s',
              fontFamily: 'inherit',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: '100px minmax(0,1fr) 130px 130px 140px 24px',
                alignItems: 'center', gap: 18,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: ink, letterSpacing: '0.02em' }}>{d.id}</span>
                <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                    background: '#ecebf3', color: '#4f4a8f', letterSpacing: '0.05em', flexShrink: 0,
                  }}>{exp?.code}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp?.name}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 3, fontFamily: 'var(--font-mono)' }}>{d.wipId}</div>
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: text2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <LF.User size={12} color={muted}/>
                  {d.operator || '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: text2 }}>{eqId || '—'}</span>
                <span><Pill kind={d.status} dotted={d.status === 'running'}/></span>
                <LF.ChevronRight size={15} color="#cbcbd6"/>
              </div>
              {d.status === 'running' && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${lineSoft}` }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 11.5, color: text2, fontWeight: 600, marginBottom: 6,
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: 999, background: '#f4a8bf',
                        animation: 'pulse 1.4s ease-in-out infinite',
                      }}/>
                      Running · started <span style={{ fontFamily: 'var(--font-mono)', color: ink }}>{d.startedAt?.split(' ')[1]}</span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: accent }}>{remainLabel}</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: '#f1eef9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', inset: 0, width: `${pct}%`,
                      background: 'linear-gradient(90deg, #f4a8bf, #6c67b8)',
                      borderRadius: 999,
                    }}/>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Page>
  );
};

// ── Dispatch detail ─────────────────────────────────────────────
const STATUS_FLOW = ['dispatched', 'pending', 'running', 'unloaded', 'result_recorded'];

const LabDispatchDetail = ({ id, dispatches, wips, navigate, onAdvance, onAbort, onException, onRecord }) => {
  const d = dispatches.find(x => x.id === id);
  if (!d) return <Page title="Dispatch not found"/>;
  const wip = findWip(d.wipId, wips);
  const exp = findExp(d.experimentId);
  const rec = findRecipe(d.recipeId);
  const [recordOpen, setRecordOpen] = lS(false);

  const stepIdx = STATUS_FLOW.indexOf(d.status);
  const isClosed = d.status === 'aborted' || d.status === 'exception' || d.status === 'result_recorded';

  // Action surface depends on status
  let actions = null;
  if (d.status === 'dispatched') actions = <>
    <SecondaryBtn danger onClick={() => onAbort(d.id)}>Abort</SecondaryBtn>
    <PrimaryBtn icon={<LF.Clock size={14}/>} onClick={() => onAdvance(d.id, 'pending')}>Mark Pending</PrimaryBtn>
  </>;
  else if (d.status === 'pending') actions = <>
    <SecondaryBtn danger onClick={() => onAbort(d.id)}>Abort</SecondaryBtn>
    <PrimaryBtn icon={<LF.Play size={14}/>} success onClick={() => onAdvance(d.id, 'running')}>Start Running</PrimaryBtn>
  </>;
  else if (d.status === 'running') actions = <>
    <SecondaryBtn danger onClick={() => onException(d.id)}>Mark Exception</SecondaryBtn>
    <PrimaryBtn icon={<LF.Check size={14}/>} onClick={() => onAdvance(d.id, 'unloaded')}>Mark Unloaded</PrimaryBtn>
  </>;
  else if (d.status === 'unloaded' || d.status === 'exception') actions = <>
    <PrimaryBtn icon={<LF.ClipboardList size={14}/>} onClick={() => setRecordOpen(true)}>Record Result</PrimaryBtn>
  </>;

  return (
    <Page
      breadcrumb={<Breadcrumb items={[
        { label: 'Dispatches', onClick: () => navigate({ page: 'lab_dispatches' }) },
        { label: wip?.id || 'WIP', onClick: () => navigate({ page: 'lab_wip_detail', id: d.wipId }) },
        { label: d.id },
      ]}/>}
      title={`Dispatch ${d.id}`}
      subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <Pill kind={d.status} dotted={d.status === 'running'}/>
        <span style={{ color: text2, fontSize: 13 }}>{exp?.name} → <strong style={{ color: ink, fontFamily: 'var(--font-mono)' }}>{d.equipmentId || wip?.equipmentId || '—'}</strong></span>
      </span>}
      right={actions}
    >
      {/* Status timeline */}
      <Card padding={0} style={{ marginBottom: 18 }}>
        <CardHeader>Lifecycle</CardHeader>
        <div style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {STATUS_FLOW.map((s, i) => {
            const done = !isClosed && i < stepIdx;
            const cur  = !isClosed && i === stepIdx;
            const fail = isClosed && (d.status === 'aborted' || d.status === 'exception') && i > stepIdx;
            const reachedColor = done ? accent : cur ? accent : '#dcdce3';
            return (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: done || cur ? accent : '#fff',
                    border: `2px solid ${reachedColor}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                  }}>
                    {done && <LF.Check size={13} color="#fff" strokeWidth={3}/>}
                    {cur && <span style={{ width: 8, height: 8, borderRadius: 999, background: '#fff' }}/>}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: done || cur ? ink : muted, whiteSpace: 'nowrap' }}>
                    {PILL[s].label}
                  </span>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: done ? accent : '#ececf2', margin: '0 4px', marginBottom: 22 }}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
        {d.status === 'running' && d.startedAt && (() => {
          // Soft estimate — elapsed time vs an assumed 24h run window.
          const start = new Date(d.startedAt.replace(' ', 'T')).getTime();
          const elapsed = Math.max(0, Date.now() - start);
          const total = 24 * 60 * 60 * 1000;
          const pct = Math.max(4, Math.min(96, (elapsed / total) * 100));
          const remainMs = Math.max(0, total - elapsed);
          const fmt = (ms) => {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            return `${h}h ${String(m).padStart(2,'0')}m`;
          };
          return (
            <div style={{ padding: '0 26px 22px', borderTop: `1px solid ${lineSoft}`, paddingTop: 18 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 12, color: text2, fontWeight: 600, marginBottom: 8,
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 999, background: '#f4a8bf',
                    boxShadow: '0 0 8px #f4a8bf',
                    animation: 'pulse 1.4s ease-in-out infinite',
                  }}/>
                  Running · started <span style={{ fontFamily: 'var(--font-mono)', color: ink }}>{d.startedAt.split(' ')[1]}</span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: accent, fontWeight: 700 }}>
                  ~{fmt(remainMs)} remaining
                </span>
              </div>
              <div style={{ position: 'relative', height: 8, background: '#f1eef9', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', inset: 0, width: `${pct}%`,
                  background: 'linear-gradient(90deg, #f4a8bf, #6c67b8)',
                  borderRadius: 999, transition: 'width 0.3s',
                }}/>
                <div style={{
                  position: 'absolute', top: -2, left: `calc(${pct}% - 6px)`,
                  width: 12, height: 12, borderRadius: 999,
                  background: '#fff', border: '2px solid #6c67b8',
                  boxShadow: '0 0 0 0 rgba(108,103,184,0.4)',
                  animation: 'ringpulse 1.8s ease-out infinite',
                }}/>
              </div>
              <div style={{ fontSize: 11.5, color: muted, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                {Math.round(pct)}% of estimated 24h cycle
              </div>
            </div>
          );
        })()}
        {(d.status === 'aborted' || d.status === 'exception') && (
          <div style={{ padding: '12px 24px', borderTop: `1px solid ${lineSoft}`, background: '#fbe4e6', color: '#a93445', fontSize: 13, fontWeight: 600 }}>
            <LF.Alert size={14} color="#a93445" style={{ verticalAlign: '-2px', marginRight: 6 }}/>
            {d.status === 'aborted' ? 'Dispatch aborted before completion.' : 'Dispatch ended with an exception — record details below.'}
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card padding={0}>
            <CardHeader>Dispatch Info</CardHeader>
            <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 12 }}>
              <div style={{ fontSize: 13, color: text2 }}>WIP</div>
              <button onClick={() => navigate({ page: 'lab_wip_detail', id: d.wipId })} style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                color: accent, fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, textAlign: 'left',
              }}>{d.wipId}</button>
              <div style={{ fontSize: 13, color: text2 }}>Experiment Type</div>
              <div style={{ fontSize: 14, color: ink }}>{exp?.name}</div>
              <div style={{ fontSize: 13, color: text2 }}>Equipment</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: ink }}>{d.equipmentId || wip?.equipmentId || '—'}</div>
              <div style={{ fontSize: 13, color: text2 }}>Recipe</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>{rec?.name}</div>
              <div style={{ fontSize: 13, color: text2 }}>Dispatched At</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>{d.dispatchedAt || '—'}</div>
              <div style={{ fontSize: 13, color: text2 }}>Started At</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>{d.startedAt || '—'}</div>
              <div style={{ fontSize: 13, color: text2 }}>Ended At</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>{d.endedAt || '—'}</div>
            </div>
          </Card>

          {d.result && (
            <Card padding={0}>
              <CardHeader>
                <span>Recorded Result</span>
                <span style={{ marginLeft: 'auto' }}><Pill kind={d.result.verdict}/></span>
              </CardHeader>
              <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 12 }}>
                <div style={{ fontSize: 13, color: text2 }}>Summary</div>
                <div style={{ fontSize: 14, color: ink, lineHeight: 1.55 }}>{d.result.summary}</div>
                <div style={{ fontSize: 13, color: text2 }}>Data</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: text2,
                  background: bgSoft, padding: '10px 12px', borderRadius: 8, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>{d.result.data || '—'}</div>
                {d.result.note && <>
                  <div style={{ fontSize: 13, color: text2 }}>Note</div>
                  <div style={{ fontSize: 13, color: ink }}>{d.result.note}</div>
                </>}
                <div style={{ fontSize: 13, color: text2 }}>Recorded At</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>{d.result.recordedAt}</div>
              </div>
            </Card>
          )}
        </div>

        <Card padding={0}>
          <CardHeader>Recipe Parameters</CardHeader>
          <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 10 }}>
            {rec ? Object.entries(rec.params).map(([k, v]) => (
              <React.Fragment key={k}>
                <div style={{ fontSize: 12.5, color: text2, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>{v}</div>
              </React.Fragment>
            )) : <div style={{ color: muted, fontSize: 13 }}>No recipe selected</div>}
          </div>
        </Card>
      </div>

      <RecordResultModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        dispatch={d}
        onSubmit={(payload) => { onRecord(d.id, payload); setRecordOpen(false); }}
      />
    </Page>
  );
};

// ── Record Result modal (screenshot 2) ──────────────────────────
const RecordResultModal = ({ open, onClose, dispatch, onSubmit }) => {
  const [summary, setSummary] = lS('');
  const [verdict, setVerdict] = lS('');
  const [data, setData] = lS('{}');
  const [note, setNote] = lS('');
  const valid = summary.trim().length > 0 && (verdict === 'pass' || verdict === 'fail');

  React.useEffect(() => {
    if (open) { setSummary(''); setVerdict(''); setData('{}'); setNote(''); }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Experiment Result"
      width={560}
      footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid} onClick={() => onSubmit({ summary, verdict, data, note })}>Submit Result</PrimaryBtn>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <FieldLabel required>Summary</FieldLabel>
          <TextArea placeholder="Outcome in one or two sentences" value={summary} onChange={(e) => setSummary(e.target.value)}/>
        </div>
        <div>
          <FieldLabel required>Verdict</FieldLabel>
          <div style={{ display: 'flex', gap: 18 }}>
            {['pass', 'fail'].map(v => (
              <label key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: v === 'pass' ? '#2e6a47' : '#a93445' }}>
                <input type="radio" name="verdict" value={v} checked={verdict === v} onChange={() => setVerdict(v)} style={{ accentColor: v === 'pass' ? '#2e6a47' : '#a93445' }}/>
                {v === 'pass' ? 'Pass' : 'Fail'}
              </label>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Data (JSON, optional)</FieldLabel>
          <TextArea value={data} onChange={(e) => setData(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}/>
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
};

// ── New WIP modal ───────────────────────────────────────────────
// Equipment is no longer chosen at WIP-creation time — it's picked per
// Dispatch on the WIP detail page. WIP creation just commits to the
// experiment type + which wafers to process.
const NewWipModal = ({ open, onClose, wafers, onSubmit }) => {
  const [waferIds, setWaferIds] = lS([]);
  const [experimentId, setExperimentId] = lS('tct');
  const [note, setNote] = lS('');

  const eligibleWafers = wafers.filter(w => w.status === 'received');

  React.useEffect(() => {
    if (open) { setWaferIds([]); setExperimentId('tct'); setNote(''); }
  }, [open]);

  const valid = waferIds.length > 0;
  const toggleWafer = (id) => {
    setWaferIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  // Helper: does this wafer's request include this experiment?
  const waferNeedsExp = (w) => Array.isArray(w.expIds) && w.expIds.includes(experimentId);
  const exp = findExp(experimentId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New WIP"
      width={620}
      footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid} onClick={() => onSubmit({ waferIds, experimentId, note })}>Create WIP</PrimaryBtn>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <FieldLabel required>Experiment Type</FieldLabel>
          <SelectInput value={experimentId} onChange={(e) => setExperimentId(e.target.value)}>
            {EXPERIMENTS.map(x => <option key={x.id} value={x.id}>{x.name} ({x.code})</option>)}
          </SelectInput>
          <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>
            Equipment will be assigned when you create a dispatch.
          </div>
        </div>
        <div>
          <FieldLabel required>Wafers</FieldLabel>
          <div style={{
            border: `1px solid ${line}`, borderRadius: 8,
            maxHeight: 240, overflow: 'auto',
          }}>
            {eligibleWafers.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: muted, fontSize: 13 }}>No received wafers available</div>
            ) : eligibleWafers.map(w => {
              const checked = waferIds.includes(w.id);
              const matches = waferNeedsExp(w);
              return (
                <label key={w.id} style={{
                  display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 10,
                  alignItems: 'center', padding: '10px 14px',
                  borderTop: `1px solid ${lineSoft}`, cursor: 'pointer',
                  background: checked ? '#f7f6fb' : '#fff',
                  opacity: matches ? 1 : 0.5,
                }} title={matches ? '' : `Request does not include ${exp?.name}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleWafer(w.id)} style={{ accentColor: accent }}/>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: ink }}>{w.id}</span>
                  <span style={{ fontSize: 12, color: text2 }}>{w.size}</span>
                  <Pill kind={w.urgency}/>
                </label>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>
            {waferIds.length} selected — faded rows don't require this experiment.
          </div>
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <TextArea placeholder="Optional context for the WIP" value={note} onChange={(e) => setNote(e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
};

// ── Equipment ───────────────────────────────────────────────────
const LabEquipment = ({ equipment, wips, navigate, canManage = false, onOpenNew }) => (
  <Page
    title="Equipment"
    subtitle="Each unit accepts one WIP at a time, up to its wafer capacity"
    right={canManage && <PrimaryBtn icon={<LF.Plus size={14}/>} onClick={onOpenNew}>Add Equipment</PrimaryBtn>}
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      {equipment.map(e => {
        const wip = e.currentWipId ? findWip(e.currentWipId, wips) : null;
        const used = wip ? wip.waferIds.length : 0;
        const pct = (used / e.capacity) * 100;
        const paramEntries = e.params ? Object.entries(e.params) : [];
        return (
          <Card key={e.id} padding={0}>
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${lineSoft}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: ink }}>{e.id}</div>
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{e.model} · type {e.type}</div>
              </div>
              <Pill kind={e.status} dotted={e.status === 'running'}/>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: text2 }}>
                <span>Wafer capacity</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: ink }}>{used}/{e.capacity}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: '#ececf2', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: accent, borderRadius: 999, transition: 'width 0.2s' }}/>
              </div>
              {e.description && (
                <div style={{ marginTop: 14, fontSize: 12.5, color: text2, lineHeight: 1.5 }}>{e.description}</div>
              )}
              {paramEntries.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Parameters</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {paramEntries.map(([k, v]) => (
                      <span key={k} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11.5, color: text2,
                        padding: '2px 8px', borderRadius: 6, background: bgSoft,
                        border: `1px solid ${lineSoft}`,
                      }}>{k} <strong style={{ color: ink }}>{v}</strong></span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                {wip ? (
                  <button onClick={() => navigate({ page: 'lab_wip_detail', id: wip.id })} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '12px 14px', background: bgSoft, border: `1px solid ${line}`,
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current WIP</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: ink, marginTop: 2 }}>{wip.id}</div>
                      <div style={{ fontSize: 12, color: text2, marginTop: 2 }}>{findExp(wip.experimentId)?.name}</div>
                    </div>
                    <LF.ChevronRight size={16} color={muted}/>
                  </button>
                ) : (
                  <div style={{ fontSize: 13, color: muted, textAlign: 'center', padding: '10px 0' }}>
                    {e.status === 'maintenance' ? 'Under maintenance' : 'Available — no WIP assigned'}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  </Page>
);

// ── New Equipment modal (manager-only) ──────────────────────────
// Same shape as the New WIP modal — picks experiment type, asks for name +
// model/description, capacity, and an editable parameter list.
const NewEquipmentModal = ({ open, onClose, onSubmit, existingIds }) => {
  const [name, setName] = lS('');
  const [type, setType] = lS(EXPERIMENTS[0].code);
  const [description, setDescription] = lS('');
  const [capacity, setCapacity] = lS('1');
  const [paramRows, setParamRows] = lS([{ key: '', value: '' }]);

  React.useEffect(() => {
    if (!open) return;
    setName(''); setType(EXPERIMENTS[0].code);
    setDescription(''); setCapacity('1');
    setParamRows([{ key: '', value: '' }]);
  }, [open]);

  const capNum = parseInt(capacity, 10);
  const idClash = existingIds && existingIds.includes(name.trim());
  const valid = name.trim().length > 0 && !idClash && capNum > 0;

  const setRow = (i, field, val) => setParamRows(rs => rs.map((r, j) => j === i ? { ...r, [field]: val } : r));
  const removeRow = (i) => setParamRows(rs => rs.length === 1 ? rs : rs.filter((_, j) => j !== i));
  const addRow = () => setParamRows(rs => [...rs, { key: '', value: '' }]);

  const handle = () => {
    // Drop blank parameter rows and use the first content line of the
    // description as a model label so the equipment card has something to show.
    const params = Object.fromEntries(
      paramRows.filter(r => r.key.trim()).map(r => [r.key.trim(), r.value.trim()])
    );
    const model = (description.split('\n')[0] || `${type} unit`).trim();
    onSubmit({
      id: name.trim(),
      name: name.trim(),
      type,
      model,
      description: description.trim(),
      capacity: capNum,
      params,
      status: 'idle',
      currentWipId: null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Equipment"
      width={620}
      footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid} onClick={handle}>Create Equipment</PrimaryBtn>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <FieldLabel required>Name</FieldLabel>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. QA-TCT-03"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          {idClash && (
            <div style={{ fontSize: 12, color: '#c0394a', marginTop: 6 }}>
              An equipment with this name already exists.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <FieldLabel required>Experiment</FieldLabel>
            <SelectInput value={type} onChange={(e) => setType(e.target.value)}>
              {EXPERIMENTS.map(x => <option key={x.id} value={x.code}>{x.name} ({x.code})</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel required>Capacity</FieldLabel>
            <TextInput
              type="number" min="1" step="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="6"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>Max wafers per WIP.</div>
          </div>
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Model name + any notes. First line becomes the card's model label."
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <FieldLabel>Parameters</FieldLabel>
            <span style={{ fontSize: 11.5, color: muted }}>Defaults that operators can override per dispatch.</span>
          </div>
          <div style={{
            padding: 12, borderRadius: 10, border: `1px solid ${line}`, background: bgSoft,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {paramRows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={row.key}
                  onChange={(e) => setRow(i, 'key', e.target.value)}
                  placeholder="key (e.g. max_temp)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
                />
                <TextInput
                  value={row.value}
                  onChange={(e) => setRow(i, 'value', e.target.value)}
                  placeholder="value (e.g. 125 °C)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
                />
                <button onClick={() => removeRow(i)} disabled={paramRows.length === 1} title="Remove" style={{
                  width: 32, height: 32, borderRadius: 8,
                  color: paramRows.length === 1 ? '#cbcbd6' : '#a8a8b8',
                  background: 'transparent', border: 'none',
                  cursor: paramRows.length === 1 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}><LF.Trash size={14}/></button>
              </div>
            ))}
            <button onClick={addRow} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              border: '1px dashed rgba(0,0,0,0.18)', background: 'transparent',
              color: text2, fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}><LF.Plus size={12}/> Add parameter</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Root container ───────────────────────────────────────────────
const LabApp = ({ route, navigate, canManage = false }) => {
  const [wafers, setWafers] = lS(WAFER_SEED);
  const [wips, setWips] = lS(WIP_SEED);
  const [dispatches, setDispatches] = lS(DISPATCH_SEED);
  const [equipment, setEquipment] = lS(EQUIPMENT_SEED);
  const [toast, setToast] = lS(null);
  const [newWipOpen, setNewWipOpen] = lS(false);
  const [newEquipmentOpen, setNewEquipmentOpen] = lS(false);

  const showToast = (msg) => {
    setToast({ msg, t: Date.now() });
    setTimeout(() => setToast(null), 2200);
  };
  const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
  const nextId = (prefix, list) => {
    const max = list.reduce((m, x) => {
      const n = parseInt(String(x.id).replace(prefix, ''), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefix}${max + 1}`;
  };

  const onReceive = (id) => {
    setWafers(ws => ws.map(w => w.id === id ? { ...w, status: 'received' } : w));
    showToast(`${id} received`);
  };
  const onReject = (id) => {
    setWafers(ws => ws.map(w => w.id === id ? { ...w, status: 'rejected', reason: 'Manual reject' } : w));
    showToast(`${id} rejected`);
  };

  const createWip = ({ waferIds, experimentId, note }) => {
    const id = nextId('WIP-', wips);
    // Equipment is assigned per-dispatch, not at WIP creation. Leave equipmentId
    // unset until the first dispatch picks one.
    const wip = { id, equipmentId: null, experimentId, waferIds, note, status: 'in_progress', createdAt: now(), dispatchIds: [] };
    setWips(ws => [wip, ...ws]);
    setWafers(ws => ws.map(w => waferIds.includes(w.id) ? { ...w, status: 'in_wip', wipId: id } : w));
    showToast(`${id} created`);
    setNewWipOpen(false);
    navigate({ page: 'lab_wip_detail', id });
  };

  const onCompleteWip = (id) => {
    const wip = findWip(id, wips);
    if (!wip) return;
    setWips(ws => ws.map(w => w.id === id ? { ...w, status: 'completed' } : w));
    setWafers(ws => ws.map(w => wip.waferIds.includes(w.id) ? { ...w, status: 'completed', wipId: null } : w));
    setEquipment(es => es.map(e => e.currentWipId === id ? { ...e, currentWipId: null } : e));
    showToast(`${id} completed`);
  };
  const onAbortWip = (id) => {
    const wip = findWip(id, wips);
    if (!wip) return;
    setWips(ws => ws.map(w => w.id === id ? { ...w, status: 'aborted' } : w));
    setWafers(ws => ws.map(w => wip.waferIds.includes(w.id) ? { ...w, status: 'received', wipId: null } : w));
    setEquipment(es => es.map(e => e.currentWipId === id ? { ...e, currentWipId: null } : e));
    showToast(`${id} aborted`);
  };

  // Manager-only: append a freshly-defined equipment unit. Starts idle and
  // unassigned; the regular Add Dispatch flow picks it up automatically.
  const createEquipment = (payload) => {
    setEquipment(es => [...es, payload]);
    setNewEquipmentOpen(false);
    showToast(`${payload.id} added`);
    navigate({ page: 'lab_equipment' });
  };

  const createDispatch = (wipId, { experimentId, equipmentId, recipeId }) => {
    const id = nextId('DP-', dispatches);
    const dp = { id, wipId, experimentId, equipmentId, recipeId, operator: 'lab_member', status: 'dispatched', dispatchedAt: now(), startedAt: null, endedAt: null, result: null };
    setDispatches(ds => [dp, ...ds]);
    setWips(ws => ws.map(w => w.id === wipId ? {
      ...w,
      dispatchIds: [...w.dispatchIds, id],
      // Lock in the equipment on the first dispatch — keeps the WIP's primary
      // equipment tag in sync without overwriting if another dispatch chose differently.
      equipmentId: w.equipmentId || equipmentId,
    } : w));
    setEquipment(es => es.map(e => e.id === equipmentId ? { ...e, currentWipId: wipId } : e));
    showToast(`${id} dispatched`);
  };
  const advanceDispatch = (id, to) => {
    setDispatches(ds => ds.map(d => {
      if (d.id !== id) return d;
      const u = { ...d, status: to };
      if (to === 'running' && !u.startedAt) u.startedAt = now();
      if (to === 'unloaded') u.endedAt = now();
      return u;
    }));
    showToast(`${id} → ${PILL[to].label}`);
  };
  const abortDispatch = (id) => {
    setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'aborted', endedAt: now() } : d));
    showToast(`${id} aborted`);
  };
  const exceptionDispatch = (id) => {
    setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'exception', endedAt: now() } : d));
    showToast(`${id} flagged exception`);
  };
  const recordResult = (id, payload) => {
    setDispatches(ds => ds.map(d => d.id === id ? { ...d, status: 'result_recorded', result: { ...payload, recordedAt: now() } } : d));
    showToast(`${id} result recorded`);
  };

  let page = null;
  const p = route.page;
  if (p === 'lab_dashboard' || p === 'dashboard')
    page = <LabDashboard wafers={wafers} wips={wips} dispatches={dispatches} equipment={equipment} navigate={navigate}/>;
  else if (p === 'lab_samples' || p === 'samples')
    page = <LabSamples navigate={navigate} defaultTab={route.tab || 'all'} showToast={showToast}/>;
  else if (p === 'lab_wafer')
    page = <LabWaferDetail id={route.id} wafers={wafers} wips={wips} dispatches={dispatches} navigate={navigate} onReceive={onReceive} onReject={onReject}/>;
  else if (p === 'lab_wip' || p === 'wip')
    page = <LabWipList wips={wips} wafers={wafers} dispatches={dispatches} navigate={navigate} openNewWip={() => setNewWipOpen(true)}/>;
  else if (p === 'lab_wip_detail')
    page = <LabWipDetail id={route.id} wips={wips} wafers={wafers} dispatches={dispatches} equipment={equipment} navigate={navigate}
      onCreateDispatch={createDispatch} onCompleteWip={onCompleteWip} onAbortWip={onAbortWip}/>;
  else if (p === 'lab_dispatches' || p === 'dispatches')
    page = <LabDispatchList dispatches={dispatches} wips={wips} navigate={navigate} defaultTab={route.tab || 'active'}/>;
  else if (p === 'lab_dispatch_detail')
    page = <LabDispatchDetail id={route.id} dispatches={dispatches} wips={wips} navigate={navigate}
      onAdvance={advanceDispatch} onAbort={abortDispatch} onException={exceptionDispatch} onRecord={recordResult}/>;
  else if (p === 'lab_equipment' || p === 'equipment')
    page = <LabEquipment equipment={equipment} wips={wips} navigate={navigate} canManage={canManage} onOpenNew={() => setNewEquipmentOpen(true)}/>;
  else
    page = <LabDashboard wafers={wafers} wips={wips} dispatches={dispatches} equipment={equipment} navigate={navigate}/>;

  return (
    <>
      {page}
      <NewWipModal
        open={newWipOpen}
        onClose={() => setNewWipOpen(false)}
        wafers={wafers}
        onSubmit={createWip}
      />
      <NewEquipmentModal
        open={newEquipmentOpen}
        onClose={() => setNewEquipmentOpen(false)}
        existingIds={equipment.map(e => e.id)}
        onSubmit={createEquipment}
      />
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: 10,
          background: ink, color: '#fff', fontSize: 14, fontWeight: 500,
          boxShadow: '0 12px 36px rgba(20,20,28,0.32)',
          animation: 'slide-in 0.18s ease-out', zIndex: 300,
        }}>{toast.msg}</div>
      )}
    </>
  );
};

window.LabApp = LabApp;
})();
