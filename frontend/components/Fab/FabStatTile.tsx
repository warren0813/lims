// @ts-nocheck
"use client";
import React from 'react';
import accent from '@/components/Lab/accent';

const FabStatTile=({label,value,icon,tint,accent,onClick})=><button onClick={onClick}style={{position:'relative',textAlign:'left',padding:'16px 18px',borderRadius:14,background:'#fff',border:'1px solid rgba(0,0,0,0.08)',cursor:'pointer',fontFamily:'inherit',overflow:'hidden',transition:'transform 0.15s, border-color 0.15s, box-shadow 0.15s'}}onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(108,103,184,0.35)';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 10px 24px -14px rgba(108,103,184,0.35)';}}onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{width:30,height:30,borderRadius:9,background:tint,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{React.cloneElement(icon,{color:accent})}</span>
        <span style={{fontSize:12,color:'var(--text-secondary)',fontWeight:600}}>{label}</span>
      </div>
      <div style={{fontFamily:'var(--font-display)',fontSize:34,fontWeight:700,color:'var(--text-primary)',letterSpacing:'-0.02em',lineHeight:1}}>{value}</div>
    </button>;
export default FabStatTile;
export { FabStatTile };
