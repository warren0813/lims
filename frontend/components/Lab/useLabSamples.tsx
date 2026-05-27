// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useLabSamples=()=>{const[samples,setSamples]=React.useState([]);const[requestsById,setRequestsById]=React.useState(new Map());const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(!api||!api.samples){setLoading(false);return;}setLoading(true);Promise.all([api.samples.list(),api.requests.list().catch(()=>[])]).then(([ss,rs])=>{const visible=ss.filter(s=>s.raw_status!=='created');setSamples(visible);setRequestsById(new Map(rs.map(r=>[r.id,r])));setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[]);React.useEffect(()=>{refresh();},[refresh]);const wafers=samples.map(s=>({...s,urgency:requestsById.get(s.requestId)?.urgency||'1w'}));return{wafers,loading,error,refresh};};
export default useLabSamples;
export { useLabSamples };
