// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import useMgrRecipes from '@/components/Manager/useMgrRecipes';
import Page from '@/components/Manager/Page';
import mMuted from '@/components/Manager/mMuted';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import Card from '@/components/Manager/Card';
import mText2 from '@/components/Manager/mText2';
import findExpById from '@/components/Manager/findExpById';
import mInk from '@/components/Manager/mInk';
import mBgSoft from '@/components/Manager/mBgSoft';
import mLineSft from '@/components/Manager/mLineSft';
import mAccent from '@/components/Manager/mAccent';
import RecipeModal from '@/components/Manager/RecipeModal';
const MI=I;
const MgrRecipes=({showToast})=>{const{data:recipes,loading,error,refresh}=useMgrRecipes();const[modalOpen,setModalOpen]=React.useState(false);const[editing,setEditing]=React.useState(null);const[busyDeleteId,setBusyDeleteId]=React.useState(null);const[deleteError,setDeleteError]=React.useState(null);const openNew=()=>{setEditing(null);setModalOpen(true);};const openEdit=rec=>{setEditing(rec);setModalOpen(true);};const closeModal=()=>{setEditing(null);setModalOpen(false);};const onSaved=()=>{const wasEdit=!!editing;closeModal();showToast&&showToast(wasEdit?'Recipe updated':'Recipe created');refresh();};const onDelete=async rec=>{if(!window.confirm(`Delete recipe "${rec.name}"? This can't be undone.`))return;setBusyDeleteId(rec.id);setDeleteError(null);try{await api.recipes.remove(rec.id);showToast&&showToast(`${rec.name} deleted`);refresh();}catch(e){setDeleteError(e.message||String(e));}finally{setBusyDeleteId(null);}};if(loading&&recipes.length===0){return<Page title="Recipes"subtitle="Loading…">
        <div style={{padding:'60px 20px',textAlign:'center',color:mMuted,fontSize:14}}>Loading…</div>
      </Page>;}return<Page title="Recipes"subtitle="食譜 — experiment recipes referenced by dispatches"right={<PrimaryBtn icon={<MI.Plus size={14}/>}onClick={openNew}>New Recipe</PrimaryBtn>}>
      {deleteError&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          {deleteError}
        </div>}
      {error&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          Couldn't load recipes: {error}
        </div>}

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {recipes.length===0?<Card padding={48}style={{textAlign:'center',color:mMuted}}>
            <MI.ClipboardList size={32}color="#cbcbd6"style={{marginBottom:10}}/>
            <div style={{fontSize:14,fontWeight:600,color:mText2}}>No recipes yet</div>
          </Card>:recipes.map(rec=>{const expCode=findExpById(rec.experimentId)?.code||(rec.experimentName?rec.experimentName.split(/\s+/).map(t=>t[0]).join('').slice(0,4).toUpperCase():'—');const expName=rec.experimentName||findExpById(rec.experimentId)?.name||'—';const paramEntries=rec.params?Object.entries(rec.params):[];return<div key={rec.id}style={{display:'grid',gridTemplateColumns:'minmax(0,1.4fr) 180px minmax(0,1.6fr) 110px',alignItems:'center',gap:18,padding:'18px 22px',borderRadius:14,background:'#fff',border:'1px solid rgba(0,0,0,0.08)'}}>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700,color:mInk,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{rec.name}</div>
                {rec.description&&<div style={{fontSize:12.5,color:mMuted,marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{rec.description}</div>}
              </div>
              <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:10.5,fontWeight:700,padding:'3px 8px',borderRadius:999,background:'#e8e7f6',color:'#5550a0',letterSpacing:'0.05em'}}>{expCode}</span>
                <span style={{fontSize:13,color:mInk}}>{expName}</span>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {paramEntries.slice(0,4).map(([k,v])=><span key={k}style={{fontFamily:'var(--font-mono)',fontSize:11.5,color:mText2,padding:'2px 8px',borderRadius:6,background:mBgSoft,border:`1px solid ${mLineSft}`}}>{k} <strong style={{color:mInk}}>{typeof v==='object'?JSON.stringify(v):String(v)}</strong></span>)}
                {paramEntries.length>4&&<span style={{fontSize:11.5,color:mMuted,alignSelf:'center'}}>+{paramEntries.length-4} more</span>}
                {paramEntries.length===0&&<span style={{fontSize:12,color:mMuted,fontStyle:'italic'}}>No parameters</span>}
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button onClick={()=>openEdit(rec)}disabled={busyDeleteId===rec.id}style={{background:'transparent',border:'none',cursor:busyDeleteId===rec.id?'not-allowed':'pointer',color:mAccent,fontWeight:600,fontSize:13,fontFamily:'inherit',padding:0,opacity:busyDeleteId===rec.id?0.5:1}}>Edit</button>
                <button onClick={()=>onDelete(rec)}disabled={busyDeleteId===rec.id}style={{background:'transparent',border:'none',cursor:busyDeleteId===rec.id?'not-allowed':'pointer',color:'#b9384a',fontWeight:600,fontSize:13,fontFamily:'inherit',padding:0,opacity:busyDeleteId===rec.id?0.5:1}}>{busyDeleteId===rec.id?'Deleting…':'Delete'}</button>
              </div>
            </div>;})}
      </div>

      <RecipeModal open={modalOpen}onClose={closeModal}initial={editing}onSaved={onSaved}/>
    </Page>;};
export default MgrRecipes;
export { MgrRecipes };
