// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useLabWips=()=>{const[wips,setWips]=React.useState([]);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(!api||!api.wips){setLoading(false);return;}setLoading(true);api.wips.list().then(ws=>{setWips(ws);setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[]);React.useEffect(()=>{refresh();},[refresh]);return{wips,loading,error,refresh};};
export default useLabWips;
export { useLabWips };
