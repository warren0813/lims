// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import * as UI from '@/components/ui/UI';
import useLabDispatchDetail from '@/components/Lab/useLabDispatchDetail';
import Page from '@/components/Manager/Page';
import muted from '@/components/Lab/muted';
import Breadcrumb from '@/components/Manager/Breadcrumb';
import STATUS_FLOW from '@/components/Lab/STATUS_FLOW';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import Pill from '@/components/Manager/Pill';
import text2 from '@/components/Lab/text2';
import ink from '@/components/Lab/ink';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import accent from '@/components/Lab/accent';
import PILL from '@/components/Lab/PILL';
import lineSoft from '@/components/Lab/lineSoft';
import bgSoft from '@/components/Lab/bgSoft';
import RecordResultModal from '@/components/Lab/RecordResultModal';
import Modal from '@/components/Manager/Modal';
import TextArea from '@/components/Manager/TextArea';
const LF=I;
const LabDispatchDetail=({id,navigate,showToast})=>{const{dispatch:d,waferResults,loading,error,refresh}=useLabDispatchDetail(id);const[,setTick]=React.useState(0);React.useEffect(()=>{if(d?.status!=='running')return;const h=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(h);},[d?.status]);const[recordOpen,setRecordOpen]=React.useState(false);const[exceptionOpen,setExceptionOpen]=React.useState(false);const[exceptionNote,setExceptionNote]=React.useState('');const[busy,setBusy]=React.useState(false);const[actionError,setActionError]=React.useState(null);const runAction=async(op,label)=>{setBusy(true);setActionError(null);try{await op();showToast&&showToast(label);refresh();}catch(e){setActionError(e.message||String(e));}finally{setBusy(false);}};const confirmThen=(msg,op,label)=>{if(!window.confirm(msg))return;return runAction(op,label);};if(loading&&!d){return<Page title="Loading dispatch…">
        <div style={{padding:'60px 20px',textAlign:'center',color:muted,fontSize:14}}>Loading…</div>
      </Page>;}if(error||!d){return<Page breadcrumb={<Breadcrumb items={[{label:'Dispatches',onClick:()=>navigate({page:'lab_dispatches'})},{label:'?'}]}/>}title="Dispatch not found">
        <div style={{padding:24,color:'#c0394a',fontSize:14}}>
          {error||'This dispatch is no longer available.'}
        </div>
      </Page>;}const isFailed=d.status==='aborted'||d.status==='exception';const isDone=d.status==='completed';const stepIdx=isDone?STATUS_FLOW.length-1:STATUS_FLOW.indexOf(d.status);let actions=null;if(d.status==='dispatched'||d.status==='pending')actions=<>
    <SecondaryBtn danger disabled={busy}onClick={()=>confirmThen(`Abort ${d.code}?`,()=>api.dispatches.abort(d.id),`${d.code} aborted`)}>Abort</SecondaryBtn>
    <PrimaryBtn icon={<LF.Play size={14}/>}success disabled={busy}onClick={()=>confirmThen(`Start ${d.code}?`,()=>api.dispatches.start(d.id),`${d.code} started`)}>{busy?'…':'Start Running'}</PrimaryBtn>
  </>;else if(d.status==='running')actions=<>
    <SecondaryBtn danger disabled={busy}onClick={()=>{setExceptionNote('');setExceptionOpen(true);}}>Mark Exception</SecondaryBtn>
    <PrimaryBtn icon={<LF.Check size={14}/>}disabled={busy}onClick={()=>confirmThen(`Unload ${d.code}?`,()=>api.dispatches.unload(d.id),`${d.code} unloaded`)}>{busy?'…':'Mark Unloaded'}</PrimaryBtn>
  </>;else if(d.status==='unloaded')actions=<>
    <PrimaryBtn icon={<LF.ClipboardList size={14}/>}disabled={busy}onClick={()=>setRecordOpen(true)}>Record Result</PrimaryBtn>
  </>;else if(d.status==='exception'&&d.raw_status==='execution_exception')actions=<>
    <SecondaryBtn danger disabled={busy}onClick={async()=>{if(!window.confirm(`Abort ${d.code}? The dispatch will be closed and the WIP will remain open for a new dispatch.`))return;setBusy(true);setActionError(null);try{await api.dispatches.abort(d.id);showToast&&showToast(`${d.code} aborted — you can now create a new dispatch`);navigate({page:'lab_wip_detail',id:d.wipId});}catch(e){setActionError(e.message||String(e));setBusy(false);}}}>Abort Dispatch</SecondaryBtn>
    <PrimaryBtn icon={<LF.Refresh size={14}/>}disabled={busy}onClick={()=>confirmThen(`Redispatch ${d.code}? A new dispatch will be created with the same equipment and recipe.`,()=>api.dispatches.redispatch(d.id),`${d.code} redispatched`)}>{busy?'…':'Redispatch'}</PrimaryBtn>
  </>;const wipCode=`WIP-${String(d.wipId).padStart(4,'0')}`;const rec=d.recipeParams?{name:d.recipeName,params:d.recipeParams}:null;return<Page breadcrumb={<Breadcrumb items={[{label:'Dispatches',onClick:()=>navigate({page:'lab_dispatches'})},{label:wipCode,onClick:()=>navigate({page:'lab_wip_detail',id:d.wipId})},{label:d.code}]}/>}title={`Dispatch ${d.code}`}subtitle={<span style={{display:'inline-flex',alignItems:'center',gap:10}}>
        <Pill kind={d.status}dotted={d.status==='running'}/>
        <span style={{color:text2,fontSize:13}}>{d.experimentName||'—'} → <strong style={{color:ink,fontFamily:'var(--font-mono)'}}>{d.equipmentName||'—'}</strong></span>
      </span>}right={actions}>
      {actionError&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          {actionError}
        </div>}
      {}
      <Card padding={0}style={{marginBottom:18}}>
        <CardHeader>Lifecycle</CardHeader>
        <div style={{padding:'22px 26px',display:'flex',alignItems:'center',gap:0}}>
          {STATUS_FLOW.map((s,i)=>{const done=isDone?i<=stepIdx:!isFailed&&i<stepIdx;const cur=!isDone&&!isFailed&&i===stepIdx;const reachedColor=done?accent:cur?accent:'#dcdce3';return<React.Fragment key={s}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,flexShrink:0}}>
                  <span style={{width:26,height:26,borderRadius:999,background:done||cur?accent:'#fff',border:`2px solid ${reachedColor}`,display:'inline-flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>
                    {done&&<LF.Check size={13}color="#fff"strokeWidth={3}/>}
                    {cur&&<span style={{width:8,height:8,borderRadius:999,background:'#fff'}}/>}
                  </span>
                  <span style={{fontSize:11.5,fontWeight:600,color:done||cur?ink:muted,whiteSpace:'nowrap'}}>
                    {PILL[s].label}
                  </span>
                </div>
                {i<STATUS_FLOW.length-1&&<div style={{flex:1,height:2,background:done?accent:'#ececf2',margin:'0 4px',marginBottom:22}}/>}
              </React.Fragment>;})}
        </div>
        {d.status==='running'&&d.dispatchedAtIso&&(()=>{const totalSec=d.estimatedDurationSeconds||0;const startMs=new Date(d.dispatchedAtIso).getTime();const elapsedSec=Math.max(0,(Date.now()-startMs)/1000);const pct=totalSec>0?Math.min(100,elapsedSec/totalSec*100):0;const remainSec=Math.max(0,totalSec-elapsedSec);return<div style={{padding:'0 26px 22px',borderTop:`1px solid ${lineSoft}`,paddingTop:18}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,color:text2,fontWeight:600,marginBottom:8}}>
                <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                  <span style={{width:8,height:8,borderRadius:999,background:'#f4a8bf',boxShadow:'0 0 8px #f4a8bf',animation:'pulse 1.4s ease-in-out infinite'}}/>
                  Running · dispatched <span style={{fontFamily:'var(--font-mono)',color:ink}}>{d.dispatchedAt.split(' ')[1]}</span>
                  <span style={{color:muted}}>·</span>
                  <span style={{color:muted}}>est. {UI.formatDuration(d.estimatedDurationSeconds)}</span>
                </span>
                <span style={{fontFamily:'var(--font-mono)',color:accent,fontWeight:700}}>
                  {totalSec>0?`${UI.formatDuration(Math.ceil(remainSec))} remaining`:'—'}
                </span>
              </div>
              {totalSec>0?<>
                  <div style={{position:'relative',height:8,background:'#f1eef9',borderRadius:999,overflow:'hidden'}}>
                    <div style={{position:'absolute',inset:0,width:`${pct}%`,background:'linear-gradient(90deg, #f4a8bf, #6c67b8)',borderRadius:999,transition:'width 0.3s'}}/>
                    <div style={{position:'absolute',top:-2,left:`calc(${pct}% - 6px)`,width:12,height:12,borderRadius:999,background:'#fff',border:'2px solid #6c67b8',boxShadow:'0 0 0 0 rgba(108,103,184,0.4)',animation:'ringpulse 1.8s ease-out infinite'}}/>
                  </div>
                  <div style={{fontSize:11.5,color:muted,marginTop:6,fontFamily:'var(--font-mono)'}}>
                    {Math.round(pct)}% of {UI.formatDuration(totalSec)} estimate
                  </div>
                </>:<div style={{fontSize:12,color:muted,fontStyle:'italic'}}>
                  Estimated duration not set — countdown unavailable.
                </div>}
            </div>;})()}
        {(d.status==='aborted'||d.status==='exception')&&<div style={{padding:'12px 24px',borderTop:`1px solid ${lineSoft}`,background:'#fbe4e6',color:'#a93445',fontSize:13,fontWeight:600}}>
            <LF.Alert size={14}color="#a93445"style={{verticalAlign:'-2px',marginRight:6}}/>
            {d.status==='aborted'?'Dispatch aborted before completion.':d.raw_status==='pending_redispatch'?'Dispatch superseded — a new dispatch has been created to continue this WIP.':'Execution exception — abort this dispatch to open a new one, or redispatch on the same equipment.'}
          </div>}
      </Card>

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 360px',gap:18,alignItems:'flex-start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <Card padding={0}>
            <CardHeader>Dispatch Info</CardHeader>
            <div style={{padding:22,display:'grid',gridTemplateColumns:'140px 1fr',rowGap:12}}>
              <div style={{fontSize:13,color:text2}}>WIP</div>
              <button onClick={()=>navigate({page:'lab_wip_detail',id:d.wipId})}style={{background:'transparent',border:'none',padding:0,cursor:'pointer',color:accent,fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700,textAlign:'left'}}>{wipCode}</button>
              <div style={{fontSize:13,color:text2}}>Experiment Type</div>
              <div style={{fontSize:14,color:ink}}>{d.experimentName||'—'}</div>
              <div style={{fontSize:13,color:text2}}>Equipment</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:14,color:ink}}>{d.equipmentName||'—'}</div>
              <div style={{fontSize:13,color:text2}}>Recipe</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:ink}}>{d.recipeName||'—'}</div>
              <div style={{fontSize:13,color:text2}}>Operator</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:ink}}>{d.operator||'—'}</div>
              <div style={{fontSize:13,color:text2}}>Est. Duration</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:ink}}>{UI.formatDuration(d.estimatedDurationSeconds)}</div>
              <div style={{fontSize:13,color:text2}}>Dispatched At</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:ink}}>{d.dispatchedAt||'—'}</div>
              <div style={{fontSize:13,color:text2}}>Completed At</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:ink}}>{d.completedAt||'—'}</div>
              {d.note&&<>
                <div style={{fontSize:13,color:'#a93445',fontWeight:600}}>Exception Note</div>
                <div style={{fontSize:13.5,color:ink,lineHeight:1.55}}>{d.note}</div>
              </>}
            </div>
          </Card>

          {(d.result||waferResults.length>0)&&<Card padding={0}>
              <CardHeader>
                <span>Recorded Result</span>
                {d.result?.recordedAt&&<span style={{marginLeft:'auto',fontSize:11.5,color:muted,fontFamily:'var(--font-mono)'}}>
                    {d.result.recordedAt}
                  </span>}
              </CardHeader>
              <div style={{padding:'18px 22px',display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <div style={{fontSize:11.5,color:text2,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>
                    Comment
                  </div>
                  <div style={{fontSize:14,color:ink,lineHeight:1.55}}>
                    {d.result?.comment?d.result.comment:<span style={{color:muted,fontStyle:'italic'}}>No comment recorded.</span>}
                  </div>
                </div>
                {waferResults.length>0&&<div>
                    <div style={{fontSize:11.5,color:text2,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>
                      Per-Wafer Results ({waferResults.length})
                    </div>
                    <div style={{border:`1px solid ${lineSoft}`,borderRadius:8,overflow:'hidden'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 90px 110px',background:bgSoft,padding:'8px 14px',fontSize:11,fontWeight:700,color:muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                        <div>Wafer</div><div>Size</div><div style={{textAlign:'right'}}>Verdict</div>
                      </div>
                      {waferResults.map(w=>{const v=w.verdict;const pillBg=v==='pass'?'#e7f0e9':v==='fail'?'#fbe4e6':'#f1f1f5';const pillFg=v==='pass'?'#2e6a47':v==='fail'?'#a93445':muted;const pillLabel=v==='pass'?'✓ Pass':v==='fail'?'✗ Fail':'—';return<div key={w.sampleId}style={{display:'grid',gridTemplateColumns:'1fr 90px 110px',alignItems:'center',gap:8,padding:'12px 14px',borderTop:`1px solid ${lineSoft}`}}>
                            <span style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:ink}}>{w.wafer}</span>
                            <span style={{fontSize:12.5,color:text2}}>{w.size}</span>
                            <span style={{textAlign:'right'}}>
                              <span style={{display:'inline-block',padding:'3px 10px',borderRadius:999,background:pillBg,color:pillFg,fontSize:11.5,fontWeight:700}}>{pillLabel}</span>
                            </span>
                          </div>;})}
                    </div>
                  </div>}
              </div>
            </Card>}
        </div>

        <Card padding={0}>
          <CardHeader>Recipe Parameters</CardHeader>
          <div style={{padding:22,display:'grid',gridTemplateColumns:'110px 1fr',rowGap:10}}>
            {rec?Object.entries(rec.params).map(([k,v])=><React.Fragment key={k}>
                <div style={{fontSize:12.5,color:text2,textTransform:'capitalize'}}>{k.replace(/_/g,' ')}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:ink}}>{v}</div>
              </React.Fragment>):<div style={{color:muted,fontSize:13}}>No recipe selected</div>}
          </div>
        </Card>
      </div>

      <RecordResultModal open={recordOpen}onClose={()=>setRecordOpen(false)}dispatch={d}waferResults={waferResults}onSubmit={async payload=>{setRecordOpen(false);await runAction(()=>api.dispatches.recordResult(d.id,payload),`${d.code} result recorded`);}}/>

      <Modal open={exceptionOpen}onClose={()=>setExceptionOpen(false)}title="Mark Execution Exception"width={480}footer={<>
          <SecondaryBtn onClick={()=>setExceptionOpen(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn danger disabled={busy||!exceptionNote.trim()}onClick={async()=>{setExceptionOpen(false);await runAction(()=>api.dispatches.reportException(d.id,exceptionNote.trim()),`${d.code} flagged as exception`);}}>Confirm Exception</PrimaryBtn>
        </>}>
        <div style={{fontSize:13.5,color:ink,marginBottom:16}}>
          Describe what went wrong during this dispatch run. This note will be permanently attached to the dispatch record.
        </div>
        <label style={{fontSize:12.5,fontWeight:600,color:text2,display:'block',marginBottom:6}}>
          Exception Reason <span style={{color:'#c0394a'}}>*</span>
        </label>
        <TextArea value={exceptionNote}onChange={e=>setExceptionNote(e.target.value)}placeholder="e.g. Equipment malfunction — temperature spike at 15 min mark"style={{width:'100%'}}/>
      </Modal>
    </Page>;};
export default LabDispatchDetail;
export { LabDispatchDetail };
