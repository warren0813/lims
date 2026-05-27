// @ts-nocheck
"use client";
import React from 'react';
import * as I from '@/components/ui/I';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import accent from '@/components/Lab/accent';
import mInk from '@/components/Manager/mInk';
import mText2 from '@/components/Manager/mText2';
import FieldLabel from '@/components/Manager/FieldLabel';
import TextInput from '@/components/Manager/TextInput';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
const MI=I;
const ReportCard=({title,subtitle,accent,accentBg,icon,onGenerate})=>{const[start,setStart]=React.useState('');const[end,setEnd]=React.useState('');const[generated,setGenerated]=React.useState(null);const[busy,setBusy]=React.useState(false);const[err,setErr]=React.useState(null);const valid=start&&end;const handle=async()=>{if(!valid||busy)return;setBusy(true);setErr(null);try{const summary=await onGenerate({start,end});setGenerated(summary);}catch(e){setErr(e.message||String(e));setGenerated(null);}finally{setBusy(false);}};return<Card padding={0}>
      <CardHeader>
        <span style={{width:26,height:26,borderRadius:8,background:accentBg,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{React.cloneElement(icon,{color:accent})}</span>
        <span style={{color:mInk,fontSize:13,textTransform:'none',letterSpacing:0}}>{title}</span>
      </CardHeader>
      <div style={{padding:22}}>
        <div style={{fontSize:12.5,color:mText2,marginBottom:14}}>{subtitle}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <TextInput type="date"value={start}onChange={e=>setStart(e.target.value)}/>
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <TextInput type="date"value={end}onChange={e=>setEnd(e.target.value)}/>
          </div>
        </div>
        <PrimaryBtn disabled={!valid||busy}onClick={handle}icon={<MI.TrendUp size={14}/>}>{busy?'Generating…':'Generate'}</PrimaryBtn>
        {err&&<div style={{marginTop:14,padding:'10px 12px',borderRadius:8,background:'#fde4e4',color:'#c0394a',fontSize:13,fontWeight:500,border:'1px solid #f6c4c4'}}>{err}</div>}
        {generated&&<div style={{marginTop:16,padding:14,borderRadius:10,background:accentBg,border:`1px solid ${accent}33`}}>
            <div style={{fontSize:11,fontWeight:700,color:accent,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Result</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:12}}>
              {generated.map(g=><div key={g.label}>
                  <div style={{fontSize:11,color:mText2,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>{g.label}</div>
                  <div style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,color:mInk,letterSpacing:'-0.01em',marginTop:4}}>{g.value}</div>
                </div>)}
            </div>
          </div>}
      </div>
    </Card>;};
export default ReportCard;
export { ReportCard };
