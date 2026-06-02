'use client';
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import * as UI from '@/components/ui/UI';
import useLabDispatchDetail from '@/components/Lab/hooks/useLabDispatchDetail';
import Page from '@/components/Manager/Page';
import { muted } from '@/lib/colors';
import Breadcrumb from '@/components/Manager/Breadcrumb';
import STATUS_FLOW from '@/components/Lab/constants/statusFlow';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import Pill from '@/components/Manager/Pill';
import { text2 } from '@/lib/colors';
import { ink } from '@/lib/colors';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import { accent } from '@/lib/colors';
import PILL from '@/components/Lab/constants/pill';
import { lineSoft } from '@/lib/colors';
import { bgSoft } from '@/lib/colors';
import RecordResultModal from '@/components/Lab/RecordResultModal';
import Modal from '@/components/Manager/Modal';
import TextArea from '@/components/Manager/TextArea';
import type { Navigate, ShowToast } from '@/lib/types';
const LF = I;

type DispatchDetail = NonNullable<ReturnType<typeof useLabDispatchDetail>['dispatch']>;
type WaferResult = ReturnType<typeof useLabDispatchDetail>['waferResults'][number];

// Builds the contextual action buttons shown in the page header. Extracted to
// keep the per-status branching out of the main component body — behavior is
// identical to the original inline if/else-if chain.
const buildActions = ({
  d,
  busy,
  confirmThen,
  setExceptionNote,
  setExceptionOpen,
  setRecordOpen,
  setBusy,
  setActionError,
  showToast,
  navigate,
}: {
  d: DispatchDetail;
  busy: boolean;
  confirmThen: (msg: string, op: () => Promise<unknown>, label: string) => void | Promise<void>;
  setExceptionNote: React.Dispatch<React.SetStateAction<string>>;
  setExceptionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRecordOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setActionError: React.Dispatch<React.SetStateAction<string | null>>;
  showToast?: ShowToast;
  navigate: Navigate;
}): React.ReactNode => {
  if (d.status === 'dispatched' || d.status === 'pending')
    return (
      <>
        <SecondaryBtn
          danger
          disabled={busy}
          onClick={() =>
            confirmThen(`Abort ${d.code}?`, () => api.dispatches.abort(d.id), `${d.code} aborted`)
          }
        >
          Abort
        </SecondaryBtn>
        <PrimaryBtn
          icon={<LF.Play size={14} />}
          success
          disabled={busy}
          onClick={() =>
            confirmThen(`Start ${d.code}?`, () => api.dispatches.start(d.id), `${d.code} started`)
          }
        >
          {busy ? '…' : 'Start Running'}
        </PrimaryBtn>
      </>
    );
  if (d.status === 'running')
    return (
      <>
        <SecondaryBtn
          danger
          disabled={busy}
          onClick={() => {
            setExceptionNote('');
            setExceptionOpen(true);
          }}
        >
          Mark Exception
        </SecondaryBtn>
        <PrimaryBtn
          icon={<LF.Check size={14} />}
          disabled={busy}
          onClick={() =>
            confirmThen(
              `Unload ${d.code}?`,
              () => api.dispatches.unload(d.id),
              `${d.code} unloaded`,
            )
          }
        >
          {busy ? '…' : 'Mark Unloaded'}
        </PrimaryBtn>
      </>
    );
  if (d.status === 'unloaded')
    return (
      <>
        <PrimaryBtn
          icon={<LF.ClipboardList size={14} />}
          disabled={busy}
          onClick={() => setRecordOpen(true)}
        >
          Record Result
        </PrimaryBtn>
      </>
    );
  if (d.status === 'exception' && d.raw_status === 'execution_exception')
    return (
      <>
        <SecondaryBtn
          danger
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                `Abort ${d.code}? The dispatch will be closed and the WIP will remain open for a new dispatch.`,
              )
            )
              return;
            setBusy(true);
            setActionError(null);
            try {
              await api.dispatches.abort(d.id);
              showToast?.(`${d.code} aborted — you can now create a new dispatch`);
              navigate({ page: 'lab_wip_detail', id: d.wipId });
            } catch (e) {
              setActionError(e.message || String(e));
              setBusy(false);
            }
          }}
        >
          Abort Dispatch
        </SecondaryBtn>
        <PrimaryBtn
          icon={<LF.Refresh size={14} />}
          disabled={busy}
          onClick={() =>
            confirmThen(
              `Redispatch ${d.code}? A new dispatch will be created with the same equipment and recipe.`,
              () => api.dispatches.redispatch(d.id),
              `${d.code} redispatched`,
            )
          }
        >
          {busy ? '…' : 'Redispatch'}
        </PrimaryBtn>
      </>
    );
  return null;
};

