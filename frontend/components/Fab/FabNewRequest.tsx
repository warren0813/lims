'use client';
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import useExperimentTypes from '@/components/Fab/hooks/useExperimentTypes';
import FabPage from '@/components/Fab/FabPage';
import SectionStep from '@/components/Fab/SectionStep';
import FieldLabel from '@/components/Manager/FieldLabel';
import inputBase from '@/components/Fab/utils/inputBase';
import onFocus from '@/components/Fab/utils/onFocus';
import onBlur from '@/components/Fab/utils/onBlur';
import URGENCY_OPTS from '@/components/Fab/constants/urgencyOptions';
import UrgencyTile from '@/components/Fab/UrgencyTile';
import ExpCard from '@/components/Fab/ExpCard';
import FabCard from '@/components/Fab/FabCard';
import SectionLabel from '@/components/Fab/SectionLabel';
import UrgencyPill from '@/components/Fab/UrgencyPill';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import type { Navigate, ShowToast } from '@/lib/types';
const F = I;
type RequestDetail = Awaited<ReturnType<typeof api.requests.get>>;
type WaferEntry = { wafer: string; size: string; expIds: number[] };
const toggleExpId = (expIds: number[], expId: number): number[] =>
  expIds.includes(expId) ? expIds.filter((x: number) => x !== expId) : [...expIds, expId];
