'use client';
import React from 'react';
import api from '@/lib/api';

type Dispatch = Awaited<ReturnType<typeof api.dispatches.get>>;
type WipDetail = Awaited<ReturnType<typeof api.wips.get>>;
type SampleBrief = WipDetail['samples'][number];
type SampleExperiment = Awaited<ReturnType<typeof api.samples.getExperiments>>[number];

type WaferResult = {
  sampleId: number;
  wafer: string;
  size: string;
  verdict: string | null;
  status: string | null;
};
type Recipe = Awaited<ReturnType<typeof api.recipes.list>>[number];

const fetchSampleRollup = (s: SampleBrief) =>
  api.samples
    .getExperiments(s.id)
    .then((rows: SampleExperiment[]) => ({ sample: s, rows }))
    .catch((): { sample: SampleBrief; rows: SampleExperiment[] } => ({ sample: s, rows: [] }));

const toWaferResult = (
  { sample, rows }: { sample: SampleBrief; rows: SampleExperiment[] },
  dispatchId: number,
): WaferResult => {
  const match = rows.find((r: SampleExperiment) => r.dispatchId === dispatchId);
  return {
    sampleId: sample.id,
    wafer: sample.wafer,
    size: sample.size,
    verdict: match?.verdict ?? null,
    status: match?.status ?? null,
  };
};

const useLabDispatchDetail = (id: number | string | null | undefined) => {
  const [d, setD] = React.useState<Dispatch | null>(null);
  const [recipeById, setRecipeById] = React.useState<Map<number | string, Recipe>>(new Map());
  const [waferResults, setWaferResults] = React.useState<WaferResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(() => {
    if (id == null || !api || !api.dispatches) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const [dp, rs] = await Promise.all([
          api.dispatches.get(id),
          api.recipes.list().catch((): Awaited<ReturnType<typeof api.recipes.list>> => []),
        ]);
        if (cancelled) return;
        setD(dp);
        setRecipeById(new Map(rs.map((r: Recipe) => [r.id, r])));
        const wip = await api.wips.get(dp.wipId).catch((): WipDetail | null => null);
        if (cancelled) return;
        const samples: SampleBrief[] = wip?.samples || [];
        const rollups = await Promise.all(samples.map(fetchSampleRollup));
        if (cancelled) return;
        const wafers = rollups.map((r) => toWaferResult(r, dp.id));
        setWaferResults(wafers);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
  React.useEffect(() => {
    const cleanup = refresh();
    return cleanup;
  }, [refresh]);
  const dispatch = d ? { ...d, recipeParams: recipeById.get(d.recipeId)?.params || null } : null;
  return { dispatch, waferResults, loading, error, refresh };
};
export default useLabDispatchDetail;
export { useLabDispatchDetail };
