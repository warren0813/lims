// @ts-nocheck
"use client";
import React from 'react';
import * as I from '@/components/ui/I';
import useLabEquipment from '@/components/Lab/useLabEquipment';
import Page from '@/components/Manager/Page';
import muted from '@/components/Lab/muted';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import line from '@/components/Lab/line';
import ink from '@/components/Lab/ink';
import text2 from '@/components/Lab/text2';
import Card from '@/components/Manager/Card';
import lineSoft from '@/components/Lab/lineSoft';
import Pill from '@/components/Manager/Pill';
import accent from '@/components/Lab/accent';
import bgSoft from '@/components/Lab/bgSoft';
import EquipmentModal from '@/components/Lab/EquipmentModal';
const LF=I;
const LabEquipment=({navigate,canManage=false,showToast})=>{const{equipment,loading,error,refresh}=useLabEquipment();const[tab,setTab]=React.useState('all');const[modalOpen,setModalOpen]=React.useState(false);const[editing,setEditing]=React.useState(null);const openNew=()=>{setEditing(null);setModalOpen(true);};const openEdit=e=>{setEditing(e);setModalOpen(true);};const closeModal=()=>{setEditing(null);setModalOpen(false);};const onSaved=()=>{const wasEdit=!!editing;closeModal();showToast&&showToast(wasEdit?'Equipment updated':'Equipment created');refresh();};const counts={all:equipment.length,idle:equipment.filter(e=>e.status==='idle').length,maintenance:equipment.filter(e=>e.status==='maintenance').length};const filtered=tab==='all'?equipment:equipment.filter(e=>e.status===tab);const tabs=[{id:'all',label:'All'},{id:'idle',label:'Idle'},{id:'maintenance',label:'Maintenance'}];if(loading&&equipment.length===0){return<Page title="Equipment"subtitle="Loading…">
        <div style={{padding:'60px 20px',textAlign:'center',color:muted,fontSize:14}}>Loading…</div>
      </Page>;}return<Page title="Equipment"subtitle="Each unit accepts one WIP at a time, up to its wafer capacity"right={canManage&&<PrimaryBtn icon={<LF.Plus size={14}/>}onClick={openNew}>Add Equipment</PrimaryBtn>}>
      {error&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          Couldn't load equipment: {error}
        </div>}

      <div style={{display:'flex',gap:4,marginBottom:14,borderBottom:`1px solid ${line}`}}>
        {tabs.map(t=><button key={t.id}onClick={()=>setTab(t.id)}style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px 14px',background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?ink:'transparent'}`,color:tab===t.id?ink:text2,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:-1}}>
            {t.label}
            <span style={{padding:'1px 7px',borderRadius:999,fontSize:11,fontWeight:700,background:tab===t.id?'#ecebf3':'#f1f1f5',color:tab===t.id?'#4f4a8f':muted}}>{counts[t.id]}</span>
          </button>)}
      </div>

      <div style={{fontSize:13,color:muted,marginBottom:14}}>
        Showing <strong style={{color:ink}}>{filtered.length}</strong> of {equipment.length} unit{equipment.length===1?'':'s'}
      </div>

      {filtered.length===0?<Card padding={48}style={{textAlign:'center',color:muted}}>
          <LF.Equipment size={32}color="#cbcbd6"style={{marginBottom:10}}/>
          <div style={{fontSize:14,fontWeight:600,color:text2}}>No equipment in this view</div>
        </Card>:<div style={{display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:14}}>
          {filtered.map(e=>{const paramEntries=e.parameters?Object.entries(e.parameters):[];return<Card key={e.id}padding={0}>
                <div style={{padding:'16px 20px',borderBottom:`1px solid ${lineSoft}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700,color:ink}}>{e.name}</div>
                    <div style={{fontSize:12,color:muted,marginTop:2}}>{e.model||'—'}</div>
                  </div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:10}}>
                    <Pill kind={e.status}/>
                    {canManage&&<button onClick={()=>openEdit(e)}style={{background:'transparent',border:'none',cursor:'pointer',color:accent,fontWeight:600,fontSize:12.5,fontFamily:'inherit',padding:0}}>Edit</button>}
                  </div>
                </div>
                <div style={{padding:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12,color:text2}}>
                    <span>Wafer capacity</span>
                    <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:ink}}>{e.capacity}</span>
                  </div>
                  <div style={{height:6,borderRadius:999,background:'#ececf2',overflow:'hidden'}}>
                    <div style={{width:'0%',height:'100%',background:accent,borderRadius:999}}/>
                  </div>

                  <div style={{marginTop:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:muted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Capabilities</div>
                    {e.capabilities&&e.capabilities.length>0?<div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {e.capabilities.map(c=><span key={c.id}style={{fontSize:11.5,fontWeight:700,padding:'3px 9px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f',letterSpacing:'0.02em'}}>{c.name}</span>)}
                      </div>:<div style={{fontSize:12.5,color:muted,fontStyle:'italic'}}>No experiment types assigned</div>}
                  </div>

                  {paramEntries.length>0&&<div style={{marginTop:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:muted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Parameters</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {paramEntries.map(([k,v])=><span key={k}style={{fontFamily:'var(--font-mono)',fontSize:11.5,color:text2,padding:'2px 8px',borderRadius:6,background:bgSoft,border:`1px solid ${lineSoft}`}}>{k} <strong style={{color:ink}}>{typeof v==='object'?JSON.stringify(v):String(v)}</strong></span>)}
                      </div>
                    </div>}
                </div>
              </Card>;})}
        </div>}

      <EquipmentModal open={modalOpen}onClose={closeModal}initial={editing}onSaved={onSaved}/>
    </Page>;};
export default LabEquipment;
export { LabEquipment };