const FabNewRequest = ({
  navigate,
  draft = null,
  isEdit = false,
  showToast,
}: {
  navigate: Navigate;
  draft?: RequestDetail | null;
  isEdit?: boolean;
  showToast?: ShowToast;
}) => {
  const { data: liveExperiments, error: experimentsError } = useExperimentTypes();
  const experimentChoices = liveExperiments.map((e) => ({
    id: e.id,
    name: e.name,
    desc: e.description,
    group: e.labCategory,
  }));
  const [title, setTitle] = React.useState(draft?.title || '');
  const [note, setNote] = React.useState(draft?.note || '');
  const [urgency, setUrgency] = React.useState(draft?.urgency || '1w');
  const [wafers, setWafers] = React.useState<WaferEntry[]>(
    draft?.samples?.length
      ? draft.samples.map((s) => ({ wafer: s.wafer, size: s.size, expIds: s.expIds || [] }))
      : [{ wafer: '', size: '200mm', expIds: [] }],
  );
  const [busy, setBusy] = React.useState(false);
  const [apiError, setApiError] = React.useState(null);
  const addWafer = () => setWafers((w) => [...w, { wafer: '', size: '200mm', expIds: [] }]);
  const removeWafer = (i: number) =>
    setWafers((w) => (w.length === 1 ? w : w.filter((_: WaferEntry, j: number) => j !== i)));
  const updateWafer = (i: number, key: string, value: string) =>
    setWafers((w) => w.map((s: WaferEntry, j: number) => (j === i ? { ...s, [key]: value } : s)));
  const toggleExp = (i: number, expId: number) =>
    setWafers((w) =>
      w.map((s: WaferEntry, j: number) =>
        j === i ? { ...s, expIds: toggleExpId(s.expIds, expId) } : s,
      ),
    );
  const totalExp = wafers.reduce((acc: number, w: WaferEntry) => acc + w.expIds.length, 0);
  const basicValid = title.trim().length > 0;
  const samplesValid = wafers.every((w) => w.wafer.trim() && w.expIds.length > 0);
  const valid = basicValid && samplesValid;
  const handle = async (publish: boolean) => {
    setBusy(true);
    setApiError(null);
    try {
      const expIdsAll = Array.from(new Set(wafers.flatMap((w) => w.expIds)));
      const samples = wafers.map((w) => ({
        wafer_id: w.wafer.trim(),
        wafer_size: w.size,
        experiment_type_ids: w.expIds,
      }));
      const payload = {
        title: title.trim(),
        note: note.trim(),
        urgency,
        experiment_type_ids: expIdsAll,
        samples,
      };
      if (isEdit) {
        await api.requests.update(draft.id, payload);
        if (publish) {
          await api.requests.submit(draft.id);
          showToast?.(`Draft #${draft.id} submitted — awaiting approval`);
          navigate({ page: 'fab_request', id: draft.id });
        } else {
          showToast?.(`Draft #${draft.id} updated`);
          navigate({ page: 'fab_drafts' });
        }
        return;
      }
      const created = await api.requests.create(payload);
      if (publish) {
        await api.requests.submit(created.id);
        showToast?.(`Request #${created.id} submitted — awaiting approval`);
        navigate({ page: 'fab_requests' });
      } else {
        showToast?.(`Draft #${created.id} saved`);
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
        <button
          onClick={() => navigate(isEdit ? { page: 'fab_drafts' } : { page: 'fab_requests' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
            color: '#6c67b8',
            marginBottom: 14,
            cursor: 'pointer',
          }}
        >
          <F.ChevronLeft size={14} /> {isEdit ? 'Drafts' : 'My Requests'}
        </button>
      }
      title={isEdit ? `Edit Draft #${String(draft?.id ?? '').padStart(4, '0')}` : 'New Request'}
      subtitle={isEdit ? 'Continue where you left off — submit when ready' : undefined}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 22,
          alignItems: 'flex-start',
        }}
      >
        <div>
          {}
          <SectionStep n={1} title="Basic Information" subtitle="Title, notes, and how urgent">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <FieldLabel required>Title</FieldLabel>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. TCT 050901 — Q2 reliability batch"
                  style={inputBase}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
              <div>
                <FieldLabel>Note (optional)</FieldLabel>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Special handling, related work orders, etc."
                  style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
              <div>
                <FieldLabel required>Urgency</FieldLabel>
                <div style={{ display: 'flex', gap: 12 }}>
                  {URGENCY_OPTS.map((o) => (
                    <UrgencyTile
                      key={o.id}
                      opt={o}
                      active={urgency === o.id}
                      onClick={() => setUrgency(o.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </SectionStep>

          {}
          <SectionStep
            n={2}
            title="Samples & Experiments"
            subtitle={`${wafers.length} wafer${wafers.length === 1 ? '' : 's'} · ${totalExp} experiment${totalExp === 1 ? '' : 's'} total — pick experiments for each wafer`}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {wafers.map((w, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    background: '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '38px 1fr 130px 36px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                      }}
                    >
                      #{String(i + 1).padStart(2, '0')}
                    </span>
                    <input
                      value={w.wafer}
                      onChange={(e) => updateWafer(i, 'wafer', e.target.value)}
                      placeholder="Wafer ID (e.g. W001)"
                      style={inputBase}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                    <select
                      value={w.size}
                      onChange={(e) => updateWafer(i, 'size', e.target.value)}
                      style={{
                        ...inputBase,
                        paddingRight: 32,
                        appearance: 'none',
                        cursor: 'pointer',
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23777788' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                      }}
                    >
                      <option value="100mm">100mm</option>
                      <option value="150mm">150mm</option>
                      <option value="200mm">200mm</option>
                      <option value="300mm">300mm</option>
                    </select>
                    <button
                      onClick={() => removeWafer(i)}
                      disabled={wafers.length === 1}
                      title="Remove wafer"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        color: wafers.length === 1 ? '#cbcbd6' : '#a8a8b8',
                        cursor: wafers.length === 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.1s, color 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        if (wafers.length > 1) {
                          e.currentTarget.style.background = '#fde4e4';
                          e.currentTarget.style.color = '#c0394a';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (wafers.length > 1) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#a8a8b8';
                        }
                      }}
                    >
                      <F.Trash size={15} />
                    </button>
                  </div>

                  <div style={{ marginTop: 14, paddingLeft: 48 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Experiments <span style={{ color: '#c0394a' }}>*</span>
                      </span>
                      {w.expIds.length === 0 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#c0394a' }}>
                          Pick at least one
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 10,
                      }}
                    >
                      {experimentChoices.length === 0 && experimentsError && (
                        <div
                          style={{
                            gridColumn: '1 / -1',
                            fontSize: 13,
                            color: '#c0394a',
                            padding: '12px 14px',
                            background: '#fde4e4',
                            border: '1px solid #f6c4c4',
                            borderRadius: 10,
                          }}
                        >
                          Couldn&apos;t load experiment types: {experimentsError}
                        </div>
                      )}
                      {experimentChoices.map((e) => (
                        <ExpCard
                          key={e.id}
                          exp={e}
                          active={w.expIds.includes(e.id)}
                          onClick={() => toggleExp(i, e.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addWafer}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px dashed rgba(0,0,0,0.18)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.12s, color 0.12s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6c67b8';
                  e.currentTarget.style.color = '#6c67b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <F.Plus size={14} /> Add another wafer
              </button>
            </div>
          </SectionStep>
        </div>

        {}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 32 }}
        >
          <FabCard padding={20}>
            <SectionLabel style={{ marginBottom: 10 }}>Summary</SectionLabel>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              <span
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 999,
                  background: basicValid ? '#6c67b8' : '#ebebf0',
                }}
              />
              <span
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 999,
                  background: samplesValid ? '#6c67b8' : '#ebebf0',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                  }}
                >
                  Title
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    marginTop: 4,
                    color: title ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: title ? 600 : 400,
                  }}
                >
                  {title || 'Not set'}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                  }}
                >
                  Urgency
                </div>
                <div style={{ marginTop: 6 }}>
                  <UrgencyPill urgency={urgency} />
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Wafers
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {wafers.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: w.wafer ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {w.wafer || `Wafer ${String(i + 1).padStart(2, '0')}`}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: w.expIds.length === 0 ? '#c0394a' : 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {w.expIds.length} exp
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FabCard>
        </div>
      </div>

      {apiError && (
        <div
          style={{
            padding: '12px 16px',
            marginTop: 16,
            borderRadius: 10,
            background: '#fde4e4',
            color: '#c0394a',
            fontSize: 13.5,
            fontWeight: 500,
            border: '1px solid #f6c4c4',
          }}
        >
          {apiError}
        </div>
      )}

      {}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 24,
          marginLeft: -44,
          marginRight: -44,
          padding: '16px 44px',
          background: 'rgba(255,255,255,0.88)',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>
            {(basicValid ? 1 : 0) + (samplesValid ? 1 : 0)}/2
          </strong>{' '}
          sections complete
          {!valid && ' — every wafer needs an ID and at least one experiment'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SecondaryBtn
            onClick={() => navigate(isEdit ? { page: 'fab_drafts' } : { page: 'fab_requests' })}
          >
            Cancel
          </SecondaryBtn>
          <SecondaryBtn disabled={busy} onClick={() => handle(false)}>
            {busy ? 'Saving…' : isEdit ? 'Save & Stay Draft' : 'Save Draft'}
          </SecondaryBtn>
          <PrimaryBtn disabled={!valid || busy} onClick={() => handle(true)}>
            {busy ? 'Submitting…' : isEdit ? 'Submit Draft' : 'Submit Request'}
          </PrimaryBtn>
        </div>
      </div>
    </FabPage>
  );
};
export default FabNewRequest;
export { FabNewRequest };
