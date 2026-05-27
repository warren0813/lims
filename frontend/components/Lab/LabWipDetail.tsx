// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import * as UI from '@/components/ui/UI';
import useLabWipDetail from '@/components/Lab/useLabWipDetail';
import Page from '@/components/Manager/Page';
import muted from '@/components/Lab/muted';
import Breadcrumb from '@/components/Manager/Breadcrumb';
import findExp from '@/components/Lab/findExp';
import Pill from '@/components/Manager/Pill';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import lineSoft from '@/components/Lab/lineSoft';
import bgSoft from '@/components/Lab/bgSoft';
import ink from '@/components/Lab/ink';
import text2 from '@/components/Lab/text2';
import accent from '@/components/Lab/accent';
import AddDispatchModal from '@/components/Lab/AddDispatchModal';
const LF=I;
const LabWipDetail=({id,navigate,showToast})=>{const{wip:w,loading,error,refresh}=useLabWipDetail(id);const[busy,setBusy]=React.useState(false);const[actionError,setActionError]=React.useState(null);const runAction=async(op,label)=>{setBusy(true);setActionError(null);try{await op();showToast&&showToast(label);refresh();}catch(e){setActionError(e.message||String(e));}finally{setBusy(false);}};const onAbort=()=>{if(!w)return;if(!window.confirm(`Abort ${w.code}? This cannot be undone.`))return;runAction(()=>api.wips.abort(w.id),`${w.code} aborted`);};const[addDispatchOpen,setAddDispatchOpen]=React.useState(false);const onAddDispatch=()=>setAddDispatchOpen(true);const onDispatchCreated=()=>{setAddDispatchOpen(false);showToast&&showToast('Dispatch created');refresh();};if(loading&&!w){return<Page title="Loading WIP…">
        <div style={{padding:'60px 20px',textAlign:'center',color:muted,fontSize:14}}>Loading…</div>
      </Page>;}if(error||!w){return<Page breadcrumb={<Breadcrumb items={[{label:'WIP',onClick:()=>navigate({page:'lab_wip'})},{label:'?'}]}/>}title="WIP not found">
        <div style={{padding:24,color:'#c0394a',fontSize:14}}>
          {error||'This WIP is no longer available.'}
        </div>
      </Page>;}const expCode=findExp(w.experimentId)?.code||(w.experimentName?w.experimentName.split(/\s+/).map(t=>t[0]).join('').slice(0,4).toUpperCase():'—');const isActive=w.status!=='completed'&&w.status!=='aborted';const hasActiveDispatch=w.dispatches.some(d=>d.status!=='completed'&&d.status!=='aborted'&&d.raw_status!=='pending_redispatch');return<Page breadcrumb={<Breadcrumb items={[{label:'WIP',onClick:()=>navigate({page:'lab_wip'})},{label:w.code}]}/>}title={w.code}subtitle={<span style={{display:'inline-flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <Pill kind={w.status}dotted={w.status==='in_progress'}/>
        <span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f',fontSize:11.5,fontWeight:700,letterSpacing:'0.02em'}}>
          <span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:999,background:'#fff',color:'#4f4a8f',letterSpacing:'0.05em'}}>{expCode}</span>
          {w.experimentName||'—'}
        </span>
        <span style={{color:muted,fontSize:13}}>· {w.sampleCount} sample{w.sampleCount===1?'':'s'}</span>
        {w.created&&<span style={{color:muted,fontSize:13}}>· created {w.created.split(' ')[0]}</span>}
      </span>}right={isActive&&(hasActiveDispatch?<SecondaryBtn danger onClick={onAbort}disabled={busy}>{busy?'…':'Abort WIP'}</SecondaryBtn>:<PrimaryBtn icon={<LF.Plus size={14}/>}onClick={onAddDispatch}disabled={busy}>Create Dispatch</PrimaryBtn>)}>
      {actionError&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          {actionError}
        </div>}

      {(()=>{const exceptionDispatch=w.dispatches.find(d=>d.raw_status==='execution_exception');if(!exceptionDispatch)return null;return<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fef3e2',color:'#9a4715',fontSize:13.5,fontWeight:500,border:'1px solid #f6d9b0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <span>
              <LF.Alert size={14}color="#9a4715"style={{verticalAlign:'-2px',marginRight:6}}/>
              {exceptionDispatch.code} has an execution exception. Abort or redispatch it to continue.
            </span>
            <button onClick={()=>navigate({page:'lab_dispatch_detail',id:exceptionDispatch.id})}style={{background:'#9a4715',color:'#fff',border:'none',borderRadius:6,padding:'5px 12px',fontSize:12.5,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>View Dispatch</button>
          </div>;})()}

      <div style={{display:'grid',gridTemplateColumns:'minmax(0, 1fr) 320px',gap:18,alignItems:'flex-start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <Card padding={0}>
            <CardHeader>
              <span>Dispatches</span>
              <span style={{marginLeft:'auto',fontSize:11,color:muted,fontWeight:600}}>{w.dispatches.length}</span>
            </CardHeader>
            {w.dispatches.length===0?<div style={{padding:'28px 20px',textAlign:'center',color:muted,fontSize:13}}>
                No dispatches yet{isActive&&!hasActiveDispatch?' — use Create Dispatch above to start one':''}
              </div>:<>
                <div style={{display:'grid',gridTemplateColumns:'80px 1.4fr 1.4fr 1.1fr 80px 130px 80px',padding:'10px 20px',borderBottom:`1px solid ${lineSoft}`,background:bgSoft,fontSize:11,fontWeight:700,color:muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                  <div>ID</div><div>Exp. Type</div><div>Recipe</div><div>Equipment</div><div>Est.</div><div>Status</div><div style={{textAlign:'right'}}>Action</div>
                </div>
                {w.dispatches.map(d=><div key={d.id}style={{display:'grid',gridTemplateColumns:'80px 1.4fr 1.4fr 1.1fr 80px 130px 80px',alignItems:'center',gap:8,padding:'13px 20px',borderTop:`1px solid ${lineSoft}`}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:muted}}>{d.code}</span>
                    <span style={{fontSize:13,color:ink}}>{d.experimentName||'—'}</span>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.recipeName||'—'}</span>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:text2}}>{d.equipmentName||'—'}</span>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:text2}}>{UI.formatDuration(d.estimatedDurationSeconds)}</span>
                    <span><Pill kind={d.status}dotted={d.status==='running'}/></span>
                    <button onClick={()=>navigate({page:'lab_dispatch_detail',id:d.id})}style={{background:'transparent',border:'none',cursor:'pointer',color:accent,fontWeight:600,fontSize:12.5,textAlign:'right',padding:0,fontFamily:'inherit'}}>Manage</button>
                  </div>)}
              </>}
          </Card>

          {w.note&&<Card padding={0}>
              <CardHeader>Note</CardHeader>
              <div style={{padding:22,fontSize:14,color:ink,lineHeight:1.55}}>{w.note}</div>
            </Card>}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <Card padding={0}>
            <CardHeader>Samples ({w.samples.length})</CardHeader>
            <div>
              {w.samples.length===0?<div style={{padding:'20px 22px',color:muted,fontSize:13}}>No samples on this WIP.</div>:w.samples.map(s=><button key={s.id}onClick={()=>navigate({page:'lab_wafer',id:s.id})}style={{width:'100%',display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:8,padding:'13px 20px',borderTop:`1px solid ${lineSoft}`,background:'#fff',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
                  <div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:ink}}>{s.wafer}</div>
                    <div style={{fontSize:11.5,color:muted,marginTop:2}}>{s.size} — Req #{String(s.requestId).padStart(4,'0')}</div>
                  </div>
                  <Pill kind={s.status}/>
                </button>)}
            </div>
          </Card>
        </div>
      </div>

      <AddDispatchModal open={addDispatchOpen}onClose={()=>setAddDispatchOpen(false)}wip={w}onCreated={onDispatchCreated}/>
    </Page>;};
export default LabWipDetail;
export { LabWipDetail };
