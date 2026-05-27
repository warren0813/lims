// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import useDispatchCreationData from '@/components/Lab/useDispatchCreationData';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import line from '@/components/Lab/line';
import text2 from '@/components/Lab/text2';
import ink from '@/components/Lab/ink';
import muted from '@/components/Lab/muted';
import FieldLabel from '@/components/Manager/FieldLabel';
import SelectInput from '@/components/Manager/SelectInput';
import lineSoft from '@/components/Lab/lineSoft';
import TextInput from '@/components/Manager/TextInput';
import accent from '@/components/Lab/accent';
import TextArea from '@/components/Manager/TextArea';

const AddDispatchModalInner=({onClose,wip,onCreated})=>{const{equipment,recipes,loading,error:loadError}=useDispatchCreationData(wip.experimentId);const[equipmentId,setEquipmentId]=React.useState('');const[recipeId,setRecipeId]=React.useState('');const[duration,setDuration]=React.useState('');const[note,setNote]=React.useState('');const[busy,setBusy]=React.useState(false);const[submitErr,setSubmitErr]=React.useState(null);const selectedRecipe=recipes.find(r=>r.id===recipeId);const selectedEquipment=equipment.find(e=>e.id===equipmentId);const wipCode=`WIP-${String(wip.id).padStart(4,'0')}`;const durationSec=duration===''?null:parseInt(duration,10);const durationValid=duration===''||Number.isFinite(durationSec)&&durationSec>0;const valid=equipmentId!==''&&recipeId!==''&&durationValid&&!loading;const submit=async()=>{setBusy(true);setSubmitErr(null);try{await api.wips.createDispatch(wip.id,{equipmentId,recipeId,estimatedDurationSeconds:duration===''?undefined:durationSec,note:note.trim()});onCreated&&onCreated();}catch(e){setSubmitErr(e.message||String(e));}finally{setBusy(false);}};const eqStatusChip=e=>{if(e.status==='maintenance'){return<span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:999,background:'#fbe4e6',color:'#a93445',marginLeft:6}}>maint</span>;}return null;};return<Modal open={true}onClose={onClose}title="Add Dispatch"width={680}footer={<>
        <SecondaryBtn onClick={onClose}disabled={busy}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid||busy}onClick={submit}>
          {busy?'Creating…':'Create Dispatch'}
        </PrimaryBtn>
      </>}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {}
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',padding:'12px 14px',borderRadius:10,background:'#f7f6fb',border:`1px solid ${line}`}}>
          <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,fontWeight:700,padding:'4px 10px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f'}}>{wipCode}</span>
          <span style={{fontSize:13,color:text2}}>
            <strong style={{color:ink,fontFamily:'var(--font-mono)'}}>{wip.sampleCount}</strong> sample{wip.sampleCount===1?'':'s'}
          </span>
          <span style={{color:muted}}>·</span>
          <span style={{fontSize:13,color:ink,fontWeight:600}}>{wip.experimentName||'—'}</span>
        </div>

        {(loadError||submitErr)&&<div style={{padding:'10px 12px',borderRadius:8,background:'#fde4e4',color:'#c0394a',fontSize:13,fontWeight:500,border:'1px solid #f6c4c4'}}>{loadError||submitErr}</div>}
        {loading&&<div style={{padding:'12px',textAlign:'center',color:muted,fontSize:13}}>Loading equipment + recipes…</div>}

        <div>
          <FieldLabel required>Equipment</FieldLabel>
          <SelectInput value={equipmentId===''?'':String(equipmentId)}onChange={e=>setEquipmentId(e.target.value?Number(e.target.value):'')}>
            <option value="">— pick equipment —</option>
            {equipment.map(e=><option key={e.id}value={e.id}>
                {e.name} · {e.model||'—'}{e.status==='maintenance'?' (maintenance)':''}
              </option>)}
          </SelectInput>
          {selectedEquipment&&eqStatusChip(selectedEquipment)&&<div style={{marginTop:6,fontSize:12,color:'#a93445'}}>
              {selectedEquipment.name} is currently in maintenance — submission still allowed, but a tech check is advised.
            </div>}
          {!loading&&equipment.length===0&&<div style={{marginTop:6,fontSize:12,color:'#a93445'}}>
              No equipment capable of running this experiment.
            </div>}
        </div>

        <div>
          <FieldLabel required>Recipe</FieldLabel>
          <SelectInput value={recipeId===''?'':String(recipeId)}onChange={e=>setRecipeId(e.target.value?Number(e.target.value):'')}>
            <option value="">— pick a recipe —</option>
            {recipes.map(r=><option key={r.id}value={r.id}>{r.name}</option>)}
          </SelectInput>
          {!loading&&recipes.length===0&&<div style={{marginTop:6,fontSize:12,color:'#a93445'}}>
              No recipes for this experiment yet.
            </div>}
        </div>

        {selectedRecipe&&<div style={{padding:'12px 14px',borderRadius:10,border:`1px solid ${line}`,background:'#fbfbfd'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <span style={{fontSize:11,fontWeight:700,color:text2,letterSpacing:'0.08em',textTransform:'uppercase'}}>Recipe Parameters</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:muted}}>{selectedRecipe.name}</span>
            </div>
            {Object.entries(selectedRecipe.params||{}).length===0?<div style={{fontSize:12.5,color:muted,fontStyle:'italic'}}>No parameters.</div>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:10}}>
                {Object.entries(selectedRecipe.params).map(([k,v])=><div key={k}style={{padding:'8px 10px',background:'#fff',border:`1px solid ${lineSoft}`,borderRadius:8}}>
                    <div style={{fontSize:10.5,color:muted,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>{k.replace(/_/g,' ')}</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:ink,marginTop:3}}>{typeof v==='object'?JSON.stringify(v):String(v)}</div>
                  </div>)}
              </div>}
          </div>}

        <div>
          <FieldLabel>Estimated duration (seconds)</FieldLabel>
          <TextInput type="number"min="1"placeholder="Seconds — leave blank if unknown"value={duration}onChange={e=>setDuration(e.target.value)}/>
          <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
            {[{label:'20s',value:'20'},{label:'1m',value:'60'},{label:'1h',value:'3600'},{label:'1d',value:'86400'}].map(preset=><button key={preset.value}type="button"onClick={()=>setDuration(preset.value)}style={{padding:'6px 12px',borderRadius:999,background:duration===preset.value?'#ecebf3':'#f5f5fa',color:accent,border:`1px solid ${duration===preset.value?'#bcb8e2':line}`,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{preset.label}</button>)}
          </div>
          <div style={{fontSize:12,color:muted,marginTop:6}}>
            Leave blank if unknown. The countdown bar will show — if not set.
          </div>
        </div>

        <div>
          <FieldLabel>Note (optional)</FieldLabel>
          <TextArea value={note}onChange={e=>setNote(e.target.value)}placeholder="Anything the operator should know."/>
        </div>
      </div>
    </Modal>;};
export default AddDispatchModalInner;
export { AddDispatchModalInner };
