// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import useLabExperimentTypes from '@/components/Lab/useLabExperimentTypes';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FieldLabel from '@/components/Manager/FieldLabel';
import TextInput from '@/components/Manager/TextInput';
import muted from '@/components/Lab/muted';
import SelectInput from '@/components/Manager/SelectInput';
import line from '@/components/Lab/line';
import lineSoft from '@/components/Lab/lineSoft';
import accent from '@/components/Lab/accent';
import ink from '@/components/Lab/ink';
import TextArea from '@/components/Manager/TextArea';

const EquipmentModal=({open,onClose,onSaved,initial})=>{const{data:experimentTypes,loading:typesLoading}=useLabExperimentTypes();const[name,setName]=React.useState('');const[modelName,setModelName]=React.useState('');const[capacity,setCapacity]=React.useState('1');const[status,setStatus]=React.useState('available');const[capIds,setCapIds]=React.useState([]);const[paramsJson,setParamsJson]=React.useState('{}');const[busy,setBusy]=React.useState(false);const[err,setErr]=React.useState(null);const isEdit=!!initial;const initialCapIds=(initial?.capabilities||[]).map(c=>c.id);const capsChanged=isEdit&&(capIds.length!==initialCapIds.length||capIds.some(id=>!initialCapIds.includes(id))||initialCapIds.some(id=>!capIds.includes(id)));React.useEffect(()=>{if(!open)return;setErr(null);setBusy(false);if(initial){setName(initial.name||'');setModelName(initial.model||'');setCapacity(String(initial.capacity??1));setStatus(initial.raw_status||'available');setCapIds(initialCapIds);try{setParamsJson(JSON.stringify(initial.parameters||{},null,2)||'{}');}catch(_e){setParamsJson('{}');}}else{setName('');setModelName('');setCapacity('1');setStatus('available');setCapIds([]);setParamsJson('{}');}},[open,initial]);const toggleCap=id=>{setCapIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);};const capacityNum=parseInt(capacity,10);const valid=name.trim().length>0&&name.trim().length<=200&&modelName.trim().length>0&&modelName.trim().length<=200&&Number.isFinite(capacityNum)&&capacityNum>0;const submit=async()=>{setBusy(true);setErr(null);let parameters;const trimmed=paramsJson.trim();if(!trimmed)parameters={};else{try{parameters=JSON.parse(trimmed);}catch(_e){setErr('Parameters must be valid JSON.');setBusy(false);return;}if(parameters===null||typeof parameters!=='object'||Array.isArray(parameters)){setErr('Parameters must be a JSON object.');setBusy(false);return;}}try{if(isEdit){await api.equipment.update(initial.id,{name:name.trim(),modelName:modelName.trim(),capacity:capacityNum,status,parameters});if(capsChanged){await api.equipment.setCapabilities(initial.id,capIds);}}else{await api.equipment.create({name:name.trim(),modelName:modelName.trim(),capacity:capacityNum,experimentTypeIds:capIds,parameters});}onSaved&&onSaved();}catch(e){setErr(e.message||String(e));}finally{setBusy(false);}};return<Modal open={open}onClose={onClose}title={isEdit?`Edit Equipment ${initial?.name||''}`:'New Equipment'}width={620}footer={<>
        <SecondaryBtn onClick={onClose}disabled={busy}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid||busy}onClick={submit}>
          {busy?isEdit?'Saving…':'Creating…':isEdit?'Save Changes':'Create Equipment'}
        </PrimaryBtn>
      </>}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {err&&<div style={{padding:'10px 12px',borderRadius:8,background:'#fde4e4',color:'#c0394a',fontSize:13,fontWeight:500,border:'1px solid #f6c4c4'}}>{err}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <FieldLabel required>Name</FieldLabel>
            <TextInput value={name}onChange={e=>setName(e.target.value)}placeholder="e.g. QA-TCT-03"/>
          </div>
          <div>
            <FieldLabel required>Model</FieldLabel>
            <TextInput value={modelName}onChange={e=>setModelName(e.target.value)}placeholder="e.g. ESPEC ARS-1100"/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <FieldLabel required>Capacity</FieldLabel>
            <TextInput type="number"min="1"value={capacity}onChange={e=>setCapacity(e.target.value)}/>
            <div style={{fontSize:12,color:muted,marginTop:4}}>Wafers per batch.</div>
          </div>
          {isEdit&&<div>
              <FieldLabel required>Status</FieldLabel>
              <SelectInput value={status}onChange={e=>setStatus(e.target.value)}>
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                <option value="disabled">Disabled</option>
              </SelectInput>
            </div>}
        </div>
        <div>
          <FieldLabel>Capabilities</FieldLabel>
          <div style={{border:`1px solid ${line}`,borderRadius:8,maxHeight:180,overflow:'auto'}}>
            {typesLoading?<div style={{padding:14,color:muted,fontSize:13,textAlign:'center'}}>Loading…</div>:experimentTypes.length===0?<div style={{padding:14,color:muted,fontSize:13,textAlign:'center'}}>No experiment types defined yet.</div>:experimentTypes.map(t=><label key={t.id}style={{display:'grid',gridTemplateColumns:'20px 1fr',gap:10,alignItems:'center',padding:'10px 14px',borderTop:`1px solid ${lineSoft}`,cursor:'pointer',background:capIds.includes(t.id)?'#f7f6fb':'#fff'}}>
                <input type="checkbox"checked={capIds.includes(t.id)}onChange={()=>toggleCap(t.id)}style={{accentColor:accent}}/>
                <span style={{fontSize:13,color:ink}}>{t.name}</span>
              </label>)}
          </div>
          <div style={{fontSize:12,color:muted,marginTop:6}}>
            Experiment types this unit can run. {isEdit&&capsChanged?'Changes will save via a separate request after the equipment update.':''}
          </div>
        </div>
        <div>
          <FieldLabel>Parameters (JSON)</FieldLabel>
          <TextArea value={paramsJson}onChange={e=>setParamsJson(e.target.value)}placeholder='{"key": "value"}'style={{fontFamily:'var(--font-mono)',fontSize:12.5,minHeight:100}}/>
          <div style={{fontSize:12,color:muted,marginTop:6}}>
            Dispatch-time tweakable parameters this equipment exposes. JSON object format.
          </div>
        </div>
      </div>
    </Modal>;};
export default EquipmentModal;
export { EquipmentModal };
