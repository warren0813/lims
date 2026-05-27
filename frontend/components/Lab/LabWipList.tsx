// @ts-nocheck
"use client";
import React from 'react';
import * as I from '@/components/ui/I';
import useLabWips from '@/components/Lab/useLabWips';
import Page from '@/components/Manager/Page';
import muted from '@/components/Lab/muted';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import line from '@/components/Lab/line';
import ink from '@/components/Lab/ink';
import text2 from '@/components/Lab/text2';
import Card from '@/components/Manager/Card';
import findExp from '@/components/Lab/findExp';
import Pill from '@/components/Manager/Pill';
import WipCreationModal from '@/components/Lab/WipCreationModal';
const LF=I;
const LabWipList=({navigate,showToast})=>{const{wips,loading,error,refresh}=useLabWips();const[tab,setTab]=React.useState('active');const[modalOpen,setModalOpen]=React.useState(false);const isWipActive=w=>w.status!=='completed'&&w.status!=='aborted';const filtered=tab==='active'?wips.filter(isWipActive):tab==='completed'?wips.filter(w=>!isWipActive(w)):wips;const openModal=()=>setModalOpen(true);const closeModal=()=>setModalOpen(false);const onSaved=newWip=>{closeModal();showToast&&showToast(`${newWip.code} created`);refresh();if(newWip?.id!=null)navigate({page:'lab_wip_detail',id:newWip.id});};if(loading&&wips.length===0){return<Page title="WIP"subtitle="Loading…">
        <div style={{padding:'60px 20px',textAlign:'center',color:muted,fontSize:14}}>
          Loading…
        </div>
      </Page>;}return<Page title="WIP"subtitle="Work-in-progress units — each WIP runs one experiment on one piece of equipment"right={<PrimaryBtn icon={<LF.Plus size={14}/>}onClick={openModal}>New WIP</PrimaryBtn>}>
      {error&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          Couldn't load WIPs: {error}
        </div>}
      <div style={{display:'flex',gap:4,marginBottom:14,borderBottom:`1px solid ${line}`}}>
        {[{id:'active',label:'Active',n:wips.filter(isWipActive).length},{id:'completed',label:'Completed',n:wips.filter(w=>!isWipActive(w)).length},{id:'all',label:'All',n:wips.length}].map(t=><button key={t.id}onClick={()=>setTab(t.id)}style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px 14px',background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?ink:'transparent'}`,color:tab===t.id?ink:text2,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:-1}}>
            {t.label}
            <span style={{padding:'1px 7px',borderRadius:999,fontSize:11,fontWeight:700,background:tab===t.id?'#ecebf3':'#f1f1f5',color:tab===t.id?'#4f4a8f':muted}}>{t.n}</span>
          </button>)}
      </div>

      <div style={{fontSize:13,color:muted,marginBottom:14}}>
        Showing <strong style={{color:ink}}>{filtered.length}</strong> of {wips.length} WIP{wips.length===1?'':'s'}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.length===0?<Card padding={48}style={{textAlign:'center',color:muted}}>
            <LF.WIP size={32}color="#cbcbd6"style={{marginBottom:10}}/>
            <div style={{fontSize:14,fontWeight:600,color:text2}}>No WIPs in this view</div>
          </Card>:filtered.map(w=>{const expName=w.experimentName||findExp(w.experimentId)?.name||'—';const expCode=findExp(w.experimentId)?.code||(w.experimentName?w.experimentName.split(/\s+/).map(t=>t[0]).join('').slice(0,4).toUpperCase():'—');return<button key={w.id}onClick={()=>navigate({page:'lab_wip_detail',id:w.id})}style={{display:'grid',gridTemplateColumns:'110px minmax(0,1fr) 130px 80px 100px 140px 24px',alignItems:'center',gap:18,padding:'18px 22px',borderRadius:14,background:'#fff',border:'1px solid rgba(0,0,0,0.08)',textAlign:'left',cursor:'pointer',transition:'border-color 0.12s',fontFamily:'inherit'}}onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.18)';}}onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.08)';}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:13.5,fontWeight:700,color:ink,letterSpacing:'0.02em'}}>{w.code||w.id}</span>
              <div style={{minWidth:0,display:'inline-flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:10.5,fontWeight:700,padding:'3px 8px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f',letterSpacing:'0.05em',flexShrink:0}}>{expCode}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:14.5,fontWeight:700,color:ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{expName}</div>
                  <div style={{fontSize:12,color:muted,marginTop:3}}>
                    {w.note?w.note:w.created?`created ${w.created.split(' ')[0]}`:''}
                  </div>
                </div>
              </div>
              {}
              <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:muted}}>—</span>
              <span style={{fontSize:13,fontWeight:600,color:text2}}>
                <LF.Wafer size={12}color={muted}style={{verticalAlign:'-2px',marginRight:4}}/>
                {w.sampleCount??(Array.isArray(w.waferIds)?w.waferIds.length:0)}
              </span>
              <span style={{fontSize:13,fontWeight:600,color:text2}}>
                <LF.Dispatch size={12}color={muted}style={{verticalAlign:'-2px',marginRight:4}}/>
                {w.dispatchCount??(Array.isArray(w.dispatchIds)?w.dispatchIds.length:0)}
              </span>
              <span><Pill kind={w.status}dotted={w.status==='in_progress'}/></span>
              <LF.ChevronRight size={15}color="#cbcbd6"/>
            </button>;})}
      </div>

      <WipCreationModal open={modalOpen}onClose={closeModal}onSaved={onSaved}/>
    </Page>;};
export default LabWipList;
export { LabWipList };
