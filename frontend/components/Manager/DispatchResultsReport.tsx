'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import FieldLabel from '@/components/Manager/FieldLabel';
import TextInput from '@/components/Manager/TextInput';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import DateRangeQuickButtons, {
  defaultDateRange,
} from '@/components/Manager/DateRangeQuickButtons';
import { ink as mInk, muted as mMuted, text2 as mText2 } from '@/lib/colors';

type DispatchResultRow = {
  id: number;
  wip_id: number;
  status: string;
  equipment: { id: number; name: string };
  experiment_type: { id: number; name: string };
  recipe: { id: number; name: string };
  request_ids: number[];
  request_titles: string[];
  sample_count: number;
  pass_count: number;
  fail_count: number;
  operator: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  result_comment: string;
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return '-';
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
};

const statusLabel = (status: string) =>
  ({
    pending: 'Pending',
    dispatched: 'Dispatched',
    running: 'Running',
    unloaded: 'Unloaded',
    completed: 'Completed',
    execution_exception: 'Exception',
    pending_redispatch: 'Redispatch',
    aborted: 'Aborted',
  })[status] || status;

const statusStyle = (status: string): React.CSSProperties => {
  const palette: Record<string, { bg: string; fg: string }> = {
    completed: { bg: '#dbeafe', fg: '#1d4ed8' },
    running: { bg: '#e8e7f6', fg: '#5550a0' },
    dispatched: { bg: '#fef0d4', fg: '#b8720e' },
    unloaded: { bg: '#eef0ed', fg: '#4d5a4f' },
    pending: { bg: '#ebebf0', fg: '#5a5a6e' },
    execution_exception: { bg: '#fde4e4', fg: '#c0394a' },
    pending_redispatch: { bg: '#fde4e4', fg: '#c0394a' },
    aborted: { bg: '#ebebf0', fg: '#777788' },
  };
  const p = palette[status] || palette.pending;
  return {
    display: 'inline-flex',
    padding: '3px 8px',
    borderRadius: 999,
    background: p.bg,
    color: p.fg,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
};

const DispatchResultsReport = () => {
  const router = useRouter();
  const [range, setRange] = React.useState(() => defaultDateRange());
  const [rows, setRows] = React.useState<DispatchResultRow[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const start = range.start;
  const end = range.end;
  const valid = Boolean(start && end);

  const generate = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await api.reports.dispatchResults({
        start_date: start,
        end_date: end,
      });
      setRows(out.data || []);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding={0} style={{ gridColumn: '1 / -1' }}>
      <CardHeader>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: '#dbeafe',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <I.ClipboardList size={14} color="#2563eb" />
        </span>
        <span style={{ color: mInk, fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>
          Dispatch Results
        </span>
      </CardHeader>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 12.5, color: mText2, marginBottom: 14 }}>
          Query dispatch completion status and pass/fail outcomes for a selected period.
        </div>
        <DateRangeQuickButtons onChange={setRange} style={{ marginBottom: 14 }} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 220px max-content',
            alignItems: 'end',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <TextInput
              type="date"
              value={start}
              onChange={(e) => setRange((cur) => ({ ...cur, start: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <TextInput
              type="date"
              value={end}
              onChange={(e) => setRange((cur) => ({ ...cur, end: e.target.value }))}
            />
          </div>
          <PrimaryBtn
            disabled={!valid || busy}
            onClick={generate}
            icon={<I.TrendUp size={14} />}
            style={{ minWidth: 116, justifyContent: 'center' }}
          >
            {busy ? 'Generating...' : 'Generate'}
          </PrimaryBtn>
        </div>
        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: '#fde4e4',
              color: '#c0394a',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid #f6c4c4',
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}
        {rows && (
          <div style={{ overflowX: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8 }}>
            <table style={{ width: '100%', minWidth: 1120, borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f7f7fa' }}>
                <tr>
                  {[
                    'Dispatch',
                    'Status',
                    'Equipment',
                    'Experiment',
                    'Recipe',
                    'Started',
                    'Completed',
                    'Duration',
                    'Samples',
                    'Pass / Fail',
                    'Request',
                    'Operator',
                  ].map((label) => (
                    <th key={label} style={headerCell}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ padding: 22, color: mMuted, textAlign: 'center' }}>
                      No dispatches found in this period.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/manager/lab/dispatches/${row.id}`)}
                    style={{ cursor: 'pointer' }}
                    title={`Open dispatch #${row.id}`}
                  >
                    <td style={monoCell}>DP-{String(row.id).padStart(4, '0')}</td>
                    <td style={bodyCell}>
                      <span style={statusStyle(row.status)}>{statusLabel(row.status)}</span>
                    </td>
                    <td style={bodyCell}>{row.equipment.name}</td>
                    <td style={bodyCell}>{row.experiment_type.name}</td>
                    <td style={bodyCell}>{row.recipe.name}</td>
                    <td style={monoCell}>{formatDateTime(row.dispatched_at)}</td>
                    <td style={monoCell}>{formatDateTime(row.completed_at)}</td>
                    <td style={monoCell}>{formatDuration(row.duration_seconds)}</td>
                    <td style={numberCell}>{row.sample_count}</td>
                    <td style={numberCell}>
                      {row.pass_count} / {row.fail_count}
                    </td>
                    <td style={bodyCell}>
                      {row.request_titles.length ? row.request_titles.join(', ') : '-'}
                    </td>
                    <td style={bodyCell}>{row.operator || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
};

const headerCell: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 10.5,
  color: '#5a5a6e',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  whiteSpace: 'nowrap',
};

const bodyCell: React.CSSProperties = {
  padding: '11px 12px',
  fontSize: 12.5,
  color: mInk,
  borderTop: '1px solid rgba(0,0,0,0.05)',
  whiteSpace: 'nowrap',
};

const monoCell: React.CSSProperties = {
  ...bodyCell,
  fontFamily: 'var(--font-mono)',
  color: '#5a5a6e',
};

const numberCell: React.CSSProperties = {
  ...monoCell,
  textAlign: 'right',
};

export default DispatchResultsReport;
export { DispatchResultsReport };