// Resolves the banner copy for terminal failure states (aborted / exception).
// Mirrors the original nested ternary exactly.
const failureMessage = (d: DispatchDetail): string => {
  if (d.status === 'aborted') return 'Dispatch aborted before completion.';
  if (d.raw_status === 'pending_redispatch')
    return 'Dispatch superseded — a new dispatch has been created to continue this WIP.';
  return 'Execution exception — abort this dispatch to open a new one, or redispatch on the same equipment.';
};

// One node + connector in the lifecycle stepper.
const LifecycleStep = ({
  status,
  index,
  done,
  cur,
}: {
  status: string;
  index: number;
  done: boolean;
  cur: boolean;
}) => {
  const reachedColor = done ? accent : cur ? accent : '#dcdce3';
  return (
    <React.Fragment>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: done || cur ? accent : '#fff',
            border: `2px solid ${reachedColor}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          {done && <LF.Check size={13} color="#fff" strokeWidth={3} />}
          {cur && <span style={{ width: 8, height: 8, borderRadius: 999, background: '#fff' }} />}
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: done || cur ? ink : muted,
            whiteSpace: 'nowrap',
          }}
        >
          {PILL[status as keyof typeof PILL].label}
        </span>
      </div>
      {index < STATUS_FLOW.length - 1 && (
        <div
          style={{
            flex: 1,
            height: 2,
            background: done ? accent : '#ececf2',
            margin: '0 4px',
            marginBottom: 22,
          }}
        />
      )}
    </React.Fragment>
  );
};

// Live countdown + progress bar shown while a dispatch is running. The timing
// math is unchanged from the original inline IIFE.
const RunningProgress = ({ d }: { d: DispatchDetail }) => {
  const startMs = new Date(d.dispatchedAtIso).getTime();
  // Prefer the server's auto_complete_at deadline; fall back to the
  // operator's estimate for legacy running rows with no deadline.
  const endMs = d.autoCompleteAtIso
    ? new Date(d.autoCompleteAtIso).getTime()
    : d.estimatedDurationSeconds
      ? startMs + d.estimatedDurationSeconds * 1000
      : 0;
  const nowMs = Date.now();
  const totalSec = endMs > startMs ? (endMs - startMs) / 1000 : 0;
  const elapsedSec = Math.max(0, (nowMs - startMs) / 1000);
  const remainSec = totalSec > 0 ? Math.max(0, (endMs - nowMs) / 1000) : 0;
  const pct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;
  return (
    <div
      style={{
        padding: '0 26px 22px',
        borderTop: `1px solid ${lineSoft}`,
        paddingTop: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: text2,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: '#f4a8bf',
              boxShadow: '0 0 8px #f4a8bf',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
          Running · dispatched{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: ink }}>
            {d.dispatchedAt.split(' ')[1]}
          </span>
          <span style={{ color: muted }}>·</span>
          <span style={{ color: muted }}>est. {UI.formatDuration(d.estimatedDurationSeconds)}</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: accent, fontWeight: 700 }}>
          {totalSec > 0 ? `${UI.formatDuration(Math.ceil(remainSec))} remaining` : '—'}
        </span>
      </div>
      {totalSec > 0 ? (
        <>
          <div
            style={{
              position: 'relative',
              height: 8,
              background: '#f1eef9',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #f4a8bf, #6c67b8)',
                borderRadius: 999,
                transition: 'width 0.3s',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -2,
                left: `calc(${pct}% - 6px)`,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: '#fff',
                border: '2px solid #6c67b8',
                boxShadow: '0 0 0 0 rgba(108,103,184,0.4)',
                animation: 'ringpulse 1.8s ease-out infinite',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: muted,
              marginTop: 6,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {Math.round(pct)}% of {UI.formatDuration(totalSec)} estimate
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: muted, fontStyle: 'italic' }}>
          Estimated duration not set — countdown unavailable.
        </div>
      )}
    </div>
  );
};

// One row in the per-wafer results table. Verdict styling matches the original
// inline ternaries.
const WaferResultRow = ({ w }: { w: WaferResult }) => {
  const v = w.verdict;
  const pillBg = v === 'pass' ? '#e7f0e9' : v === 'fail' ? '#fbe4e6' : '#f1f1f5';
  const pillFg = v === 'pass' ? '#2e6a47' : v === 'fail' ? '#a93445' : muted;
  const pillLabel = v === 'pass' ? '✓ Pass' : v === 'fail' ? '✗ Fail' : '—';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 110px',
        alignItems: 'center',
        gap: 8,
        padding: '12px 14px',
        borderTop: `1px solid ${lineSoft}`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          color: ink,
        }}
      >
        {w.wafer}
      </span>
      <span style={{ fontSize: 12.5, color: text2 }}>{w.size}</span>
      <span style={{ textAlign: 'right' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 999,
            background: pillBg,
            color: pillFg,
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          {pillLabel}
        </span>
      </span>
    </div>
  );
};

const LabDispatchDetail = ({
  id,
  navigate,
  showToast,
}: {
  id: number | string;
  navigate: Navigate;
  showToast?: ShowToast;
}) => {
  const { dispatch: d, waferResults, loading, error, refresh } = useLabDispatchDetail(id);
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (d?.status !== 'running') return;
    const h = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(h);
  }, [d?.status]);
  // Simulated machine auto-complete: the server stamped auto_complete_at
  // (now + random 3~5 s) when the dispatch entered running. We arm a single
  // timer for the exact remaining gap and fire the automation endpoint once
  // it elapses — reopening the page mid-run recomputes the gap from the
  // server time, and a past-due deadline fires immediately. The manual
  // Unload → Record Result buttons stay available as the operator override;
  // if they (or another tab) win the race, the server 400s this call and we
  // just resync.
  const autoFiredRef = React.useRef<Set<number | string>>(new Set());
  // Key the effect on stable primitives, not the `d` object — the hook
  // rebuilds `d` on every render (incl. each 1s tick above), so depending on
  // `d` would needlessly re-arm the timer every second.
  const dispatchId = d?.id;
  const dispatchStatus = d?.status;
  const autoCompleteAtIso = d?.autoCompleteAtIso;
  React.useEffect(() => {
    if (dispatchId == null || dispatchStatus !== 'running' || !autoCompleteAtIso) return;
    if (autoFiredRef.current.has(dispatchId)) return;
    const remainMs = new Date(autoCompleteAtIso).getTime() - Date.now();
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        if (cancelled || autoFiredRef.current.has(dispatchId)) return;
        autoFiredRef.current.add(dispatchId);
        try {
          await api.dispatches.autoComplete(dispatchId);
        } catch {
          // Beaten by a manual completion / another tab — resync below.
        }
        if (!cancelled) refresh();
      },
      Math.max(0, remainMs),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dispatchId, dispatchStatus, autoCompleteAtIso, refresh]);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [exceptionOpen, setExceptionOpen] = React.useState(false);
  const [exceptionNote, setExceptionNote] = React.useState('');
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
  const confirmThen = (msg: string, op: () => Promise<unknown>, label: string) => {
    if (!window.confirm(msg)) return;
    return runAction(op, label);
  };
  if (loading && !d) {
    return (
      <Page title="Loading dispatch…">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: muted, fontSize: 14 }}>
          Loading…
        </div>
      </Page>
    );
  }
  if (error || !d) {
    return (
      <Page
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Dispatches', onClick: () => navigate({ page: 'lab_dispatches' }) },
              { label: '?' },
            ]}
          />
        }
        title="Dispatch not found"
      >
        <div style={{ padding: 24, color: '#c0394a', fontSize: 14 }}>
          {error || 'This dispatch is no longer available.'}
        </div>
      </Page>
    );
  }
  const isFailed = d.status === 'aborted' || d.status === 'exception';
  const isDone = d.status === 'completed';
  const stepIdx = isDone ? STATUS_FLOW.length - 1 : STATUS_FLOW.indexOf(d.status);
  const actions = buildActions({
    d,
    busy,
    confirmThen,
    setExceptionNote,
    setExceptionOpen,
    setRecordOpen,
    setBusy,
    setActionError,
    showToast,
    navigate,
  });
  const wipCode = `WIP-${String(d.wipId).padStart(4, '0')}`;
  const rec = d.recipeParams ? { name: d.recipeName, params: d.recipeParams } : null;
  return (
    <Page
      breadcrumb={
        <Breadcrumb
          items={[
            { label: 'Dispatches', onClick: () => navigate({ page: 'lab_dispatches' }) },
            { label: wipCode, onClick: () => navigate({ page: 'lab_wip_detail', id: d.wipId }) },
            { label: d.code },
          ]}
        />
      }
      title={`Dispatch ${d.code}`}
      subtitle={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <Pill kind={d.status} dotted={d.status === 'running'} />
          <span style={{ color: text2, fontSize: 13 }}>
            {d.experimentName || '—'} →{' '}
            <strong style={{ color: ink, fontFamily: 'var(--font-mono)' }}>
              {d.equipmentName || '—'}
            </strong>
          </span>
        </span>
      }
      right={actions}
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
      {}
      <Card padding={0} style={{ marginBottom: 18 }}>
        <CardHeader>Lifecycle</CardHeader>
        <div style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {STATUS_FLOW.map((s, i) => {
            const done = isDone ? i <= stepIdx : !isFailed && i < stepIdx;
            const cur = !isDone && !isFailed && i === stepIdx;
            return <LifecycleStep key={s} status={s} index={i} done={done} cur={cur} />;
          })}
        </div>
        {d.status === 'running' && d.dispatchedAtIso && <RunningProgress d={d} />}
        {(d.status === 'aborted' || d.status === 'exception') && (
          <div
            style={{
              padding: '12px 24px',
              borderTop: `1px solid ${lineSoft}`,
              background: '#fbe4e6',
              color: '#a93445',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <LF.Alert size={14} color="#a93445" style={{ verticalAlign: '-2px', marginRight: 6 }} />
            {failureMessage(d)}
          </div>
        )}
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 360px',
          gap: 18,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card padding={0}>
            <CardHeader>Dispatch Info</CardHeader>
            <div
              style={{ padding: 22, display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 12 }}
            >
              <div style={{ fontSize: 13, color: text2 }}>WIP</div>
              <button
                onClick={() => navigate({ page: 'lab_wip_detail', id: d.wipId })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: accent,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  textAlign: 'left',
                }}
              >
                {wipCode}
              </button>
              <div style={{ fontSize: 13, color: text2 }}>Experiment Type</div>
              <div style={{ fontSize: 14, color: ink }}>{d.experimentName || '—'}</div>
              <div style={{ fontSize: 13, color: text2 }}>Equipment</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: ink }}>
                {d.equipmentName || '—'}
              </div>
              <div style={{ fontSize: 13, color: text2 }}>Recipe</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>
                {d.recipeName || '—'}
              </div>
              <div style={{ fontSize: 13, color: text2 }}>Operator</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>
                {d.operator || '—'}
              </div>
              <div style={{ fontSize: 13, color: text2 }}>Est. Duration</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>
                {UI.formatDuration(d.estimatedDurationSeconds)}
              </div>
              <div style={{ fontSize: 13, color: text2 }}>Dispatched At</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>
                {d.dispatchedAt || '—'}
              </div>
              <div style={{ fontSize: 13, color: text2 }}>Completed At</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>
                {d.completedAt || '—'}
              </div>
              {d.note && (
                <>
                  <div style={{ fontSize: 13, color: '#a93445', fontWeight: 600 }}>
                    Exception Note
                  </div>
                  <div style={{ fontSize: 13.5, color: ink, lineHeight: 1.55 }}>{d.note}</div>
                </>
              )}
            </div>
          </Card>

          {(d.result || waferResults.length > 0) && (
            <Card padding={0}>
              <CardHeader>
                <span>Recorded Result</span>
                {d.result?.recordedAt && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11.5,
                      color: muted,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {d.result.recordedAt}
                  </span>
                )}
              </CardHeader>
              <div
                style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: text2,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Comment
                  </div>
                  <div style={{ fontSize: 14, color: ink, lineHeight: 1.55 }}>
                    {d.result?.comment ? (
                      d.result.comment
                    ) : (
                      <span style={{ color: muted, fontStyle: 'italic' }}>
                        No comment recorded.
                      </span>
                    )}
                  </div>
                </div>
                {waferResults.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: text2,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      Per-Wafer Results ({waferResults.length})
                    </div>
                    <div
                      style={{
                        border: `1px solid ${lineSoft}`,
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 90px 110px',
                          background: bgSoft,
                          padding: '8px 14px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: muted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        <div>Wafer</div>
                        <div>Size</div>
                        <div style={{ textAlign: 'right' }}>Verdict</div>
                      </div>
                      {waferResults.map((w) => (
                        <WaferResultRow key={w.sampleId} w={w} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <Card padding={0}>
          <CardHeader>Recipe Parameters</CardHeader>
          <div
            style={{ padding: 22, display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 10 }}
          >
            {rec ? (
              Object.entries(rec.params).map(([k, v]) => (
                <React.Fragment key={k}>
                  <div style={{ fontSize: 12.5, color: text2, textTransform: 'capitalize' }}>
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: ink }}>
                    {v as React.ReactNode}
                  </div>
                </React.Fragment>
              ))
            ) : (
              <div style={{ color: muted, fontSize: 13 }}>No recipe selected</div>
            )}
          </div>
        </Card>
      </div>

      <RecordResultModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        dispatch={d}
        waferResults={waferResults}
        onSubmit={async (payload: { comment: string }) => {
          setRecordOpen(false);
          await runAction(
            () => api.dispatches.recordResult(d.id, payload),
            `${d.code} result recorded`,
          );
        }}
      />

      <Modal
        open={exceptionOpen}
        onClose={() => setExceptionOpen(false)}
        title="Mark Execution Exception"
        width={480}
        footer={
          <>
            <SecondaryBtn onClick={() => setExceptionOpen(false)}>Cancel</SecondaryBtn>
            <PrimaryBtn
              danger
              disabled={busy || !exceptionNote.trim()}
              onClick={async () => {
                setExceptionOpen(false);
                await runAction(
                  () => api.dispatches.reportException(d.id, exceptionNote.trim()),
                  `${d.code} flagged as exception`,
                );
              }}
            >
              Confirm Exception
            </PrimaryBtn>
          </>
        }
      >
        <div style={{ fontSize: 13.5, color: ink, marginBottom: 16 }}>
          Describe what went wrong during this dispatch run. This note will be permanently attached
          to the dispatch record.
        </div>
        <label
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: text2,
            display: 'block',
            marginBottom: 6,
          }}
        >
          Exception Reason <span style={{ color: '#c0394a' }}>*</span>
        </label>
        <TextArea
          value={exceptionNote}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExceptionNote(e.target.value)}
          placeholder="e.g. Equipment malfunction — temperature spike at 15 min mark"
          style={{ width: '100%' }}
        />
      </Modal>
    </Page>
  );
};
export default LabDispatchDetail;
export { LabDispatchDetail };
