// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import phaseIndexFor from '@/components/Fab/phaseIndexFor';
import WAFER_PHASES from '@/components/Fab/WAFER_PHASES';
import PhasePipeline from '@/components/Fab/PhasePipeline';
const F=I;
const InProgressRow=({request,navigate,open,onToggle})=>{const sampleCount=request.sampleCount??request.samples?.length??0;const[detail,setDetail]=React.useState(null);const[detailLoading,setDetailLoading]=React.useState(false);const[detailError,setDetailError]=React.useState(null);React.useEffect(()=>{if(!open||detail||detailLoading||!api?.requests)return;setDetailLoading(true);setDetailError(null);api.requests.get(request.id).then(d=>setDetail(d)).catch(e=>setDetailError(e.message||String(e))).finally(()=>setDetailLoading(false));},[open,detail,detailLoading,request.id]);const wafers=detail?.samples||[];const overallIdx=wafers.length?Math.min(...wafers.map(s=>phaseIndexFor(s,detail||request))):null;return<div style={{borderTop:'1px solid #f5f5f9'}}>
        <button onClick={onToggle}style={{width:'100%',textAlign:'left',display:'grid',gridTemplateColumns:'80px 1fr 130px 130px 24px',padding:'14px 24px',alignItems:'center',gap:16,background:'#fff',cursor:'pointer',transition:'background 0.1s',fontFamily:'inherit'}}onMouseEnter={e=>e.currentTarget.style.background='#fafafd'}onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
          <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-muted)'}}>#{request.id}</span>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600,color:'#6c67b8'}}>{request.title}</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
              Currently: <span style={{color:'var(--text-secondary)',fontWeight:600}}>
                {overallIdx==null?'—':overallIdx>=0?WAFER_PHASES[overallIdx]:'—'}
              </span>
            </div>
          </div>
          <span style={{fontSize:13.5,color:'var(--text-secondary)'}}>{sampleCount} wafer{sampleCount===1?'':'s'}</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:'var(--text-muted)'}}>{request.submitted?request.submitted.split(' ')[0]:'—'}</span>
          <F.ChevronDown size={15}color="#a8a8b8"style={{transform:open?'rotate(180deg)':'rotate(0)',transition:'transform 0.18s'}}/>
        </button>
        {open&&<div style={{padding:'4px 24px 22px',background:'#fafafd',borderTop:'1px solid #f1f1f5'}}>
            <div style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em',padding:'14px 0 12px'}}>Wafer Phases</div>
            {detailLoading&&<div style={{padding:'20px 0',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                Loading wafer phases…
              </div>}
            {detailError&&<div style={{padding:'10px 12px',borderRadius:8,background:'#fde4e4',color:'#c0394a',fontSize:13,fontWeight:500,border:'1px solid #f6c4c4'}}>{detailError}</div>}
            {!detailLoading&&!detailError&&wafers.length===0&&<div style={{padding:'12px 0',color:'var(--text-muted)',fontSize:13,fontStyle:'italic'}}>
                No wafers on this request.
              </div>}
            {wafers.length>0&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
                {wafers.map((w,i)=>{const idx=phaseIndexFor(w,detail||request);return<div key={w.id??i}style={{display:'grid',gridTemplateColumns:'160px 1fr',alignItems:'center',gap:18,padding:'12px 16px',background:'#fff',borderRadius:10,border:'1px solid rgba(0,0,0,0.06)'}}>
                      <div>
                        <div style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{w.wafer}</div>
                        <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>{w.size}</div>
                      </div>
                      <PhasePipeline idx={idx}/>
                    </div>;})}
              </div>}
            <div style={{marginTop:14,display:'flex',justifyContent:'flex-end'}}>
              <button onClick={e=>{e.stopPropagation();navigate({page:'fab_request',id:request.id});}}style={{fontSize:13,fontWeight:600,color:'#6c67b8',display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer'}}>Open request <F.ArrowRight size={13}/></button>
            </div>
          </div>}
      </div>;};
export default InProgressRow;
export { InProgressRow };
