// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useLabWipDetail=id=>{const[wip,setWip]=React.useState(null);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(id==null||!api||!api.wips){setLoading(false);return;}setLoading(true);api.wips.get(id).then(w=>{setWip(w);setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[id]);React.useEffect(()=>{refresh();},[refresh]);return{wip,loading,error,refresh};};
export default useLabWipDetail;
export { useLabWipDetail };
