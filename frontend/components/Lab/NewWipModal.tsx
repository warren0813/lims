// @ts-nocheck
"use client";
import React from 'react';
import findExp from '@/components/Lab/findExp';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FieldLabel from '@/components/Manager/FieldLabel';
import SelectInput from '@/components/Manager/SelectInput';
import EXPERIMENTS from '@/components/Lab/EXPERIMENTS';
import muted from '@/components/Lab/muted';
import line from '@/components/Lab/line';
import lineSoft from '@/components/Lab/lineSoft';
import accent from '@/components/Lab/accent';
import ink from '@/components/Lab/ink';
import text2 from '@/components/Lab/text2';
import Pill from '@/components/Manager/Pill';
import TextArea from '@/components/Manager/TextArea';

const NewWipModal=({open,onClose,wafers,onSubmit})=>{const[waferIds,setWaferIds]=React.useState([]);const[experimentId,setExperimentId]=React.useState('tct');const[note,setNote]=React.useState('');const eligibleWafers=wafers.filter(w=>w.status==='received');React.useEffect(()=>{if(open){setWaferIds([]);setExperimentId('tct');setNote('');}},[open]);const valid=waferIds.length>0;const toggleWafer=id=>{setWaferIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);};const waferNeedsExp=w=>Array.isArray(w.expIds)&&w.expIds.includes(experimentId);const exp=findExp(experimentId);return<Modal open={open}onClose={onClose}title="New WIP"width={620}footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid}onClick={()=>onSubmit({waferIds,experimentId,note})}>Create WIP</PrimaryBtn>
      </>}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <FieldLabel required>Experiment Type</FieldLabel>
          <SelectInput value={experimentId}onChange={e=>setExperimentId(e.target.value)}>
            {EXPERIMENTS.map(x=><option key={x.id}value={x.id}>{x.name} ({x.code})</option>)}
          </SelectInput>
          <div style={{fontSize:12,color:muted,marginTop:6}}>
            Equipment will be assigned when you create a dispatch.
          </div>
        </div>
        <div>
          <FieldLabel required>Wafers</FieldLabel>
          <div style={{border:`1px solid ${line}`,borderRadius:8,maxHeight:240,overflow:'auto'}}>
            {eligibleWafers.length===0?<div style={{padding:20,textAlign:'center',color:muted,fontSize:13}}>No received wafers available</div>:eligibleWafers.map(w=>{const checked=waferIds.includes(w.id);const matches=waferNeedsExp(w);return<label key={w.id}style={{display:'grid',gridTemplateColumns:'20px 1fr auto auto',gap:10,alignItems:'center',padding:'10px 14px',borderTop:`1px solid ${lineSoft}`,cursor:'pointer',background:checked?'#f7f6fb':'#fff',opacity:matches?1:0.5}}title={matches?'':`Request does not include ${exp?.name}`}>
                  <input type="checkbox"checked={checked}onChange={()=>toggleWafer(w.id)}style={{accentColor:accent}}/>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:600,color:ink}}>{w.id}</span>
                  <span style={{fontSize:12,color:text2}}>{w.size}</span>
                  <Pill kind={w.urgency}/>
                </label>;})}
          </div>
          <div style={{fontSize:12,color:muted,marginTop:6}}>
            {waferIds.length} selected — faded rows don't require this experiment.
          </div>
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <TextArea placeholder="Optional context for the WIP"value={note}onChange={e=>setNote(e.target.value)}/>
        </div>
      </div>
    </Modal>;};
export default NewWipModal;
export { NewWipModal };
