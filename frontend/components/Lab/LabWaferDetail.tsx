// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import useWaferDetail from '@/components/Lab/useWaferDetail';
import useLabExperimentTypes from '@/components/Lab/useLabExperimentTypes';
import Page from '@/components/Manager/Page';
import muted from '@/components/Lab/muted';
import Breadcrumb from '@/components/Manager/Breadcrumb';
import Pill from '@/components/Manager/Pill';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import text2 from '@/components/Lab/text2';
import ink from '@/components/Lab/ink';
import lineSoft from '@/components/Lab/lineSoft';
import accent from '@/components/Lab/accent';
const LF=I;
const LabWaferDetail=({id,navigate,showToast})=>{const{data,loading,error,refresh}=useWaferDetail(id);const{data:expTypes}=useLabExperimentTypes();const[busy,setBusy]=React.useState(false);const[actionError,setActionError]=React.useState(null);const runAction=async(op,label)=>{setBusy(true);setActionError(null);try{await op();showToast&&showToast(label);refresh();}catch(e){setActionError(e.message||String(e));}finally{setBusy(false);}};if(loading&&!data){return<Page title="Loading wafer…">
        <div style={{padding:'60px 20px',textAlign:'center',color:muted,fontSize:14}}>Loading…</div>
      </Page>;}if(error||!data){return<Page breadcrumb={<Breadcrumb items={[{label:'Samples',onClick:()=>navigate({page:'lab_samples'})},{label:'?'}]}/>}title="Wafer not found">
        <div style={{padding:24,color:'#c0394a',fontSize:14}}>
          {error||'This wafer is no longer available.'}
        </div>
      </Page>;}const{sample:w,request,wip,experiments}=data;const urgency=request?.urgency||'1w';const labCategoryById=new Map((expTypes||[]).map(t=>[t.id,t.labCategory]));const expRows=(experiments||[]).map(e=>({id:e.experimentTypeId,name:e.experimentName,group:labCategoryById.get(e.experimentTypeId)||'',status:e.status,verdict:e.verdict,dispatchId:e.dispatchId,result:e.result}));const doneCount=expRows.filter(r=>r.status==='done').length;const onReceive=()=>runAction(()=>api.samples.receive(w.id),`${w.wafer} received`);const onReject=()=>runAction(()=>api.samples.rejectReceiving(w.id,''),`${w.wafer} rejected`);return<Page breadcrumb={<Breadcrumb items={[{label:'Samples',onClick:()=>navigate({page:'lab_samples'})},{label:w.wafer}]}/>}title={w.wafer}subtitle={<span style={{display:'inline-flex',alignItems:'center',gap:10}}>
        <span style={{fontFamily:'var(--font-mono)',color:muted}}>Request #{String(w.requestId).padStart(4,'0')}</span>
        <Pill kind={w.status}/>
        <Pill kind={urgency}/>
      </span>}right={w.status==='incoming'&&<>
        <SecondaryBtn danger disabled={busy}onClick={onReject}icon={<LF.X size={14}/>}>{busy?'…':'Reject'}</SecondaryBtn>
        <PrimaryBtn disabled={busy}onClick={onReceive}icon={<LF.Check size={14}/>}>{busy?'…':'Receive'}</PrimaryBtn>
      </>}>
      {actionError&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>{actionError}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:18,alignItems:'flex-start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <Card padding={0}>
            <CardHeader>Wafer Info</CardHeader>
            <div style={{padding:22,display:'grid',gridTemplateColumns:'120px 1fr',rowGap:12}}>
              <div style={{fontSize:13,color:text2}}>Wafer ID</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700,color:ink}}>{w.wafer}</div>
              <div style={{fontSize:13,color:text2}}>Size</div>
              <div style={{fontSize:14,color:ink}}>{w.size}</div>
              <div style={{fontSize:13,color:text2}}>From request</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:14,color:ink}}>#{String(w.requestId).padStart(4,'0')}{request?.title?` — ${request.title}`:''}</div>
              <div style={{fontSize:13,color:text2}}>Urgency</div>
              <div><Pill kind={urgency}/></div>
              <div style={{fontSize:13,color:text2}}>Arrived at</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:14,color:ink}}>{w.arrivedAt||'—'}</div>
              <div style={{fontSize:13,color:text2}}>Status</div>
              <div><Pill kind={w.status}/></div>
            </div>
          </Card>

          {expRows.length>0&&<Card padding={0}>
              <CardHeader>
                <span>Experiments</span>
                <span style={{marginLeft:'auto',fontSize:11,color:muted,fontWeight:600,letterSpacing:'0.06em'}}>
                  {doneCount}/{expRows.length} DONE
                </span>
              </CardHeader>
              <div style={{padding:18,display:'flex',flexWrap:'wrap',gap:8,background:'#fafafd'}}>
                {expRows.map(e=>{const done=e.status==='done';const running=e.status==='running';const pass=done&&e.verdict==='pass';const fail=done&&e.verdict==='fail';const clickable=e.dispatchId!=null;const bg=fail?'#fbe4e6':done?'#e7f6ec':running?'#ecebf3':'#f4f4f7';const border=fail?'#f4b4b9':done?'#9ad9b7':running?'#bcb8e2':'rgba(0,0,0,0.08)';const badgeBg=fail?'#a93445':done?'#157a4a':running?'#4f4a8f':'#cbcbd6';const textCol=fail?'#5a1a22':done?'#1f3d2c':running?ink:'#7a7a8c';return<button key={e.id}type="button"disabled={!clickable}onClick={()=>clickable&&navigate({page:'lab_dispatch_detail',id:e.dispatchId})}style={{display:'inline-flex',alignItems:'center',gap:7,padding:'6px 12px 6px 7px',borderRadius:999,background:bg,border:`1px solid ${border}`,fontFamily:'inherit',cursor:clickable?'pointer':'default'}}>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 7px',borderRadius:999,background:badgeBg,color:'#fff',letterSpacing:'0.05em'}}>{e.group||'\u2014'}</span>
                      <span style={{fontSize:13,fontWeight:500,color:textCol}}>{e.name}</span>
                      {fail?<LF.X size={13}color="#a93445"strokeWidth={3}/>:done?<LF.Check size={13}color="#157a4a"strokeWidth={3}/>:running?<span style={{width:9,height:9,borderRadius:999,background:'#4f4a8f',animation:'pulse 1.4s infinite'}}/>:<span style={{width:13,height:13,borderRadius:999,border:'1.5px dashed #cbcbd6'}}/>}
                    </button>;})}
              </div>
            </Card>}

          {wip&&<Card padding={0}>
              <CardHeader>Current WIP</CardHeader>
              <button onClick={()=>navigate({page:'lab_wip_detail',id:wip.id})}style={{width:'100%',textAlign:'left',background:'#fff',border:'none',padding:'16px 22px',cursor:'pointer',fontFamily:'inherit',display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'center'}}>
                <div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700,color:ink}}>{wip.code}</div>
                  <div style={{fontSize:12.5,color:text2,marginTop:4}}>
                    {wip.experimentName||'—'}
                  </div>
                </div>
                <Pill kind={wip.status}/>
              </button>
              {wipDispatches.length>0&&<div style={{borderTop:`1px solid ${lineSoft}`}}>
                  {wipDispatches.map(d=><button key={d.id}onClick={()=>navigate({page:'lab_dispatch_detail',id:d.id})}style={{display:'grid',gridTemplateColumns:'90px 1fr 130px',gap:12,alignItems:'center',width:'100%',padding:'12px 22px',borderTop:`1px solid ${lineSoft}`,background:'#fff',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:text2}}>{d.code}</span>
                      <span style={{fontSize:13,color:ink}}>{d.experimentName||'—'}</span>
                      <Pill kind={d.status}/>
                    </button>)}
                </div>}
            </Card>}
        </div>

        <Card padding={22}>
          <div style={{fontSize:11,fontWeight:700,color:text2,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Lifecycle</div>
          {[{k:'incoming',l:'Arrived from fab'},{k:'received',l:'Received at lab'},{k:'in_wip',l:'Processing'},{k:'completed',l:'Experiment(s) done'}].map((s,i,arr)=>{const order={incoming:0,received:1,in_wip:2,processing:2,completed:3,rejected:1,cancelled:1,returned:1};const cur=order[w.status]??0;const reached=i<=cur&&w.status!=='rejected';return<div key={s.k}style={{display:'flex',gap:10,paddingBottom:12,position:'relative'}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                  <span style={{width:14,height:14,borderRadius:999,background:reached?accent:'#e5e5ec',border:'3px solid #fff',boxShadow:`0 0 0 1.5px ${reached?accent:'#e5e5ec'}`}}/>
                  {i<arr.length-1&&<div style={{flex:1,width:2,background:reached&&i<cur?accent:'#ececf2',marginTop:2}}/>}
                </div>
                <div style={{paddingTop:0,fontSize:13,color:reached?ink:muted,fontWeight:reached?600:500}}>{s.l}</div>
              </div>;})}
          {w.status==='rejected'&&<div style={{marginTop:8,padding:10,borderRadius:8,background:'#fbe4e6',color:'#a93445',fontSize:12.5}}>
              <strong>Rejected.</strong> Status set during receiving; see request detail for the reason.
            </div>}
        </Card>
      </div>
    </Page>;};
export default LabWaferDetail;
export { LabWaferDetail };
