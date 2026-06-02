'use client';
import STATUS_LABEL from '@/components/Manager/constants/statusLabel';

const Pill = ({
  kind,
  mapping = STATUS_LABEL as Record<string, { label: string; bg: string; fg: string }>,
  dotted = false,
  size = 'sm',
}: {
  kind: string;
  mapping?: Record<string, { label: string; bg: string; fg: string }>;
  dotted?: boolean;
  size?: string;
}) => {
  const p = mapping[kind] || { label: kind, bg: '#ebebf0', fg: '#5a5a6e' };
  const medium = size === 'md';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: medium ? '4px 10px' : '3px 9px',
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        fontSize: medium ? 12 : 11.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {dotted && <span style={{ width: 6, height: 6, borderRadius: 999, background: p.fg }} />}
      {p.label}
    </span>
  );
};
export default Pill;
export { Pill };
