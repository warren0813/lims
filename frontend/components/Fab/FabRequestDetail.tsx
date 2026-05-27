// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import useRequestDetail from '@/components/Fab/useRequestDetail';
import useExperimentTypes from '@/components/Fab/useExperimentTypes';
import useSampleExperimentsForRequest from '@/components/Fab/useSampleExperimentsForRequest';
import FabPage from '@/components/Fab/FabPage';
import phaseIndexFor from '@/components/Fab/phaseIndexFor';
import StatusPill from '@/components/Fab/StatusPill';
import UrgencyPill from '@/components/Fab/UrgencyPill';
import WAFER_PHASES from '@/components/Fab/WAFER_PHASES';
import FabCard from '@/components/Fab/FabCard';
import PlainCardHeader from '@/components/Fab/PlainCardHeader';
import HistoryDot from '@/components/Fab/HistoryDot';
import DetailWaferRow from '@/components/Fab/DetailWaferRow';
import CancelRequestModal from '@/components/Fab/CancelRequestModal';
const F=I;
const FabRequestDetail=({id,navigate,showToast})=>{const{data:r,loading,error,refresh}=useRequestDetail(id);const{data:liveTypes}=useExperimentTypes();const{byId:expsBySample}=useSampleExperimentsForRequest(r?.samples);const[cancelOpen,setCancelOpen]=React.useState(false);const[shipBusy,setShipBusy]=React.useState(false);const onShip=async()=>{if(!r)return;if(!window.confirm('Ship all wafers for this request to the lab?'))return;setShipBusy(true);try{await api.requests.ship(r.id);showToast&&showToast('Wafers shipped');refresh();}catch(e){showToast&&showToast(`Ship failed: ${e.message||e}`);}finally{setShipBusy(false);}};if(loading&&!r){return<FabPage title="Loading request…">
          <div style={{padding:'60px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:14}}>
            Loading…
          </div>
        </FabPage>;}if(error||!r){return<FabPage breadcrumb={<button onClick={()=>navigate({page:'fab_requests'})}style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:13,fontWeight:600,color:'#6c67b8',marginBottom:14,cursor:'pointer'}}><F.ChevronLeft size={14}/> My Requests</button>}title="Request not found">
          <div style={{padding:'24px',color:'#c0394a',fontSize:14}}>
            {error||'This request is no longer available.'}
          </div>
        </FabPage>;}const labCategoryById=new Map(liveTypes.map(t=>[t.id,t.labCategory]));const exps=(r.experiment_types||[]).map(et=>({id:et.id,name:et.name,group:labCategoryById.get(et.id)||''}));const canCancel=r.status==='in_progress'||r.status==='submitted';const overallIdx=r.samples.length?Math.min(...r.samples.map(s=>phaseIndexFor(s,r))):0;const completedAt=r.status==='completed'&&r.history.length?r.history[r.history.length-1].at.split(' ')[0]:null;const stateMap={in_progress:'In Progress',returned:'Returned',rejected:'Rejected',cancelled:'Cancelled',draft:'Draft',submitted:'Submitted'};const metrics=[{label:'Wafers',value:r.samples.length},{label:'Experiments',value:exps.length},{label:'Submitted',value:r.submitted?r.submitted.split(' ')[0]:'—'},{label:'Completed',value:completedAt||stateMap[r.status]||'—'}];return<FabPage breadcrumb={<button onClick={()=>navigate({page:'fab_requests'})}style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:13,fontWeight:600,color:'#6c67b8',marginBottom:14,cursor:'pointer'}}><F.ChevronLeft size={14}/> My Requests</button>}title={r.title}subtitle={<span style={{display:'inline-flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:'var(--text-muted)',letterSpacing:'0.04em',padding:'3px 9px',borderRadius:6,background:'#ebebf0'}}>#{String(r.id).padStart(4,'0')}</span>
            <StatusPill status={r.status}size="md"/>
            <UrgencyPill urgency={r.urgency}size="md"/>
            {r.status!=='draft'&&r.status!=='cancelled'&&r.status!=='submitted'&&overallIdx>=0&&<span style={{fontSize:13,color:'var(--text-secondary)'}}>
                Currently at <strong style={{color:'var(--text-primary)'}}>{WAFER_PHASES[overallIdx]}</strong>
              </span>}
          </span>}right={<span style={{display:'inline-flex',alignItems:'center',gap:10}}>
            {r.rawStatus==='approved'&&<button onClick={onShip}disabled={shipBusy}style={{padding:'9px 15px',borderRadius:8,background:shipBusy?'#cbcbd6':'#6c67b8',color:'#fff',fontWeight:600,fontSize:13,cursor:shipBusy?'not-allowed':'pointer',border:'none',display:'inline-flex',alignItems:'center',gap:6,fontFamily:'inherit'}}><F.Package size={14}strokeWidth={2.5}/> {shipBusy?'Shipping…':'Ship Wafers'}</button>}
            {canCancel&&<button onClick={()=>setCancelOpen(true)}style={{padding:'9px 15px',borderRadius:8,background:'#fff',color:'#c0394a',fontWeight:600,fontSize:13,cursor:'pointer',border:'1px solid #f4c8c8',display:'inline-flex',alignItems:'center',gap:6,fontFamily:'inherit'}}><F.X size={14}strokeWidth={2.5}/> Cancel Request</button>}
          </span>}>
        {}
        <FabCard padding={0}style={{marginBottom:18}}>
          <PlainCardHeader>Overview</PlainCardHeader>
          <div style={{padding:'22px 24px',display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:18,borderBottom:r.history.length>0||r.note?'1px solid rgba(0,0,0,0.06)':'none'}}>
            {metrics.map(s=><div key={s.label}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{s.label}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:24,fontWeight:700,marginTop:6,letterSpacing:'-0.01em',color:'var(--text-primary)'}}>{s.value}</div>
              </div>)}
          </div>

          {r.note&&<div style={{padding:'16px 24px',borderBottom:r.history.length>0?'1px solid rgba(0,0,0,0.06)':'none'}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Note</div>
              <div style={{fontSize:14,lineHeight:1.55,color:'var(--text-primary)'}}>{r.note}</div>
            </div>}

          {r.history.length>0&&<>
              <PlainCardHeader>Approval History</PlainCardHeader>
              <div style={{padding:'18px 24px',display:'flex',flexDirection:'column',gap:14}}>
                {r.history.map((h,i)=>{const c=HistoryDot({action:h.action});return<div key={i}style={{display:'grid',gridTemplateColumns:'24px 1fr auto',gap:14,alignItems:'flex-start'}}>
                      <span style={{width:18,height:18,borderRadius:999,background:'#fff',border:`3px solid ${c.dot}`,marginTop:2}}/>
                      <div style={{minWidth:0}}>
                        <div style={{display:'inline-flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,background:c.bg,color:c.fg,letterSpacing:'0.04em'}}>{h.action}</span>
                          <span style={{fontSize:13.5,color:'var(--text-secondary)'}}>
                            by <strong style={{color:'var(--text-primary)',fontFamily:'var(--font-mono)'}}>{h.by}</strong>
                          </span>
                        </div>
                        {h.note&&<div style={{fontSize:13,color:'var(--text-secondary)',marginTop:6,padding:'8px 10px',background:'#f8f8fb',borderRadius:6}}>{h.note}</div>}
                      </div>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{h.at}</span>
                    </div>;})}
              </div>
            </>}
        </FabCard>

        {}
        <FabCard padding={0}style={{marginBottom:18}}>
          <PlainCardHeader right={<span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-muted)'}}>{r.samples.length} wafer{r.samples.length===1?'':'s'}</span>}>
            <F.Layers size={13}color="var(--text-secondary)"/>
            Wafer Phases
          </PlainCardHeader>
          <div style={{padding:18,display:'flex',flexDirection:'column',gap:12,background:'#fafafd'}}>
            {r.samples.map((s,i)=><DetailWaferRow key={i}wafer={s}request={r}/>)}
          </div>
        </FabCard>

        {}
        <FabCard padding={0}>
          <PlainCardHeader right={<span style={{display:'inline-flex',alignItems:'center',gap:14,fontSize:11.5,fontWeight:600,color:'var(--text-muted)'}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                <span style={{width:9,height:9,borderRadius:999,background:'#157a4a'}}/>Pass
              </span>
              <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                <span style={{width:9,height:9,borderRadius:999,background:'#a93445'}}/>Fail
              </span>
              <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                <span style={{width:9,height:9,borderRadius:999,background:'transparent',border:'1.5px dashed #cbcbd6'}}/>Pending
              </span>
            </span>}>
            <F.ClipboardList size={13}color="var(--text-secondary)"/>
            Experiments by Wafer
          </PlainCardHeader>
          <div style={{padding:18,display:'flex',flexDirection:'column',gap:12,background:'#fafafd'}}>
            {r.samples.map((s,si)=>{const rollup=expsBySample[s.id]||[];const rollupByExpId=new Map(rollup.map(row=>[row.experimentTypeId,row]));const total=exps.length;const doneCount=exps.filter(e=>rollupByExpId.get(e.id)?.status==='done').length;return<div key={si}style={{background:'#fff',borderRadius:12,border:'1px solid rgba(0,0,0,0.07)',overflow:'hidden'}}>
                  <div style={{display:'grid',gridTemplateColumns:'200px 1fr 80px',alignItems:'center',gap:18,padding:'14px 18px'}}>
                    <div>
                      <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
                        <F.Wafer size={15}color="#6c67b8"/>
                        <span style={{fontFamily:'var(--font-mono)',fontSize:13.5,fontWeight:700,color:'var(--text-primary)'}}>{s.wafer}</span>
                      </div>
                      <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:4,marginLeft:23}}>{s.size}</div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {exps.map(e=>{const row=rollupByExpId.get(e.id);const st=row?.status||'pending';const v=row?.verdict||null;const done=st==='done';const pass=done&&v==='pass';const fail=done&&v==='fail';return<span key={e.id}style={{display:'inline-flex',alignItems:'center',gap:7,padding:'6px 12px 6px 7px',borderRadius:999,background:fail?'#fde4e4':done?'#e7f6ec':'#f4f4f7',border:`1px solid ${fail?'#f4b4b9':done?'#9ad9b7':'rgba(0,0,0,0.08)'}`}}>
                            <span style={{fontSize:10,fontWeight:700,padding:'3px 7px',borderRadius:999,background:fail?'#a93445':done?'#157a4a':'#cbcbd6',color:'#fff',letterSpacing:'0.05em'}}>{e.group}</span>
                            <span style={{fontSize:13,fontWeight:500,color:fail?'#5a1a22':done?'#1f3d2c':'#a8a8b8'}}>{e.name}</span>
                            {fail?<F.X size={13}color="#a93445"strokeWidth={3}/>:done?<F.Check size={13}color="#157a4a"strokeWidth={3}/>:<span style={{width:13,height:13,borderRadius:999,border:'1.5px dashed #cbcbd6'}}/>}
                          </span>;})}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:doneCount===total&&total>0?'#157a4a':'#1e1e24',letterSpacing:'-0.01em'}}>
                        {doneCount}<span style={{color:'#a8a8b8',fontWeight:500}}>/{total}</span>
                      </div>
                      <div style={{fontSize:10.5,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>done</div>
                    </div>
                  </div>
                </div>;})}
          </div>
        </FabCard>

        {cancelOpen&&<CancelRequestModal requestId={r.id}onClose={()=>setCancelOpen(false)}onCancelled={()=>{setCancelOpen(false);refresh();}}showToast={showToast}/>}
      </FabPage>;};
export default FabRequestDetail;
export { FabRequestDetail };
