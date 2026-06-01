'use client';
import React from 'react';
import api from '@/lib/api';

type Sample = Awaited<ReturnType<typeof api.samples.list>>[number];
type Request = Awaited<ReturnType<typeof api.requests.get>>;
type RequestSample = NonNullable<Request['samples']>[number];

const useWipCreationData = () => {
  const [experimentTypes, setExperimentTypes] = React.useState([]);
  const [pickerSamples, setPickerSamples] = React.useState([]);
  const [equipment, setEquipment] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    if (!api) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([api.experimentTypes.list(), api.samples.list(), api.equipment.list()])
      .then(async ([exps, allSamples, equip]) => {
        const eligible = allSamples.filter(
          (s: Sample) =>
            (s.raw_status === 'received' || s.raw_status === 'processing') && !s.hasWip,
        );
        const reqIds = Array.from(new Set(eligible.map((s: Sample) => s.requestId)));
        const reqDetails = await Promise.all(
          reqIds.map((id) => api.requests.get(id).catch((): Request | null => null)),
        );
        const readyReqIds = new Set(
          reqDetails.filter((r) => r && r.rawStatus === 'in_progress').map((r) => r.id),
        );
        const sampleExpMap = new Map<number, number[]>();
        reqDetails.forEach((r) => {
          if (!r) return;
          (r.samples || []).forEach((s: RequestSample) => {
            sampleExpMap.set(s.id, s.expIds?.length ? s.expIds : r.expIds || []);
          });
        });
        const eligibleIds = new Set(eligible.map((s: Sample) => s.id));
        const combined = eligible.map((s: Sample) => ({
          ...s,
          expIds: sampleExpMap.get(s.id) || [],
          blockReason: readyReqIds.has(s.requestId) ? null : 'request_not_ready',
        }));
        reqDetails.forEach((req) => {
          if (!req) return;
          (req.samples || []).forEach((s: RequestSample) => {
            if (eligibleIds.has(s.id)) return;
            combined.push({
              id: s.id,
              wafer: s.wafer,
              size: s.size,
              requestId: req.id,
              raw_status: s.raw_status,
              status: s.status,
              hasWip: false,
              expIds: sampleExpMap.get(s.id) || [],
              blockReason: 'not_received',
            });
          });
        });
        setExperimentTypes(exps);
        setPickerSamples(combined);
        setEquipment(equip);
        setError(null);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);
  return { experimentTypes, pickerSamples, equipment, loading, error };
};
export default useWipCreationData;
export { useWipCreationData };
