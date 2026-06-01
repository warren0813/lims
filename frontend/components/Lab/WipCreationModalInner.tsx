'use client';
/* eslint-disable react-hooks/exhaustive-deps -- modal init-on-open effect intentionally omits derived data deps (would loop) */
import React from 'react';
import api from '@/lib/api';
import useWipCreationData from '@/components/Lab/hooks/useWipCreationData';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import { muted } from '@/lib/colors';
import FieldLabel from '@/components/Manager/FieldLabel';
import SelectInput from '@/components/Manager/SelectInput';
import { line } from '@/lib/colors';
import { bgSoft } from '@/lib/colors';
import { text2 } from '@/lib/colors';
import { ink } from '@/lib/colors';
import { lineSoft } from '@/lib/colors';
import { accent } from '@/lib/colors';
import TextArea from '@/components/Manager/TextArea';

const WipCreationModalInner = ({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: (wip: Awaited<ReturnType<typeof api.wips.create>>) => void;
}) => {
  const {
    experimentTypes,
    pickerSamples,
    equipment,
    loading,
    error: loadError,
  } = useWipCreationData();
  const [experimentTypeId, setExperimentTypeId] = React.useState<string | number>('');
  const [selectedSampleIds, setSelectedSampleIds] = React.useState([]);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [submitErr, setSubmitErr] = React.useState(null);
  const eligibleSamples = experimentTypeId
    ? pickerSamples.filter((s) => (s.expIds || []).includes(experimentTypeId))
    : [];
  const capableEquipment = equipment.filter((e) =>
    (e.capabilities || []).some((c: { id: number }) => c.id === experimentTypeId),
  );
  const maxBatch = capableEquipment.reduce((m, e) => Math.max(m, e.capacity || 0), 0);
  const biggest = capableEquipment.reduce(
    (best, e) => ((e.capacity || 0) > (best?.capacity || 0) ? e : best),
    null,
  );
  React.useEffect(() => {
    const selectableIds = new Set(eligibleSamples.filter((s) => !s.blockReason).map((s) => s.id));
    setSelectedSampleIds((prev) => prev.filter((id) => selectableIds.has(id)));
  }, [experimentTypeId]);
  const toggleSample = (id: number) => {
    const s = pickerSamples.find((s) => s.id === id);
    if (s?.blockReason) return;
    setSelectedSampleIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (maxBatch && prev.length >= maxBatch) return prev;
      return [...prev, id];
    });
  };
  const valid = !!experimentTypeId && selectedSampleIds.length > 0 && !loading;
  const submit = async () => {
    setBusy(true);
    setSubmitErr(null);
    try {
      const created = await api.wips.create({
        experimentTypeId,
        sampleIds: selectedSampleIds,
        note: note.trim(),
      });
      onSaved?.(created);
    } catch (e) {
      setSubmitErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={true}
      onClose={onClose}
      title="New WIP"
      width={680}
      footer={
        <>
          <SecondaryBtn onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn disabled={!valid || busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create WIP'}
          </PrimaryBtn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(loadError || submitErr) && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: '#fde4e4',
              color: '#c0394a',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid #f6c4c4',
            }}
          >
            {loadError || submitErr}
          </div>
        )}
        {loading && (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: muted, fontSize: 13 }}>
            Loading…
          </div>
        )}
        <div>
          <FieldLabel required>Experiment Type</FieldLabel>
          <SelectInput
            value={experimentTypeId === '' ? '' : String(experimentTypeId)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setExperimentTypeId(e.target.value ? Number(e.target.value) : '')
            }
          >
            <option value="">— pick an experiment type —</option>
            {experimentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.labCategory ? `${t.name} (${t.labCategory})` : t.name}
              </option>
            ))}
          </SelectInput>
        </div>
        <div>
          <FieldLabel required>Wafers</FieldLabel>
          {!experimentTypeId ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 8,
                border: `1px dashed ${line}`,
                background: bgSoft,
                color: muted,
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              Pick an experiment type to see eligible wafers.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: text2, marginBottom: 8 }}>
                {biggest ? (
                  <>
                    Max{' '}
                    <strong style={{ color: ink, fontFamily: 'var(--font-mono)' }}>
                      {maxBatch}
                    </strong>{' '}
                    wafers — largest capable equipment is{' '}
                    <strong style={{ color: ink, fontFamily: 'var(--font-mono)' }}>
                      {biggest.name}
                    </strong>{' '}
                    (capacity {maxBatch}).
                  </>
                ) : (
                  <span style={{ color: '#a93445' }}>
                    No equipment can run this experiment yet.
                  </span>
                )}
              </div>
              <div
                style={{
                  border: `1px solid ${line}`,
                  borderRadius: 8,
                  maxHeight: 240,
                  overflow: 'auto',
                }}
              >
                {eligibleSamples.length === 0 ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      color: muted,
                      fontSize: 13,
                      textAlign: 'center',
                    }}
                  >
                    No wafers found for this experiment type.
                  </div>
                ) : (
                  eligibleSamples.map((s) => {
                    const checked = selectedSampleIds.includes(s.id);
                    const blocked = !!s.blockReason;
                    const atCap = maxBatch > 0 && selectedSampleIds.length >= maxBatch && !checked;
                    const disabled = blocked || atCap || maxBatch === 0;
                    const reasonLabel =
                      s.blockReason === 'not_received'
                        ? 'Not yet received at lab'
                        : s.blockReason === 'request_not_ready'
                          ? 'Pending — waiting for other samples'
                          : null;
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '20px 1fr auto',
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderTop: `1px solid ${lineSoft}`,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          background: checked ? '#f7f6fb' : blocked ? '#fafafa' : '#fff',
                          opacity: blocked ? 0.55 : atCap ? 0.5 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleSample(s.id)}
                          style={{ accentColor: accent }}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 13,
                            fontWeight: 600,
                            color: blocked ? muted : ink,
                          }}
                        >
                          {s.wafer}
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 2,
                          }}
                        >
                          <span style={{ fontSize: 12, color: muted, whiteSpace: 'nowrap' }}>
                            {s.size} · Req #{String(s.requestId).padStart(4, '0')}
                          </span>
                          {reasonLabel && (
                            <span
                              style={{
                                fontSize: 11,
                                color: '#b45309',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {reasonLabel}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>
                {selectedSampleIds.length} / {maxBatch || '—'} selected
              </div>
            </>
          )}
        </div>
        <div>
          <FieldLabel>Note (optional)</FieldLabel>
          <TextArea
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            placeholder="Anything the operator should know."
          />
        </div>
      </div>
    </Modal>
  );
};
export default WipCreationModalInner;
export { WipCreationModalInner };
