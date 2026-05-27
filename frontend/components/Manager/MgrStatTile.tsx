// @ts-nocheck
"use client";
import React from 'react';
import mLine from '@/components/Manager/mLine';
import accent from '@/components/Lab/accent';
import mText2 from '@/components/Manager/mText2';
import mInk from '@/components/Manager/mInk';

const MgrStatTile=({label,value,icon,tint,accent,onClick})=><button onClick={onClick}disabled={!onClick}style={{position:'relative',textAlign:'left',padding:'16px 18px',borderRadius:14,background:'#fff',border:`1px solid ${mLine}`,cursor:onClick?'pointer':'default',fontFamily:'inherit',overflow:'hidden',transition:'transform 0.15s, border-color 0.15s, box-shadow 0.15s'}}onMouseEnter={e=>{if(onClick){e.currentTarget.style.borderColor='rgba(108,103,184,0.35)';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 10px 24px -14px rgba(108,103,184,0.35)';}}}onMouseLeave={e=>{if(onClick){e.currentTarget.style.borderColor=mLine;e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
      <span style={{width:30,height:30,borderRadius:9,background:tint,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{React.cloneElement(icon,{color:accent})}</span>
      <span style={{fontSize:12,color:mText2,fontWeight:600}}>{label}</span>
    </div>
    <div style={{fontFamily:'var(--font-display)',fontSize:34,fontWeight:700,color:mInk,letterSpacing:'-0.02em',lineHeight:1}}>{value}</div>
  </button>;
export default MgrStatTile;
export { MgrStatTile };
