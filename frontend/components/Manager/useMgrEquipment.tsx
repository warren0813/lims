// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useMgrEquipment=()=>{const[data,setData]=React.useState([]);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(!api||!api.equipment){setLoading(false);return;}setLoading(true);api.equipment.list().then(es=>{setData(es);setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[]);React.useEffect(()=>{refresh();},[refresh]);return{data,loading,error,refresh};};
export default useMgrEquipment;
export { useMgrEquipment };
