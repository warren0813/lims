'use client';
import React from 'react';
import api from '@/lib/api';

type Equipment = Awaited<ReturnType<typeof api.equipment.list>>[number];
type Recipe = Awaited<ReturnType<typeof api.recipes.list>>[number];

const useDispatchCreationData = (experimentId: number | string | null | undefined) => {
  const [equipment, setEquipment] = React.useState<Equipment[]>([]);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (experimentId == null || !api) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const matchesExperiment = (e: Equipment) =>
      (e.capabilities || []).some((c: { id: number }) => c.id === experimentId);
    Promise.all([api.equipment.list(), api.recipes.list()])
      .then(([eqs, recs]) => {
        setEquipment(eqs.filter(matchesExperiment));
        setRecipes(recs.filter((r: Recipe) => r.experimentId === experimentId));
        setError(null);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [experimentId]);
  return { equipment, recipes, loading, error };
};
export default useDispatchCreationData;
export { useDispatchCreationData };
