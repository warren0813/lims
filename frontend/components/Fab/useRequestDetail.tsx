// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useRequestDetail=id=>{const[data,setData]=React.useState(null);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(id==null||!api||!api.requests){setLoading(false);return;}setLoading(true);api.requests.get(id).then(r=>{setData(r);setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[id]);React.useEffect(()=>{refresh();},[refresh]);return{data,loading,error,refresh};};
export default useRequestDetail;
export { useRequestDetail };
