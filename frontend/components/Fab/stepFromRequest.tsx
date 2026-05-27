// @ts-nocheck
"use client";


const stepFromRequest=r=>{if(r.status==='draft'||r.status==='cancelled'||r.status==='rejected'||r.status==='returned'){return{aborted:true,status:r.status};}const raw=r.rawStatus||r.status;if(raw==='submitted'||raw==='pending_approval'){return{idx:-1};}if(r.status==='completed'||raw==='completed'||raw==='closed')return{idx:3};const samples=r.samples||[];if(samples.length>0){const allDone=samples.every(s=>s.status==='completed');if(allDone)return{idx:3};const anyProcessing=samples.some(s=>s.status==='processing'||s.status==='in_wip'||s.status==='completed');if(anyProcessing)return{idx:2};const anyShipped=samples.some(s=>s.raw_status==='shipped'||s.status==='received'||s.raw_status==='received');if(anyShipped)return{idx:1};return{idx:0};}if(raw==='approved')return{idx:0};if(raw==='sample_shipped')return{idx:1};if(raw==='in_progress'||raw==='exception')return{idx:2};return{idx:0};};
export default stepFromRequest;
export { stepFromRequest };
