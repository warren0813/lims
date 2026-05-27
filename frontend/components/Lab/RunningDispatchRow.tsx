// @ts-nocheck
"use client";
import React from 'react';
import findExp from '@/components/Lab/findExp';
import lineSoft from '@/components/Lab/lineSoft';
import muted from '@/components/Lab/muted';
import ink from '@/components/Lab/ink';
import Pill from '@/components/Manager/Pill';

const RunningDispatchRow=({d,wip,navigate})=>{const exp=findExp(d.experimentId);const isRunning=d.status==='running';const pct=React.useMemo(()=>{if(!d.startedAt)return 0;const start=new Date(d.startedAt.replace(' ','T')).getTime();const elapsed=Date.now()-start;return Math.max(8,Math.min(94,elapsed/(1000*60*60*24)*100));},[d.startedAt]);return<button onClick={()=>navigate({page:'lab_dispatch_detail',id:d.id})}style={{display:'block',width:'100%',textAlign:'left',padding:'16px 22px',borderTop:`1px solid ${lineSoft}`,background:'#fff',border:'none',cursor:'pointer',fontFamily:'inherit',transition:'background 0.15s'}}onMouseEnter={e=>e.currentTarget.style.background='#faf9fc'}onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:12,marginBottom:10}}>
        <div style={{minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:'var(--font-mono)',fontSize:11.5,color:muted,marginBottom:3}}>
            <span>{d.id}</span>
            <span style={{color:'#cdcdda'}}>·</span>
            <span>{d.equipmentId||wip?.equipmentId||'—'}</span>
            <span style={{color:'#cdcdda'}}>·</span>
            <span>{wip?.waferIds.length} wafer{wip?.waferIds.length===1?'':'s'}</span>
          </div>
          <div style={{fontSize:14.5,color:ink,fontWeight:600}}>{exp?.name}</div>
        </div>
        <Pill kind={d.status}dotted/>
      </div>
      {isRunning&&<div style={{position:'relative',height:6,background:'#f1eef9',borderRadius:999,overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,width:`${pct}%`,background:'linear-gradient(90deg, #f4a8bf, #6c67b8)',borderRadius:999}}/>
          <div style={{position:'absolute',top:-2,left:`calc(${pct}% - 5px)`,width:10,height:10,borderRadius:999,background:'#fff',border:'2px solid #6c67b8',boxShadow:'0 0 0 0 rgba(108,103,184,0.4)',animation:'ringpulse 1.8s ease-out infinite'}}/>
        </div>}
    </button>;};
export default RunningDispatchRow;
export { RunningDispatchRow };
