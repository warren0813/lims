// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import useLabSamples from '@/components/Lab/useLabSamples';
import Page from '@/components/Manager/Page';
import muted from '@/components/Lab/muted';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import line from '@/components/Lab/line';
import ink from '@/components/Lab/ink';
import text2 from '@/components/Lab/text2';
import Card from '@/components/Manager/Card';
import computeRemaining from '@/components/Lab/computeRemaining';
import formatRemaining from '@/components/Lab/formatRemaining';
import REMAINING_STYLE from '@/components/Lab/REMAINING_STYLE';
import URGENCY_DAYS from '@/components/Lab/URGENCY_DAYS';
import Pill from '@/components/Manager/Pill';
const LF=I;
const LabSamples=({navigate,defaultTab='all',showToast})=>{const{wafers,loading,error,refresh}=useLabSamples();const[tab,setTab]=React.useState(defaultTab);const[busyIds,setBusyIds]=React.useState(new Set());const[actionError,setActionError]=React.useState(null);const runAction=async(id,op,label)=>{setBusyIds(prev=>new Set(prev).add(id));setActionError(null);try{await op();showToast&&showToast(label);refresh();}catch(e){setActionError(e.message||String(e));}finally{setBusyIds(prev=>{const next=new Set(prev);next.delete(id);return next;});}};const handleReceive=w=>runAction(w.id,()=>api.samples.receive(w.id),`${w.wafer} received`);const handleReject=w=>runAction(w.id,()=>api.samples.rejectReceiving(w.id,''),`${w.wafer} rejected`);const handleBulkReceive=()=>{wafers.filter(w=>w.status==='incoming'&&!busyIds.has(w.id)).forEach(handleReceive);};const tabs=[{id:'all',label:'All',count:wafers.length},{id:'incoming',label:'Incoming',count:wafers.filter(w=>w.status==='incoming').length},{id:'received',label:'Received',count:wafers.filter(w=>w.status==='received').length},{id:'in_wip',label:'In WIP',count:wafers.filter(w=>w.status==='in_wip').length},{id:'completed',label:'Completed',count:wafers.filter(w=>w.status==='completed').length},{id:'rejected',label:'Rejected',count:wafers.filter(w=>w.status==='rejected').length}];const list=tab==='all'?wafers:wafers.filter(w=>w.status===tab);if(loading&&wafers.length===0){return<Page title="Samples"subtitle="Loading…">
        <div style={{padding:'60px 20px',textAlign:'center',color:muted,fontSize:14}}>
          Loading…
        </div>
      </Page>;}return<Page title="Samples"subtitle="Wafers from fab — countdown starts when received. Red rows are past deadline."right={<SecondaryBtn icon={<LF.Inbox size={14}/>}onClick={handleBulkReceive}>Bulk receive incoming</SecondaryBtn>}>
      {(error||actionError)&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          {error||actionError}
        </div>}
      <div style={{display:'flex',gap:4,marginBottom:14,borderBottom:`1px solid ${line}`}}>
        {tabs.map(t=><button key={t.id}onClick={()=>setTab(t.id)}style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px 14px',background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?ink:'transparent'}`,color:tab===t.id?ink:text2,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:-1}}>
            {t.label}
            <span style={{padding:'1px 7px',borderRadius:999,fontSize:11,fontWeight:700,background:tab===t.id?'#ecebf3':'#f1f1f5',color:tab===t.id?'#4f4a8f':muted}}>{t.count}</span>
          </button>)}
      </div>

      <div style={{fontSize:13,color:muted,marginBottom:14}}>
        Showing <strong style={{color:ink}}>{list.length}</strong> of {wafers.length} wafer{wafers.length===1?'':'s'}
      </div>

      {}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {list.length===0?<Card padding={48}style={{textAlign:'center',color:muted}}>
            <LF.Inbox size={32}color="#cbcbd6"style={{marginBottom:10}}/>
            <div style={{fontSize:14,fontWeight:600,color:text2}}>No wafers in this view</div>
          </Card>:list.map(w=>{const remaining=computeRemaining(w);const fmt=formatRemaining(remaining);const style=REMAINING_STYLE[fmt.level];const showDot=fmt.level==='overdue'||fmt.level==='critical';const busy=busyIds.has(w.id);return<button key={w.id}onClick={()=>navigate({page:'lab_wafer',id:w.id})}style={{display:'grid',gridTemplateColumns:'110px minmax(0,1fr) 150px 130px 150px 24px',alignItems:'center',gap:18,padding:'18px 22px',borderRadius:14,background:style.rowBg,border:`1px solid ${fmt.level==='overdue'?'#f1b9c0':'rgba(0,0,0,0.08)'}`,textAlign:'left',cursor:'pointer',transition:'border-color 0.12s, background 0.12s',fontFamily:'inherit'}}onMouseEnter={e=>{e.currentTarget.style.borderColor=fmt.level==='overdue'?'#e88a93':'rgba(0,0,0,0.18)';}}onMouseLeave={e=>{e.currentTarget.style.borderColor=fmt.level==='overdue'?'#f1b9c0':'rgba(0,0,0,0.08)';}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                {showDot&&<span title="Past or near deadline"style={{width:6,height:6,borderRadius:999,background:'#c0394a',flexShrink:0}}/>}
                <span style={{fontFamily:'var(--font-mono)',fontSize:13.5,fontWeight:700,color:ink,letterSpacing:'0.02em'}}>{w.wafer}</span>
              </span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:ink}}>
                  {w.size} <span style={{color:muted,fontWeight:500}}>· #{String(w.requestId).padStart(4,'0')}</span>
                </div>
                <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,fontSize:12.5,color:muted}}>
                  <LF.Calendar size={12}/>
                  <span style={{fontFamily:'var(--font-mono)'}}>{w.arrivedAt||'—'}</span>
                  <span>·</span>
                  <span>{URGENCY_DAYS[w.urgency]===3?'3-day':URGENCY_DAYS[w.urgency]===7?'1-week':'2-week'} window</span>
                </div>
              </div>
              <div>
                <span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 11px',borderRadius:999,background:style.bg,color:style.fg,fontSize:12,fontWeight:700,letterSpacing:'0.02em',whiteSpace:'nowrap'}}>
                  {fmt.level!=='none'&&<LF.Clock size={11}color={style.fg}/>}
                  {fmt.text}
                </span>
              </div>
              <div><Pill kind={w.status}/></div>
              <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}onClick={e=>e.stopPropagation()}>
                {w.status==='incoming'?<>
                    <SecondaryBtn onClick={()=>handleReceive(w)}disabled={busy}style={{padding:'5px 10px',fontSize:12}}>{busy?'…':'Receive'}</SecondaryBtn>
                    <SecondaryBtn danger onClick={()=>handleReject(w)}disabled={busy}style={{padding:'5px 10px',fontSize:12}}>{busy?'…':'Reject'}</SecondaryBtn>
                  </>:<span style={{fontSize:12,color:muted}}>—</span>}
              </div>
              <LF.ChevronRight size={15}color="#cbcbd6"/>
            </button>;})}
      </div>
    </Page>;};
export default LabSamples;
export { LabSamples };
