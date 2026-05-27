// @ts-nocheck
"use client";
import React from 'react';
import * as I from '@/components/ui/I';
import EXPERIMENTS from '@/components/Lab/EXPERIMENTS';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FieldLabel from '@/components/Manager/FieldLabel';
import TextInput from '@/components/Manager/TextInput';
import SelectInput from '@/components/Manager/SelectInput';
import muted from '@/components/Lab/muted';
import TextArea from '@/components/Manager/TextArea';
import line from '@/components/Lab/line';
import bgSoft from '@/components/Lab/bgSoft';
import text2 from '@/components/Lab/text2';
const LF=I;
const NewEquipmentModal=({open,onClose,onSubmit,existingIds})=>{const[name,setName]=React.useState('');const[type,setType]=React.useState(EXPERIMENTS[0].code);const[description,setDescription]=React.useState('');const[capacity,setCapacity]=React.useState('1');const[paramRows,setParamRows]=React.useState([{key:'',value:''}]);React.useEffect(()=>{if(!open)return;setName('');setType(EXPERIMENTS[0].code);setDescription('');setCapacity('1');setParamRows([{key:'',value:''}]);},[open]);const capNum=parseInt(capacity,10);const idClash=existingIds&&existingIds.includes(name.trim());const valid=name.trim().length>0&&!idClash&&capNum>0;const setRow=(i,field,val)=>setParamRows(rs=>rs.map((r,j)=>j===i?{...r,[field]:val}:r));const removeRow=i=>setParamRows(rs=>rs.length===1?rs:rs.filter((_,j)=>j!==i));const addRow=()=>setParamRows(rs=>[...rs,{key:'',value:''}]);const handle=()=>{const params=Object.fromEntries(paramRows.filter(r=>r.key.trim()).map(r=>[r.key.trim(),r.value.trim()]));const model=(description.split('\n')[0]||`${type} unit`).trim();onSubmit({id:name.trim(),name:name.trim(),type,model,description:description.trim(),capacity:capNum,params,status:'idle',currentWipId:null});};return<Modal open={open}onClose={onClose}title="Add Equipment"width={620}footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid}onClick={handle}>Create Equipment</PrimaryBtn>
      </>}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <FieldLabel required>Name</FieldLabel>
          <TextInput value={name}onChange={e=>setName(e.target.value)}placeholder="e.g. QA-TCT-03"style={{fontFamily:'var(--font-mono)'}}/>
          {idClash&&<div style={{fontSize:12,color:'#c0394a',marginTop:6}}>
              An equipment with this name already exists.
            </div>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div>
            <FieldLabel required>Experiment</FieldLabel>
            <SelectInput value={type}onChange={e=>setType(e.target.value)}>
              {EXPERIMENTS.map(x=><option key={x.id}value={x.code}>{x.name} ({x.code})</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel required>Capacity</FieldLabel>
            <TextInput type="number"min="1"step="1"value={capacity}onChange={e=>setCapacity(e.target.value)}placeholder="6"style={{fontFamily:'var(--font-mono)'}}/>
            <div style={{fontSize:12,color:muted,marginTop:6}}>Max wafers per WIP.</div>
          </div>
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <TextArea value={description}onChange={e=>setDescription(e.target.value)}placeholder="Model name + any notes. First line becomes the card's model label."/>
        </div>

        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
            <FieldLabel>Parameters</FieldLabel>
            <span style={{fontSize:11.5,color:muted}}>Defaults that operators can override per dispatch.</span>
          </div>
          <div style={{padding:12,borderRadius:10,border:`1px solid ${line}`,background:bgSoft,display:'flex',flexDirection:'column',gap:8}}>
            {paramRows.map((row,i)=><div key={i}style={{display:'grid',gridTemplateColumns:'1fr 1fr 32px',gap:8,alignItems:'center'}}>
                <TextInput value={row.key}onChange={e=>setRow(i,'key',e.target.value)}placeholder="key (e.g. max_temp)"style={{fontFamily:'var(--font-mono)',fontSize:12.5}}/>
                <TextInput value={row.value}onChange={e=>setRow(i,'value',e.target.value)}placeholder="value (e.g. 125 °C)"style={{fontFamily:'var(--font-mono)',fontSize:12.5}}/>
                <button onClick={()=>removeRow(i)}disabled={paramRows.length===1}title="Remove"style={{width:32,height:32,borderRadius:8,color:paramRows.length===1?'#cbcbd6':'#a8a8b8',background:'transparent',border:'none',cursor:paramRows.length===1?'not-allowed':'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}><LF.Trash size={14}/></button>
              </div>)}
            <button onClick={addRow}style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 12px',borderRadius:8,border:'1px dashed rgba(0,0,0,0.18)',background:'transparent',color:text2,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}><LF.Plus size={12}/> Add parameter</button>
          </div>
        </div>
      </div>
    </Modal>;};
export default NewEquipmentModal;
export { NewEquipmentModal };
