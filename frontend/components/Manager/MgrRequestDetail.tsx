'use client';
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import useMgrRequestDetail from '@/components/Manager/hooks/useMgrRequestDetail';
import Page from '@/components/Manager/Page';
import { muted as mMuted } from '@/lib/colors';
import Breadcrumb from '@/components/Manager/Breadcrumb';
import Pill from '@/components/Manager/Pill';
import URGENCY_LABEL from '@/components/Manager/constants/urgencyLabel';
import { text2 as mText2 } from '@/lib/colors';
import { ink as mInk } from '@/lib/colors';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import { lineSoft as mLineSft } from '@/lib/colors';
import { bgSoft as mBgSoft } from '@/lib/colors';
import { line as mLine } from '@/lib/colors';
import { accent as mAccent } from '@/lib/colors';
import ApprovalModal from '@/components/Manager/ApprovalModal';
import type { Navigate, ShowToast } from '@/lib/types';
const MI = I;

type RequestSampleExperimentProgress = {
  experimentTypeId: number;
  experimentName: string;
  status: string;
  verdict: string | null;
  dispatchId: number | null;
};

type RequestSampleProgressSource = {
  expIds?: number[];
  experiments?: RequestSampleExperimentProgress[];
};

type RequestSampleExperimentChip = {
  id: number;
  name: string;
  code: string;
  group: string;
  status: string;
  verdict: string | null;
  dispatchId: number | null;
};

