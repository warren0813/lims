// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useMgrRecipes=()=>{const[data,setData]=React.useState([]);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);const refresh=React.useCallback(()=>{if(!api||!api.recipes){setLoading(false);return;}setLoading(true);api.recipes.list().then(rs=>{setData(rs);setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[]);React.useEffect(()=>{refresh();},[refresh]);return{data,loading,error,refresh};};
export default useMgrRecipes;
export { useMgrRecipes };
