'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import URGENCY_LABEL from '@/components/Manager/constants/urgencyLabel';
import DateRangeQuickButtons, {
  defaultDateRange,
} from '@/components/Manager/DateRangeQuickButtons';
import FieldLabel from '@/components/Manager/FieldLabel';
import Pill from '@/components/Manager/Pill';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import TextInput from '@/components/Manager/TextInput';
import { ink as mInk, muted as mMuted, text2 as mText2 } from '@/lib/colors';

type RequestStatistics = {
  period: { start_date: string; end_date: string };
  status_distribution: Record<string, number>;
  average_tat_hours: number | null;
  total_requests: number;
  requests: RequestStatisticsRow[];
};

type RequestStatisticsRow = {
  id: number;
  title: string;
  status: string;
  urgency: string;
  requester: string;
  sample_count: number;
  experiment_types: string[];
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

const formatTat = (hours: number | null) => {
  if (hours == null) return '-';
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

const formatCompletionRate = (stats: RequestStatistics) => {
  const completed =
    (stats.status_distribution.completed || 0) + (stats.status_distribution.closed || 0);
  if (!stats.total_requests) return '0 / 0 (0%)';
  const pct = (completed / stats.total_requests) * 100;
  return `${completed} / ${stats.total_requests} (${pct.toFixed(pct < 10 && pct > 0 ? 1 : 0)}%)`;
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const RequestStatisticsReport = () => {
  const router = useRouter();
  const [range, setRange] = React.useState(() => defaultDateRange());
  const [stats, setStats] = React.useState<RequestStatistics | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const start = range.start;
  const end = range.end;
  const valid = Boolean(start && end);
  const requestRows = stats?.requests || [];

  const generate = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await api.reports.requestStatistics({
        start_date: start,
        end_date: end,
      });
      setStats(out as RequestStatistics);
    } catch (e) {
      setStats(null);
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
            background: '#c8eedd',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <I.ClipboardList size={14} color="#157a4a" />
        </span>
        <span style={{ color: mInk, fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>
          Request Statistics
        </span>
      </CardHeader>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 12.5, color: mText2, marginBottom: 14 }}>
          Generate request status distribution and average turnaround time for a selected period.
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
        {stats && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(160px, 220px))',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <SummaryBox label="Total Requests" value={stats.total_requests} />
              <SummaryBox label="Completion Rate" value={formatCompletionRate(stats)} />
              <SummaryBox label="Average TAT" value={formatTat(stats.average_tat_hours)} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: mMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                Requests
              </div>
              <div
                style={{
                  overflowX: 'auto',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8,
                }}
              >
                <table style={{ width: '100%', minWidth: 1040, borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col style={{ width: 260 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 90 }} />
                    <col />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 150 }} />
                  </colgroup>
                  <thead style={{ background: '#f7f7fa' }}>
                    <tr>
                      <th style={headerCell}>Request</th>
                      <th style={headerCell}>Status</th>
                      <th style={headerCell}>Urgency</th>
                      <th style={headerCell}>Requester</th>
                      <th style={numberHeaderCell}>Samples</th>
                      <th style={headerCell}>Experiments</th>
                      <th style={headerCell}>Submitted</th>
                      <th style={headerCell}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{ padding: 22, color: mMuted, textAlign: 'center' }}
                        >
                          No request details found in this period.
                        </td>
                      </tr>
                    )}
                    {requestRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => router.push(`/manager/requests/${row.id}`)}
                        style={{ cursor: 'pointer' }}
                        title={`Open request #${row.id}`}
                      >
                        <td style={bodyCell}>
                          <div style={{ fontWeight: 700 }}>{row.title}</div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: mMuted,
                              fontSize: 11.5,
                              marginTop: 3,
                            }}
                          >
                            #{String(row.id).padStart(4, '0')}
                          </div>
                        </td>
                        <td style={bodyCell}>
                          <Pill kind={row.status} />
                        </td>
                        <td style={bodyCell}>
                          <Pill kind={row.urgency} mapping={URGENCY_LABEL} />
                        </td>
                        <td style={bodyCell}>{row.requester}</td>
                        <td style={numberCell}>{row.sample_count}</td>
                        <td style={bodyCell}>
                          {row.experiment_types.length ? row.experiment_types.join(', ') : '-'}
                        </td>
                        <td style={monoCell}>{formatDateTime(row.submitted_at)}</td>
                        <td style={monoCell}>{formatDateTime(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

const SummaryBox = ({ label, value }: { label: string; value: string | number }) => (
  <div
    style={{
      padding: 14,
      borderRadius: 10,
      background: '#f7f7fa',
      border: '1px solid rgba(0,0,0,0.08)',
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: mMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 22,
        fontWeight: 700,
        color: mInk,
        letterSpacing: '-0.01em',
        marginTop: 4,
      }}
    >
      {value}
    </div>
  </div>
);

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

const numberHeaderCell: React.CSSProperties = {
  ...headerCell,
  textAlign: 'right',
};

const bodyCell: React.CSSProperties = {
  padding: '11px 12px',
  fontSize: 12.5,
  color: mInk,
  borderTop: '1px solid rgba(0,0,0,0.05)',
  whiteSpace: 'nowrap',
};

const numberCell: React.CSSProperties = {
  ...bodyCell,
  fontFamily: 'var(--font-mono)',
  color: '#5a5a6e',
  textAlign: 'right',
};

const monoCell: React.CSSProperties = {
  ...bodyCell,
  fontFamily: 'var(--font-mono)',
  color: '#5a5a6e',
};

export default RequestStatisticsReport;
export { RequestStatisticsReport };
