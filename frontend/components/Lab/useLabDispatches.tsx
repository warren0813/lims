// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useLabDispatches=()=>{const[dispatches,setDispatches]=React.useState([]);const[expById,setExpById]=React.useState(new Map());const[eqById,setEqById]=React.useState(new Map());const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(!api){setLoading(false);return;}setLoading(true);Promise.all([api.dispatches.list(),api.experimentTypes.list().catch(()=>[]),api.equipment.list().catch(()=>[])]).then(([ds,exps,eqs])=>{setDispatches(ds);setExpById(new Map(exps.map(e=>[e.id,e])));setEqById(new Map(eqs.map(e=>[e.id,e])));setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[]);React.useEffect(()=>{refresh();},[refresh]);const enriched=dispatches.map(d=>({...d,experimentName:expById.get(d.experimentId)?.name||null,equipmentName:eqById.get(d.equipmentId)?.name||null}));return{dispatches:enriched,loading,error,refresh};};
export default useLabDispatches;
export { useLabDispatches };