const MgrRequestDetail = ({
  id,
  navigate,
  showToast,
}: {
  id: number | string | undefined;
  navigate: Navigate;
  showToast?: ShowToast;
}) => {
  const { data: r, loading, error, refresh } = useMgrRequestDetail(id);
  const [modal, setModal] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState(null);
  const runAction = async (op: () => Promise<unknown>, label: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await op();
      showToast?.(label);
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
        <div style={{ padding: '60px 20px', textAlign: 'center', color: mMuted, fontSize: 14 }}>
          Loading…
        </div>
      </Page>
    );
  }
  if (error || !r) {
    return (
      <Page
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'All Requests', onClick: () => navigate({ page: 'mgr_all_requests' }) },
              { label: '?' },
            ]}
          />
        }
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
    runAction(() => api.requests.approve(r.id), `#${r.id} approved`);
  };
  const onMarkComplete = () => {
    if (!window.confirm(`Mark "${r.title}" as complete? This closes the request.`)) return;
    runAction(() => api.requests.close(r.id), `#${r.id} closed`);
  };
  const onSubmitModal = async (reason: string) => {
    const action = modal;
    setModal(null);
    if (action === 'RETURN') {
      await runAction(() => api.requests.returnRequest(r.id, reason), `#${r.id} returned`);
    } else if (action === 'REJECT') {
      await runAction(() => api.requests.reject(r.id, reason), `#${r.id} rejected`);
    }
  };
  const exps = (r.experiment_types || []).map((et) => ({
    id: et.id,
    name: et.name,
    code: et.name
      ? et.name
          .split(/\s+/)
          .map((t) => t[0])
          .join('')
          .slice(0, 4)
          .toUpperCase()
      : '--',
    group: 'RA',
  }));
  const experimentById = new Map(exps.map((e) => [e.id, e]));
  const sampleExperiments = (expIds: number[] | undefined) =>
    (expIds || [])
      .map((expId) => experimentById.get(expId))
      .filter((e): e is (typeof exps)[number] => Boolean(e));
  const experimentCode = (name: string) =>
    name
      ? name
          .split(/\s+/)
          .map((t) => t[0])
          .join('')
          .slice(0, 4)
          .toUpperCase()
      : '--';
  const experimentProgress = (
    sample: RequestSampleProgressSource,
  ): RequestSampleExperimentChip[] => {
    if (sample.experiments?.length) {
      return sample.experiments.map((e) => ({
        id: e.experimentTypeId,
        name: e.experimentName,
        code: experimentCode(e.experimentName),
        group: 'RA',
        status: e.status,
        verdict: e.verdict,
        dispatchId: e.dispatchId,
      }));
    }
    return sampleExperiments(sample.expIds).map((e) => ({
      ...e,
      status: 'pending',
      verdict: null as string | null,
      dispatchId: null as number | null,
    }));
  };
  const isExperimentDone = (e: RequestSampleExperimentChip) =>
    e.status === 'completed' || e.status === 'done' || e.status === 'failed';
  const isExperimentFailed = (e: RequestSampleExperimentChip) =>
    isExperimentDone(e) && (e.verdict === 'fail' || e.status === 'failed');
  const canAct = r.status === 'submitted';
  const canComplete = r.status === 'in_progress';
  return (
    <Page
      breadcrumb={
        <Breadcrumb
          items={[
            { label: 'All Requests', onClick: () => navigate({ page: 'mgr_all_requests' }) },
            { label: r.title },
          ]}
        />
      }
      title={r.title}
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: mMuted,
              letterSpacing: '0.04em',
              padding: '3px 9px',
              borderRadius: 6,
              background: '#ebebf0',
            }}
          >
            #{String(r.id).padStart(4, '0')}
          </span>
          <Pill kind={r.status} />
          <Pill kind={r.urgency} mapping={URGENCY_LABEL} />
          <span style={{ color: mText2, fontSize: 13 }}>
            by{' '}
            <strong style={{ color: mInk, fontFamily: 'var(--font-mono)' }}>
              {r.requester?.username || r.history[0]?.by || '—'}
            </strong>
          </span>
        </span>
      }
      right={
        <>
          {canAct && (
            <>
              <SecondaryBtn
                danger
                disabled={busy}
                onClick={() => setModal('REJECT')}
                icon={<MI.X size={14} />}
              >
                Reject
              </SecondaryBtn>
              <SecondaryBtn
                disabled={busy}
                onClick={() => setModal('RETURN')}
                icon={<MI.Refresh size={14} />}
              >
                Return
              </SecondaryBtn>
              <PrimaryBtn success disabled={busy} onClick={onApprove} icon={<MI.Check size={14} />}>
                {busy ? '…' : 'Approve'}
              </PrimaryBtn>
            </>
          )}
          {canComplete && (
            <PrimaryBtn
              success
              disabled={busy}
              onClick={onMarkComplete}
              icon={<MI.Check size={14} />}
            >
              {busy ? '…' : 'Mark Complete'}
            </PrimaryBtn>
          )}
        </>
      }
    >
      {actionError && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 14,
            borderRadius: 10,
            background: '#fde4e4',
            color: '#c0394a',
            fontSize: 13.5,
            fontWeight: 500,
            border: '1px solid #f6c4c4',
          }}
        >
          {actionError}
        </div>
      )}
      <Card padding={0} style={{ marginBottom: 18 }}>
        <CardHeader>Overview</CardHeader>
        <div
          style={{
            padding: '22px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 18,
            borderBottom: `1px solid ${mLineSft}`,
          }}
        >
          {[
            { label: 'Wafers', value: r.samples.length },
            { label: 'Experiments', value: exps.length },
            { label: 'Submitted', value: r.submitted?.split(' ')[0] || '—' },
            { label: 'Requester', value: r.requester?.username || r.history[0]?.by || '—' },
          ].map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: mMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 700,
                  marginTop: 6,
                  letterSpacing: '-0.01em',
                  color: mInk,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
        {r.note && (
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${mLineSft}` }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: mText2,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}
            >
              Requester note
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: mInk }}>{r.note}</div>
          </div>
        )}
        <CardHeader>Submission History</CardHeader>
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {r.history.map((h, i) => {
            const colorMap: Record<string, { dot: string; bg: string; fg: string }> = {
              SUBMIT: { dot: '#5550a0', bg: '#e8e7f6', fg: '#5550a0' },
              APPROVE: { dot: '#157a4a', bg: '#c8eedd', fg: '#157a4a' },
              REJECT: { dot: '#c0394a', bg: '#fde4e4', fg: '#c0394a' },
              RETURN: { dot: '#a73d56', bg: '#f9d7e0', fg: '#a73d56' },
              CANCEL: { dot: '#777788', bg: '#ebebf0', fg: '#5a5a6e' },
            };
            const c = colorMap[h.action] || { dot: '#a8a8b8', bg: '#f1f1f5', fg: '#5a5a6e' };
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr auto',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: '#fff',
                    border: `3px solid ${c.dot}`,
                    marginTop: 2,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: c.bg,
                        color: c.fg,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {h.action}
                    </span>
                    <span style={{ fontSize: 13.5, color: mText2 }}>
                      by{' '}
                      <strong style={{ color: mInk, fontFamily: 'var(--font-mono)' }}>
                        {h.by}
                      </strong>
                    </span>
                  </div>
                  {h.note && (
                    <div
                      style={{
                        fontSize: 13,
                        color: mText2,
                        marginTop: 6,
                        padding: '8px 10px',
                        background: mBgSoft,
                        borderRadius: 6,
                      }}
                    >
                      {h.note}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: mMuted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.at}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding={0}>
        <CardHeader>Experiments by Wafer</CardHeader>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {r.samples.map((s, si) => {
            const experiments = experimentProgress(s);
            const total = experiments.length;
            const doneCount = experiments.filter(isExperimentDone).length;
            return (
            <button
              key={si}
              onClick={() => navigate({ page: 'lab_wafer', id: s.id })}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 70px',
                alignItems: 'center',
                gap: 18,
                padding: '14px 18px',
                background: '#fff',
                borderRadius: 10,
                border: `1px solid ${mLine}`,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color 0.12s, background 0.12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(108,103,184,0.4)';
                e.currentTarget.style.background = '#fbfbfd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = mLine;
                e.currentTarget.style.background = '#fff';
              }}
              title={`Open wafer ${s.wafer}`}
            >
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <MI.Wafer size={15} color={mAccent} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: mInk,
                    }}
                  >
                    {s.wafer}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: mMuted, marginTop: 4, marginLeft: 23 }}>
                  {s.size}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {experiments.map((e) => {
                  const done = isExperimentDone(e);
                  const fail = isExperimentFailed(e);
                  return (
                  <span
                    key={e.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 12px 6px 7px',
                      borderRadius: 999,
                      background: fail ? '#fde4e4' : done ? '#e7f6ec' : '#f4f4f7',
                      border: `1px solid ${fail ? '#f4b4b9' : done ? '#9ad9b7' : 'rgba(0,0,0,0.08)'}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 7px',
                        borderRadius: 999,
                        background: fail ? '#a93445' : done ? '#157a4a' : '#cbcbd6',
                        color: '#fff',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {e.code}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: fail ? '#5a1a22' : done ? '#1f3d2c' : '#a8a8b8',
                        fontWeight: 500,
                      }}
                    >
                      {e.name}
                    </span>
                    {fail ? (
                      <MI.X size={13} color="#a93445" strokeWidth={3} />
                    ) : done ? (
                      <MI.Check size={13} color="#157a4a" strokeWidth={3} />
                    ) : (
                      <span
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: 999,
                          border: '1.5px dashed #cbcbd6',
                        }}
                      />
                    )}
                  </span>
                  );
                })}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: doneCount === total && total > 0 ? '#157a4a' : mInk,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {doneCount}
                  <span style={{ color: '#a8a8b8', fontWeight: 500 }}>/{total}</span>
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: mMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 2,
                  }}
                >
                  done
                </div>
              </div>
            </button>
            );
          })}
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

export default MgrRequestDetail;
export { MgrRequestDetail };
