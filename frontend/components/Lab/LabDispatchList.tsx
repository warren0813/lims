// @ts-nocheck
"use client";
import React from 'react';
import * as I from '@/components/ui/I';
import * as UI from '@/components/ui/UI';
import useLabDispatches from '@/components/Lab/useLabDispatches';
import Page from '@/components/Manager/Page';
import muted from '@/components/Lab/muted';
import line from '@/components/Lab/line';
import ink from '@/components/Lab/ink';
import text2 from '@/components/Lab/text2';
import Card from '@/components/Manager/Card';
import findExp from '@/components/Lab/findExp';
import Pill from '@/components/Manager/Pill';
import lineSoft from '@/components/Lab/lineSoft';
import accent from '@/components/Lab/accent';
const LF=I;
const LabDispatchList=({navigate,defaultTab='active'})=>{const{dispatches,loading,error}=useLabDispatches();const[tab,setTab]=React.useState(defaultTab);const groups={active:['dispatched','pending','running'],record:['unloaded','exception'],done:['completed','aborted'],all:null};const filtered=groups[tab]===null?dispatches:dispatches.filter(d=>groups[tab].includes(d.status));const[,setTick]=React.useState(0);const hasRunning=filtered.some(d=>d.status==='running');React.useEffect(()=>{if(!hasRunning)return;const h=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(h);},[hasRunning]);const tabs=[{id:'active',label:'Active'},{id:'record',label:'Needs Result'},{id:'done',label:'Closed'},{id:'all',label:'All'}];if(loading&&dispatches.length===0){return<Page title="Dispatches"subtitle="Loading…">
        <div style={{padding:'60px 20px',textAlign:'center',color:muted,fontSize:14}}>Loading…</div>
      </Page>;}return<Page title="Dispatches"subtitle="One experiment run on one piece of equipment, derived from a WIP">
      {error&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          Couldn't load dispatches: {error}
        </div>}
      <div style={{display:'flex',gap:4,marginBottom:14,borderBottom:`1px solid ${line}`}}>
        {tabs.map(t=>{const n=(groups[t.id]===null?dispatches:dispatches.filter(d=>groups[t.id].includes(d.status))).length;return<button key={t.id}onClick={()=>setTab(t.id)}style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px 14px',background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?ink:'transparent'}`,color:tab===t.id?ink:text2,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:-1}}>
              {t.label}
              <span style={{padding:'1px 7px',borderRadius:999,fontSize:11,fontWeight:700,background:tab===t.id?'#ecebf3':'#f1f1f5',color:tab===t.id?'#4f4a8f':muted}}>{n}</span>
            </button>;})}
      </div>

      <div style={{fontSize:13,color:muted,marginBottom:14}}>
        Showing <strong style={{color:ink}}>{filtered.length}</strong> of {dispatches.length} dispatch{dispatches.length===1?'':'es'}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.length===0?<Card padding={48}style={{textAlign:'center',color:muted}}>
            <LF.Activity size={32}color="#cbcbd6"style={{marginBottom:10}}/>
            <div style={{fontSize:14,fontWeight:600,color:text2}}>No dispatches</div>
          </Card>:filtered.map(d=>{let pct=0,remainLabel=null,showBar=false;const totalSec=d.estimatedDurationSeconds||0;if(d.status==='running'&&d.dispatchedAtIso&&totalSec>0){const startMs=new Date(d.dispatchedAtIso).getTime();const elapsedSec=Math.max(0,(Date.now()-startMs)/1000);pct=Math.min(100,elapsedSec/totalSec*100);const remainSec=Math.max(0,totalSec-elapsedSec);remainLabel=`${UI.formatDuration(Math.ceil(remainSec))} left`;showBar=true;}const expCode=findExp(d.experimentId)?.code||(d.experimentName?d.experimentName.split(/\s+/).map(t=>t[0]).join('').slice(0,4).toUpperCase():'—');return<button key={d.id}onClick={()=>navigate({page:'lab_dispatch_detail',id:d.id})}style={{display:'block',width:'100%',padding:'18px 22px',borderRadius:14,background:'#fff',border:'1px solid rgba(0,0,0,0.08)',textAlign:'left',cursor:'pointer',transition:'border-color 0.12s',fontFamily:'inherit'}}onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.18)';}}onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.08)';}}>
              <div style={{display:'grid',gridTemplateColumns:'100px minmax(0,1fr) 120px 120px 80px 130px 24px',alignItems:'center',gap:14}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:13.5,fontWeight:700,color:ink,letterSpacing:'0.02em'}}>{d.code}</span>
                <div style={{minWidth:0,display:'inline-flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:10.5,fontWeight:700,padding:'3px 8px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f',letterSpacing:'0.05em',flexShrink:0}}>{expCode}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:14.5,fontWeight:700,color:ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.experimentName||'—'}</div>
                    <div style={{fontSize:12,color:muted,marginTop:3,fontFamily:'var(--font-mono)'}}>{`WIP-${String(d.wipId).padStart(4,'0')}`}</div>
                  </div>
                </div>
                <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:text2,display:'inline-flex',alignItems:'center',gap:6}}>
                  <LF.User size={12}color={muted}/>
                  {d.operator||'—'}
                </span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:text2}}>{d.equipmentName||'—'}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:text2}}title="Estimated duration">{UI.formatDuration(d.estimatedDurationSeconds)}</span>
                <span><Pill kind={d.status}dotted={d.status==='running'}/></span>
                <LF.ChevronRight size={15}color="#cbcbd6"/>
              </div>
              {d.status==='running'&&d.dispatchedAt&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${lineSoft}`}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11.5,color:text2,fontWeight:600,marginBottom:6}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
                      <span style={{width:6,height:6,borderRadius:999,background:'#f4a8bf',animation:'pulse 1.4s ease-in-out infinite'}}/>
                      Running · dispatched <span style={{fontFamily:'var(--font-mono)',color:ink}}>{d.dispatchedAt.split(' ')[1]}</span>
                      <span style={{color:muted}}>·</span>
                      <span style={{color:muted}}>est. {UI.formatDuration(d.estimatedDurationSeconds)}</span>
                    </span>
                    <span style={{fontFamily:'var(--font-mono)',color:accent}}>{remainLabel||'—'}</span>
                  </div>
                  {showBar&&<div style={{position:'relative',height:6,background:'#f1eef9',borderRadius:999,overflow:'hidden'}}>
                      <div style={{position:'absolute',inset:0,width:`${pct}%`,background:'linear-gradient(90deg, #f4a8bf, #6c67b8)',borderRadius:999}}/>
                    </div>}
                </div>}
            </button>;})}
      </div>
    </Page>;};
export default LabDispatchList;
export { LabDispatchList };
