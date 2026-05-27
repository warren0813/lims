// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useLabExperimentTypes=()=>{const[data,setData]=React.useState([]);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);React.useEffect(()=>{if(!api||!api.experimentTypes){setLoading(false);return;}api.experimentTypes.list().then(rs=>{setData(rs);setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[]);return{data,loading,error};};
export default useLabExperimentTypes;
export { useLabExperimentTypes };
