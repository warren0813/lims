// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useWaferDetail=id=>{const[data,setData]=React.useState(null);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(id==null||!api){setLoading(false);return;}setLoading(true);setError(null);let cancelled=false;(async()=>{try{const sample=await api.samples.get(id);if(cancelled)return;const[request,experiments]=await Promise.all([api.requests.get(sample.requestId).catch(()=>null),api.samples.getExperiments(sample.id).catch(()=>[])]);let wip=null;if(sample.hasWip){const wipList=await api.wips.list({status:'in_progress'}).catch(()=>[]);for(const row of wipList){if(cancelled)return;const detail=await api.wips.get(row.id).catch(()=>null);if(detail?.samples?.some(s=>s.id===sample.id)){wip=detail;break;}}}if(cancelled)return;setData({sample,request,wip,experiments});}catch(e){if(!cancelled)setError(e.message||String(e));}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[id]);React.useEffect(()=>{const cleanup=refresh();return cleanup;},[refresh]);return{data,loading,error,refresh};};
export default useWaferDetail;
export { useWaferDetail };
