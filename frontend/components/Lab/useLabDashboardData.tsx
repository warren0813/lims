// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useLabDashboardData=()=>{const[samples,setSamples]=React.useState([]);const[wips,setWips]=React.useState([]);const[dispatches,setDispatches]=React.useState([]);const[equipment,setEquipment]=React.useState([]);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(!api){setLoading(false);return;}setLoading(true);Promise.all([api.samples.list(),api.wips.list(),api.dispatches.list(),api.equipment.list().catch(()=>[]),api.experimentTypes.list().catch(()=>[])]).then(([ss,ws,ds,eqs,exps])=>{setSamples(ss.filter(s=>s.raw_status!=='created'));setWips(ws);setEquipment(eqs);const expById=new Map(exps.map(e=>[e.id,e]));const eqById=new Map(eqs.map(e=>[e.id,e]));setDispatches(ds.map(d=>({...d,experimentName:expById.get(d.experimentId)?.name||null,equipmentName:eqById.get(d.equipmentId)?.name||null})));setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[]);React.useEffect(()=>{refresh();},[refresh]);return{samples,wips,dispatches,equipment,loading,error,refresh};};
export default useLabDashboardData;
export { useLabDashboardData };
