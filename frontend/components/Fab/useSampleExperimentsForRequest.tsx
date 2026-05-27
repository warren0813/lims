// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';

const useSampleExperimentsForRequest=samples=>{const[byId,setById]=React.useState({});const[loading,setLoading]=React.useState(false);const ids=(samples||[]).map(s=>s.id).filter(v=>v!=null);const key=ids.join(',');React.useEffect(()=>{if(!api||!api.samples||ids.length===0){setById({});return;}let cancelled=false;setLoading(true);Promise.all(ids.map(sid=>api.samples.getExperiments(sid).then(rows=>[sid,rows]).catch(()=>[sid,[]]))).then(pairs=>{if(cancelled)return;const next={};pairs.forEach(([sid,rows])=>{next[sid]=rows;});setById(next);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[key]);return{byId,loading};};
export default useSampleExperimentsForRequest;
export { useSampleExperimentsForRequest };
