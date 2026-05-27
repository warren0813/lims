// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useDispatchCreationData=experimentId=>{const[equipment,setEquipment]=React.useState([]);const[recipes,setRecipes]=React.useState([]);const[loading,setLoading]=React.useState(true);const[error,setError]=React.useState(null);React.useEffect(()=>{if(experimentId==null||!api){setLoading(false);return;}setLoading(true);Promise.all([api.equipment.list(),api.recipes.list()]).then(([eqs,recs])=>{setEquipment(eqs.filter(e=>(e.capabilities||[]).some(c=>c.id===experimentId)));setRecipes(recs.filter(r=>r.experimentId===experimentId));setError(null);}).catch(err=>setError(err.message||String(err))).finally(()=>setLoading(false));},[experimentId]);return{equipment,recipes,loading,error};};
export default useDispatchCreationData;
export { useDispatchCreationData };
