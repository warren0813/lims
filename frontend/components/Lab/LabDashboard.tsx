// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import * as UI from '@/components/ui/UI';
import useLabDashboardData from '@/components/Lab/useLabDashboardData';
import Page from '@/components/Manager/Page';
import surface from '@/components/Lab/surface';
import line from '@/components/Lab/line';
import text2 from '@/components/Lab/text2';
import ink from '@/components/Lab/ink';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import muted from '@/components/Lab/muted';
import lineSoft from '@/components/Lab/lineSoft';
import Pill from '@/components/Manager/Pill';
import accent from '@/components/Lab/accent';
const LF=I;
const LabDashboard=({navigate})=>{const{samples:liveSamples,wips:liveWips,dispatches:liveDispatches,equipment:liveEquipment,loading:countsLoading,error:countsError}=useLabDashboardData();const[,setTick]=React.useState(0);const hasRunning=liveDispatches.some(d=>d.status==='running');React.useEffect(()=>{if(!hasRunning)return;const h=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(h);},[hasRunning]);const incoming=liveSamples.filter(s=>s.status==='incoming').length;const activeWips=liveWips.filter(w=>w.status==='in_progress').length;const runningDps=liveDispatches.filter(d=>d.status==='running').length;const needsRecord=liveDispatches.filter(d=>d.status==='unloaded'||d.status==='exception').length;const activeDispatches=liveDispatches.filter(d=>d.status==='running'||d.status==='pending'||d.status==='dispatched').slice(0,5);const toRecord=liveDispatches.filter(d=>d.status==='unloaded'||d.status==='exception');const liveEquipmentIds=new Set(liveDispatches.filter(d=>d.status==='running'||d.status==='pending'||d.status==='dispatched').map(d=>d.equipmentId));const cachedUser=api&&api.auth&&api.auth.cachedUser?api.auth.cachedUser():null;const subtitleName=cachedUser?.username||'lab_member';const subtitleDate=new Date().toISOString().slice(0,10);const initialLoad=countsLoading&&liveSamples.length===0&&liveWips.length===0&&liveDispatches.length===0;const v=n=>initialLoad?'—':n;const tiles=[{label:'Incoming wafers',value:v(incoming),onClick:()=>navigate({page:'lab_samples',tab:'incoming'}),icon:<LF.Inbox size={16}color="#a06618"/>,tint:'#fef4dd'},{label:'Active WIPs',value:v(activeWips),onClick:()=>navigate({page:'lab_wip'}),icon:<LF.WIP size={16}color="#4f4a8f"/>,tint:'#ecebf3'},{label:'Dispatches live',value:v(runningDps),onClick:()=>navigate({page:'lab_dispatches',tab:'active'}),icon:<LF.Activity size={16}color="#a93445"/>,tint:'#fbe4e6'},{label:'To record',value:v(needsRecord),onClick:()=>navigate({page:'lab_dispatches',tab:'record'}),icon:<LF.ClipboardList size={16}color="#2e6a47"/>,tint:'#e7f0e9'}];return<Page title="Dashboard"subtitle={`Welcome back, ${subtitleName} · ${subtitleDate}`}>
      {countsError&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          Couldn't load tile counts: {countsError}
        </div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:14,marginBottom:22}}>
        {tiles.map(t=><button key={t.label}onClick={t.onClick}style={{position:'relative',textAlign:'left',padding:'16px 18px',borderRadius:14,background:surface,border:`1px solid ${line}`,cursor:'pointer',fontFamily:'inherit',overflow:'hidden',transition:'transform 0.15s, border-color 0.15s, box-shadow 0.15s'}}onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(108,103,184,0.35)';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 10px 24px -14px rgba(108,103,184,0.35)';}}onMouseLeave={e=>{e.currentTarget.style.borderColor=line;e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <span style={{width:30,height:30,borderRadius:9,background:t.tint,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{t.icon}</span>
              <span style={{fontSize:12,color:text2,fontWeight:600}}>{t.label}</span>
            </div>
            <div style={{fontFamily:'var(--font-display)',fontSize:34,fontWeight:700,color:ink,letterSpacing:'-0.02em',lineHeight:1}}>{t.value}</div>
          </button>)}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 360px',gap:18,alignItems:'flex-start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <Card padding={0}>
            <CardHeader>
              <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <span style={{width:8,height:8,borderRadius:999,background:'#f4a8bf',boxShadow:'0 0 10px #f4a8bf',animation:'pulse 1.6s ease-in-out infinite'}}/>
                Now Running
              </span>
              <span style={{marginLeft:'auto',fontSize:11,color:muted,fontWeight:600}}>{activeDispatches.length} active</span>
            </CardHeader>
            <div>
              {activeDispatches.length===0&&<div style={{padding:'28px 22px',textAlign:'center',color:muted,fontSize:13}}>No active dispatches</div>}
              {activeDispatches.map(d=>{const totalSec=d.estimatedDurationSeconds||0;let pct=0,remainLabel=null;if(d.status==='running'&&d.dispatchedAtIso&&totalSec>0){const startMs=new Date(d.dispatchedAtIso).getTime();const elapsedSec=Math.max(0,(Date.now()-startMs)/1000);pct=Math.min(100,elapsedSec/totalSec*100);remainLabel=`${UI.formatDuration(Math.ceil(Math.max(0,totalSec-elapsedSec)))} left`;}return<button key={d.id}onClick={()=>navigate({page:'lab_dispatch_detail',id:d.id})}style={{display:'block',width:'100%',textAlign:'left',padding:'14px 22px',borderTop:`1px solid ${lineSoft}`,background:'#fff',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:12,marginBottom:8}}>
                      <div style={{minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:'var(--font-mono)',fontSize:11.5,color:muted,marginBottom:3}}>
                          <span>{d.code}</span>
                          <span style={{color:'#cdcdda'}}>·</span>
                          <span>{d.equipmentName||'—'}</span>
                          {totalSec>0&&<>
                            <span style={{color:'#cdcdda'}}>·</span>
                            <span>est. {UI.formatDuration(totalSec)}</span>
                          </>}
                        </div>
                        <div style={{fontSize:14,color:ink,fontWeight:600}}>{d.experimentName||'—'}</div>
                      </div>
                      <Pill kind={d.status}dotted={d.status==='running'}/>
                    </div>
                    {d.status==='running'&&totalSec>0&&<div>
                        <div style={{position:'relative',height:6,background:'#f1eef9',borderRadius:999,overflow:'hidden',marginBottom:4}}>
                          <div style={{position:'absolute',inset:0,width:`${pct}%`,background:'linear-gradient(90deg, #f4a8bf, #6c67b8)',borderRadius:999}}/>
                        </div>
                        <div style={{fontSize:11,color:accent,fontFamily:'var(--font-mono)'}}>{remainLabel}</div>
                      </div>}
                  </button>;})}
            </div>
          </Card>

          {toRecord.length>0&&<Card padding={0}style={{borderColor:'rgba(108,103,184,0.32)',boxShadow:'0 8px 28px -18px rgba(108,103,184,0.45)'}}>
              <CardHeader style={{background:'linear-gradient(90deg, rgba(244,168,191,0.12), rgba(187,183,232,0.12))',borderBottom:`1px solid ${lineSoft}`}}>
                <LF.ClipboardList size={13}color={accent}/>
                <span>Awaiting Your Result</span>
                <span style={{marginLeft:'auto',padding:'2px 8px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f',fontSize:11,fontWeight:700}}>{toRecord.length}</span>
              </CardHeader>
              {toRecord.map(d=><button key={d.id}onClick={()=>navigate({page:'lab_dispatch_detail',id:d.id})}style={{display:'grid',gridTemplateColumns:'90px 1fr 130px auto',alignItems:'center',gap:12,width:'100%',padding:'13px 22px',borderTop:`1px solid ${lineSoft}`,background:'#fff',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:text2}}>{d.code}</span>
                  <span style={{fontSize:13.5,color:ink,fontWeight:600}}>{d.experimentName||'—'}</span>
                  <Pill kind={d.status}/>
                  <span style={{fontSize:12,color:accent,fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
                    Record <LF.ArrowRight size={12}color={accent}/>
                  </span>
                </button>)}
            </Card>}
        </div>

        <Card padding={0}>
          <CardHeader>
            <LF.Equipment size={13}color={text2}/>
            <span>Equipment</span>
            <span style={{marginLeft:'auto',fontSize:11,color:muted,fontWeight:600}}>
              {liveEquipmentIds.size}/{liveEquipment.length} live
            </span>
          </CardHeader>
          <div>
            {liveEquipment.length===0&&<div style={{padding:'24px 20px',textAlign:'center',color:muted,fontSize:13}}>No equipment defined</div>}
            {liveEquipment.map(e=>{const isLive=liveEquipmentIds.has(e.id);return<button key={e.id}onClick={()=>navigate({page:'lab_equipment'})}style={{display:'block',width:'100%',textAlign:'left',padding:'14px 20px',borderTop:`1px solid ${lineSoft}`,background:'#fff',border:'none',cursor:'pointer',fontFamily:'inherit',transition:'background 0.15s'}}onMouseEnter={ev=>ev.currentTarget.style.background='#faf9fc'}onMouseLeave={ev=>ev.currentTarget.style.background='#fff'}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:4}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,fontWeight:700,color:ink}}>{e.name}</span>
                    <Pill kind={e.status}dotted={isLive}/>
                  </div>
                  <div style={{fontSize:11.5,color:muted}}>
                    {isLive?`Running · cap ${e.capacity}`:e.status==='maintenance'?'Under maintenance':`Idle · cap ${e.capacity}`}
                  </div>
                </button>;})}
          </div>
        </Card>
      </div>
    </Page>;};
export default LabDashboard;
export { LabDashboard };
