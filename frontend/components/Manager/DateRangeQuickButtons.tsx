'use client';
import React from 'react';
import { ink as mInk, line as mLine, muted as mMuted } from '@/lib/colors';

type DateRange = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, '0');

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const presetRange = (kind: 'today' | 'last7' | 'last30' | 'month'): DateRange => {
  const end = today();
  if (kind === 'today') return { start: formatDateInput(end), end: formatDateInput(end) };
  if (kind === 'last7') {
    return { start: formatDateInput(addDays(end, -6)), end: formatDateInput(end) };
  }
  if (kind === 'month') {
    return {
      start: formatDateInput(new Date(end.getFullYear(), end.getMonth(), 1)),
      end: formatDateInput(end),
    };
  }
  return { start: formatDateInput(addDays(end, -29)), end: formatDateInput(end) };
};

const defaultDateRange = () => presetRange('last30');

const presets: { key: 'today' | 'last7' | 'last30' | 'month'; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
];

const DateRangeQuickButtons = ({
  onChange,
  style,
}: {
  onChange: (range: DateRange) => void;
  style?: React.CSSProperties;
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...style }}>
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: mMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      Quick Range
    </span>
    {presets.map((p) => (
      <button
        key={p.key}
        type="button"
        onClick={() => onChange(presetRange(p.key))}
        style={{
          border: `1px solid ${mLine}`,
          background: '#fff',
          color: mInk,
          borderRadius: 999,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {p.label}
      </button>
    ))}
  </div>
);

export default DateRangeQuickButtons;
export { DateRangeQuickButtons, defaultDateRange, presetRange };
export type { DateRange };
