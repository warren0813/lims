'use client';
import React from 'react';
import api from '@/lib/api';
import useDispatchCreationData from '@/components/Lab/hooks/useDispatchCreationData';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import { line } from '@/lib/colors';
import { text2 } from '@/lib/colors';
import { ink } from '@/lib/colors';
import { muted } from '@/lib/colors';
import FieldLabel from '@/components/Manager/FieldLabel';
import SelectInput from '@/components/Manager/SelectInput';
import { lineSoft } from '@/lib/colors';
import TextArea from '@/components/Manager/TextArea';

type WipShape = { id: number; experimentId: number; experimentName?: string; sampleCount: number };
const AddDispatchModalInner = ({
  onClose,
  wip,
  onCreated,
}: {
  onClose: () => void;
  wip: WipShape;
  onCreated?: () => void;
}) => {
  const {
    equipment,
    recipes,
    loading,
    error: loadError,
  } = useDispatchCreationData(wip.experimentId);
  const [equipmentId, setEquipmentId] = React.useState<string | number>('');
  const [recipeId, setRecipeId] = React.useState<string | number>('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [submitErr, setSubmitErr] = React.useState(null);
  const selectedRecipe = recipes.find((r) => r.id === recipeId);
  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const wipCode = `WIP-${String(wip.id).padStart(4, '0')}`;
  const valid = equipmentId !== '' && recipeId !== '' && !loading;
  const submit = async () => {
    setBusy(true);
    setSubmitErr(null);
    try {
      await api.wips.createDispatch(wip.id, {
        equipmentId,
        recipeId,
        note: note.trim(),
      });
      onCreated?.();
    } catch (e) {
      setSubmitErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const eqStatusChip = (e: { status: string }) => {
    if (e.status === 'maintenance') {
      return (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 999,
            background: '#fbe4e6',
            color: '#a93445',
            marginLeft: 6,
          }}
        >
          maint
        </span>
      );
    }
    return null;
  };
  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Add Dispatch"
      width={680}
      footer={
        <>
          <SecondaryBtn onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn disabled={!valid || busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create Dispatch'}
          </PrimaryBtn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 14px',
            borderRadius: 10,
            background: '#f7f6fb',
            border: `1px solid ${line}`,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: '#ecebf3',
              color: '#4f4a8f',
            }}
          >
            {wipCode}
          </span>
          <span style={{ fontSize: 13, color: text2 }}>
            <strong style={{ color: ink, fontFamily: 'var(--font-mono)' }}>
              {wip.sampleCount}
            </strong>{' '}
            sample{wip.sampleCount === 1 ? '' : 's'}
          </span>
          <span style={{ color: muted }}>·</span>
          <span style={{ fontSize: 13, color: ink, fontWeight: 600 }}>
            {wip.experimentName || '—'}
          </span>
        </div>

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
          <div style={{ padding: '12px', textAlign: 'center', color: muted, fontSize: 13 }}>
            Loading equipment + recipes…
          </div>
        )}

        <div>
          <FieldLabel required>Equipment</FieldLabel>
          <SelectInput
            value={equipmentId === '' ? '' : String(equipmentId)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setEquipmentId(e.target.value ? Number(e.target.value) : '')
            }
          >
            <option value="">— pick equipment —</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.model || '—'}
                {e.status === 'maintenance' ? ' (maintenance)' : ''}
              </option>
            ))}
          </SelectInput>
          {selectedEquipment && eqStatusChip(selectedEquipment) && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#a93445' }}>
              {selectedEquipment.name} is currently in maintenance — submission still allowed, but a
              tech check is advised.
            </div>
          )}
          {!loading && equipment.length === 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#a93445' }}>
              No equipment capable of running this experiment.
            </div>
          )}
        </div>

        <div>
          <FieldLabel required>Recipe</FieldLabel>
          <SelectInput
            value={recipeId === '' ? '' : String(recipeId)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setRecipeId(e.target.value ? Number(e.target.value) : '')
            }
          >
            <option value="">— pick a recipe —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectInput>
          {!loading && recipes.length === 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#a93445' }}>
              No recipes for this experiment yet.
            </div>
          )}
        </div>

        {selectedRecipe && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${line}`,
              background: '#fbfbfd',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: text2,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Recipe Parameters
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: muted }}>
                {selectedRecipe.name}
              </span>
            </div>
            {Object.entries(selectedRecipe.params || {}).length === 0 ? (
              <div style={{ fontSize: 12.5, color: muted, fontStyle: 'italic' }}>
                No parameters.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 10,
                }}
              >
                {Object.entries(selectedRecipe.params).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      padding: '8px 10px',
                      background: '#fff',
                      border: `1px solid ${lineSoft}`,
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        color: muted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontWeight: 600,
                      }}
                    >
                      {k.replace(/_/g, ' ')}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        fontWeight: 700,
                        color: ink,
                        marginTop: 3,
                      }}
                    >
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
export default AddDispatchModalInner;
export { AddDispatchModalInner };
