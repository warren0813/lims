// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import useMgrExperimentTypes from '@/components/Manager/useMgrExperimentTypes';
import slugForExperimentName from '@/components/Manager/slugForExperimentName';
import RECIPE_PARAM_SCHEMA from '@/components/Manager/RECIPE_PARAM_SCHEMA';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FieldLabel from '@/components/Manager/FieldLabel';
import TextInput from '@/components/Manager/TextInput';
import mMuted from '@/components/Manager/mMuted';
import SelectInput from '@/components/Manager/SelectInput';
import TextArea from '@/components/Manager/TextArea';
import mLine from '@/components/Manager/mLine';
import mBgSoft from '@/components/Manager/mBgSoft';

const RecipeModal=({open,onClose,onSaved,initial})=>{const{data:experimentTypes,loading:typesLoading}=useMgrExperimentTypes();const[name,setName]=React.useState('');const[experimentTypeId,setExperimentTypeId]=React.useState('');const[desc,setDesc]=React.useState('');const[paramsKv,setParamsKv]=React.useState({});const[paramsJson,setParamsJson]=React.useState('{}');const[busy,setBusy]=React.useState(false);const[err,setErr]=React.useState(null);const isEdit=!!initial;const activeExpName=isEdit?initial.experimentName:experimentTypes.find(t=>t.id===experimentTypeId)?.name;const slug=slugForExperimentName(activeExpName);const schema=slug?RECIPE_PARAM_SCHEMA[slug]||[]:[];React.useEffect(()=>{if(!open)return;setErr(null);setBusy(false);if(initial){setName(initial.name);setExperimentTypeId(initial.experimentId);setDesc(initial.description||'');const incomingParams=initial.params||{};setParamsKv({...incomingParams});try{setParamsJson(JSON.stringify(incomingParams,null,2)||'{}');}catch(_e){setParamsJson('{}');}}else{setName('');setExperimentTypeId(experimentTypes[0]?.id??'');setDesc('');setParamsKv({});setParamsJson('{}');}},[open,initial]);React.useEffect(()=>{if(!open||isEdit)return;if(!experimentTypeId&&experimentTypes.length>0){setExperimentTypeId(experimentTypes[0].id);}},[open,isEdit,experimentTypeId,experimentTypes]);React.useEffect(()=>{if(!open||schema.length===0)return;setParamsKv(prev=>{const next={...prev};schema.forEach(s=>{if(next[s.key]==null)next[s.key]='';});return next;});},[open,slug,schema]);const valid=name.trim().length>0&&name.trim().length<=200&&(isEdit||!!experimentTypeId);const submit=async()=>{setBusy(true);setErr(null);let parameters;if(schema.length>0){parameters=Object.fromEntries(schema.map(s=>[s.key,paramsKv[s.key]??'']));}else{const trimmed=paramsJson.trim();if(!trimmed){parameters={};}else{try{parameters=JSON.parse(trimmed);}catch(_e){setErr('Parameters must be valid JSON.');setBusy(false);return;}if(parameters===null||typeof parameters!=='object'||Array.isArray(parameters)){setErr('Parameters must be a JSON object.');setBusy(false);return;}}}try{if(isEdit){await api.recipes.update(initial.id,{name:name.trim(),description:desc.trim(),parameters});}else{await api.recipes.create({name:name.trim(),description:desc.trim(),experimentTypeId,parameters});}onSaved&&onSaved();}catch(e){setErr(e.message||String(e));}finally{setBusy(false);}};const lockedExpName=isEdit?initial.experimentName||'—':null;const lockedExpCode=lockedExpName?slug?slug.toUpperCase():lockedExpName.split(/\s+/).map(t=>t[0]).join('').slice(0,4).toUpperCase():'';return<Modal open={open}onClose={onClose}title={isEdit?'Edit Recipe':'New Recipe'}width={620}footer={<>
        <SecondaryBtn onClick={onClose}disabled={busy}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid||busy||typesLoading}onClick={submit}>
          {busy?isEdit?'Saving…':'Creating…':isEdit?'Save Changes':'Create Recipe'}
        </PrimaryBtn>
      </>}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {err&&<div style={{padding:'10px 12px',borderRadius:8,background:'#fde4e4',color:'#c0394a',fontSize:13,fontWeight:500,border:'1px solid #f6c4c4'}}>{err}</div>}
        <div>
          <FieldLabel required>Name</FieldLabel>
          <TextInput value={name}onChange={e=>setName(e.target.value)}placeholder="e.g. TCT_Standard_Reflow_Simulation_v1"/>
        </div>
        <div>
          <FieldLabel required>Experiment Type</FieldLabel>
          {isEdit?<div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 10px 6px 6px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f'}}title="Experiment type can't be changed after creation.">
              <span style={{fontSize:10.5,fontWeight:700,padding:'3px 8px',borderRadius:999,background:'#fff',color:'#4f4a8f',letterSpacing:'0.05em'}}>{lockedExpCode}</span>
              <span style={{fontSize:13,fontWeight:600}}>{lockedExpName}</span>
              <span style={{fontSize:11,color:mMuted,marginLeft:4}}>(locked)</span>
            </div>:<SelectInput value={experimentTypeId===''?'':String(experimentTypeId)}onChange={e=>setExperimentTypeId(e.target.value?Number(e.target.value):'')}>
              {typesLoading&&<option value="">Loading…</option>}
              {!typesLoading&&experimentTypes.length===0&&<option value="">No experiment types</option>}
              {experimentTypes.map(t=><option key={t.id}value={t.id}>{t.name}</option>)}
            </SelectInput>}
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <TextArea value={desc}onChange={e=>setDesc(e.target.value)}placeholder="When this recipe is used and why."/>
        </div>
        <div>
          <FieldLabel>Parameters</FieldLabel>
          {schema.length>0?<>
              <div style={{padding:'14px 14px 10px',borderRadius:10,border:`1px solid ${mLine}`,background:mBgSoft,display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:12}}>
                {schema.map(s=><div key={s.key}>
                    <div style={{fontSize:11,fontWeight:600,color:mMuted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{s.label}</div>
                    <TextInput value={paramsKv[s.key]??''}onChange={e=>setParamsKv(p=>({...p,[s.key]:e.target.value}))}placeholder={s.placeholder}style={{fontFamily:'var(--font-mono)',fontSize:13}}/>
                  </div>)}
              </div>
              <div style={{fontSize:12,color:mMuted,marginTop:6}}>
                Schema-driven fields for {activeExpName||'this experiment type'}.
              </div>
            </>:<>
              <TextArea value={paramsJson}onChange={e=>setParamsJson(e.target.value)}placeholder='{"key": "value"}'style={{fontFamily:'var(--font-mono)',fontSize:12.5,minHeight:120}}/>
              <div style={{fontSize:12,color:mMuted,marginTop:6}}>
                No schema defined for {activeExpName||'this experiment type'} — enter a JSON object. Leave as <code>{'{}'}</code> for none.
              </div>
            </>}
        </div>
      </div>
    </Modal>;};
export default RecipeModal;
export { RecipeModal };
