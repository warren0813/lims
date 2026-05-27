// @ts-nocheck
"use client";
import STATUS_LABEL from '@/components/Manager/STATUS_LABEL';

const Pill=({kind,mapping=STATUS_LABEL,dotted})=>{const p=mapping[kind]||{label:kind,bg:'#ebebf0',fg:'#5a5a6e'};return<span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 9px',borderRadius:999,background:p.bg,color:p.fg,fontSize:11.5,fontWeight:700,letterSpacing:'0.02em',whiteSpace:'nowrap'}}>
      {dotted&&<span style={{width:6,height:6,borderRadius:999,background:p.fg}}/>}
      {p.label}
    </span>;};
export default Pill;
export { Pill };
