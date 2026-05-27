// @ts-nocheck
"use client";
import React from 'react';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FieldLabel from '@/components/Manager/FieldLabel';
import lineSoft from '@/components/Lab/lineSoft';
import muted from '@/components/Lab/muted';
import ink from '@/components/Lab/ink';
import TextArea from '@/components/Manager/TextArea';

const RecordResultModal=({open,onClose,dispatch,waferResults=[],onSubmit})=>{const[comment,setComment]=React.useState('');React.useEffect(()=>{if(open)setComment('');},[open]);return<Modal open={open}onClose={onClose}title="Record Experiment Result"width={560}footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={()=>onSubmit({comment:comment.trim()})}>Submit Result</PrimaryBtn>
      </>}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {waferResults.length>0&&<div>
            <FieldLabel>Per-Wafer Results</FieldLabel>
            <div style={{border:`1px solid ${lineSoft}`,borderRadius:8,overflow:'hidden'}}>
              {waferResults.map(w=>{const v=w.verdict;const pillBg=v==='pass'?'#e7f0e9':v==='fail'?'#fbe4e6':'#f1f1f5';const pillFg=v==='pass'?'#2e6a47':v==='fail'?'#a93445':muted;const pillLabel=v==='pass'?'✓ Pass':v==='fail'?'✗ Fail':'—';return<div key={w.sampleId}style={{display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:10,padding:'10px 14px',borderTop:`1px solid ${lineSoft}`}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:ink}}>{w.wafer}</span>
                    <span style={{padding:'3px 10px',borderRadius:999,background:pillBg,color:pillFg,fontSize:11.5,fontWeight:700}}>{pillLabel}</span>
                  </div>;})}
            </div>
          </div>}
        <div>
          <FieldLabel>Comment</FieldLabel>
          <TextArea placeholder="Observations from the run (optional)"value={comment}onChange={e=>setComment(e.target.value)}/>
          <div style={{fontSize:12,color:muted,marginTop:6}}>
            Per-wafer pass/fail is determined automatically — this is just for operator notes.
          </div>
        </div>
      </div>
    </Modal>;};
export default RecordResultModal;
export { RecordResultModal };
