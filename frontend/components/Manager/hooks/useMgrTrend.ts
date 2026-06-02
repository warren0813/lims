'use client';
import React from 'react';
import api from '@/lib/api';

type TrendPoint = { date: string; count: number; utilization_pct?: number | null };
type TrendData = { metric: string; days: number; points: TrendPoint[] };

const useMgrTrend = (metric = 'requests_per_day', days = 30) => {
  const [data, setData] = React.useState<TrendData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    if (!api || !api.reports) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.reports
      .trends({ metric, days })
      .then((d) => {
        setData(d as TrendData);
        setError(null);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [metric, days]);
  return { data, loading, error };
};
export default useMgrTrend;
export { useMgrTrend };
