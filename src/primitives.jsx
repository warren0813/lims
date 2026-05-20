// Reusable UI primitives — Card, Badge, Button, Pill, etc.

const Card = ({ children, style, padding = 0, ...rest }) => (
  <div {...rest} style={{
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding,
    ...style,
  }}>{children}</div>
);

const SectionLabel = ({ children, style, right }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    ...style,
  }}>
    <span>{children}</span>
    {right}
  </div>
);

const STATUS_MAP = {
  // sample
  created:   { bg: 'var(--status-created-bg)',   color: 'var(--status-created-text)',   label: 'Created' },
  shipped:   { bg: 'var(--status-shipped-bg)',   color: 'var(--status-shipped-text)',   label: 'Shipped' },
  received:  { bg: 'var(--status-received-bg)',  color: 'var(--status-received-text)',  label: 'Received' },
  processing:{ bg: 'var(--status-progress-bg)',  color: 'var(--status-progress-text)',  label: 'Processing' },
  completed: { bg: 'var(--status-completed-bg)', color: 'var(--status-completed-text)', label: 'Completed' },
  lost:      { bg: 'var(--status-aborted-bg)',   color: 'var(--status-aborted-text)',   label: 'Lost' },
  // wip
  in_progress:{ bg: 'var(--status-progress-bg)', color: 'var(--status-progress-text)',  label: 'In Progress' },
  aborted:   { bg: 'var(--status-aborted-bg)',   color: 'var(--status-aborted-text)',   label: 'Aborted' },
  // dispatch
  pending:   { bg: 'var(--status-pending-bg)',   color: 'var(--status-pending-text)',   label: 'Pending' },
  running:   { bg: 'var(--status-progress-bg)',  color: 'var(--status-progress-text)',  label: 'Running' },
  failed:    { bg: 'var(--status-aborted-bg)',   color: 'var(--status-aborted-text)',   label: 'Failed' },
  // result
  PASS:      { bg: 'var(--status-pass-bg)',      color: 'var(--status-pass-text)',      label: 'PASS' },
  FAIL:      { bg: 'var(--status-fail-bg)',      color: 'var(--status-fail-text)',      label: 'FAIL' },
};

const Badge = ({ status, label, dot, mono, style }) => {
  const s = STATUS_MAP[status] || { bg: 'var(--status-created-bg)', color: 'var(--status-created-text)', label: label || status };
  const isLive = status === 'running' || status === 'in_progress';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 500,
      background: s.bg, color: s.color,
      whiteSpace: 'nowrap',
      fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
      letterSpacing: mono ? '0.02em' : 'normal',
      ...style,
    }}>
      {(dot || isLive) && (
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: s.color,
          ...(isLive ? { animation: 'pulse 1.4s infinite' } : {}),
        }}/>
      )}
      {label || s.label}
    </span>
  );
};

const Button = ({ variant = 'primary', size = 'md', icon, children, style, disabled, ...rest }) => {
  const sizes = {
    sm: { h: 28, px: 10, fs: 12, gap: 6, iconSize: 13 },
    md: { h: 34, px: 14, fs: 13, gap: 7, iconSize: 14 },
    lg: { h: 40, px: 18, fs: 14, gap: 8, iconSize: 15 },
  }[size];
  const variants = {
    primary: { bg: 'var(--primary)', color: '#fff', border: 'var(--primary)', hoverBg: 'var(--primary-hover)' },
    secondary: { bg: '#fff', color: 'var(--text-primary)', border: 'var(--border-strong)', hoverBg: '#f8fafc' },
    ghost: { bg: 'transparent', color: 'var(--text-secondary)', border: 'transparent', hoverBg: '#ebebf0' },
    danger: { bg: '#fff', color: '#a02e3d', border: '#f8c8cf', hoverBg: '#fde9eb' },
    success: { bg: '#1ea05a', color: '#fff', border: '#1ea05a', hoverBg: '#157a4a' },
    dark: { bg: '#1e1e24', color: '#fff', border: '#1e1e24', hoverBg: '#2d2d38' },
  }[variant];
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sizes.gap,
        height: sizes.h, padding: `0 ${sizes.px}px`,
        fontSize: sizes.fs, fontWeight: 500,
        background: hover && !disabled ? variants.hoverBg : variants.bg,
        color: variants.color,
        border: `1px solid ${variants.border}`,
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.12s, border 0.12s',
        whiteSpace: 'nowrap',
        ...style,
      }} {...rest}
    >
      {icon && React.cloneElement(icon, { size: sizes.iconSize })}
      {children}
    </button>
  );
};

const IDChip = ({ id, prefix = '#', size = 'md', muted = false, style }) => {
  const fs = size === 'sm' ? 11 : 12;
  const ph = size === 'sm' ? '2px 6px' : '3px 8px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: ph, borderRadius: 6,
      background: muted ? 'transparent' : '#ebebf0',
      color: muted ? 'var(--text-muted)' : 'var(--text-secondary)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: fs, fontWeight: 500,
      letterSpacing: '0.01em',
      ...style,
    }}>{prefix}{id}</span>
  );
};

// Status pipeline visualizer — small dots showing position in workflow
const FlowDots = ({ steps, current, size = 6, gap = 4, doneColor = 'var(--primary)', currentColor = 'var(--primary)', style }) => {
  const idx = steps.indexOf(current);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}>
      {steps.map((s, i) => (
        <span key={s} style={{
          width: i === idx ? size + 2 : size,
          height: i === idx ? size + 2 : size,
          borderRadius: 999,
          background: i < idx ? doneColor : i === idx ? currentColor : 'rgba(0,0,0,0.09)',
          ...(i === idx ? { boxShadow: `0 0 0 2px rgba(108,103,184,0.20)` } : {}),
        }}/>
      ))}
    </span>
  );
};

// Priority left-edge marker (none for normal, blue for high, red for urgent)
const PriorityMarker = ({ priority }) => {
  const colorMap = { high: '#f59e0b', urgent: '#ef4444', normal: 'transparent' };
  const c = colorMap[priority] || 'transparent';
  return (
    <span style={{
      display: 'inline-block',
      width: 3, height: 28, borderRadius: 2,
      background: c,
    }}/>
  );
};

// Avatar circle
const Avatar = ({ name, size = 32, bg = '#6c67b8' }) => {
  const initial = (name || '?')[0].toUpperCase();
  return (
    <span style={{
      width: size, height: size, borderRadius: 999,
      background: bg, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, letterSpacing: '0.02em',
      flexShrink: 0,
    }}>{initial}</span>
  );
};

// Empty state
const EmptyState = ({ icon, title, message, action }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '48px 24px', gap: 10, color: 'var(--text-muted)', textAlign: 'center',
  }}>
    {icon && <div style={{ color: 'var(--text-muted)' }}>{React.cloneElement(icon, { size: 28 })}</div>}
    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</div>
    {message && <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>{message}</div>}
    {action}
  </div>
);

// Human-friendly duration string. "1d 3h 5m", "20s", "—" for null.
// Used by the dispatch countdown bar + every list/detail page that shows
// est. duration or remaining time.
function formatDuration(totalSec) {
  if (totalSec == null) return '—';
  if (totalSec === 0) return '0s';
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && d === 0) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

window.UI = { Card, SectionLabel, Badge, Button, IDChip, FlowDots, PriorityMarker, Avatar, EmptyState, formatDuration };
