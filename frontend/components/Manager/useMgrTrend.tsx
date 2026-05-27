// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useMgrTrend=(metric='requests_per_day',days=30)=>{const[data,setData]=React.useState(null);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);React.useEffect(()=>{if(!api||!api.reports){setLoading(false);return;}setLoading(true);api.reports.trends({metric,days}).then(d=>{setData(d);setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[metric,days]);return{data,loading,error};};
export default useMgrTrend;
export { useMgrTrend };
