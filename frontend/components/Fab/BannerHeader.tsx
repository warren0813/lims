// @ts-nocheck
"use client";
import React from 'react';
import accent from '@/components/Lab/accent';

const BannerHeader=({icon,title,count,accent,twinkle=true,right,accentLight})=><div style={{position:'relative',overflow:'hidden',padding:'20px 24px 18px',background:'#1e1e24',color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
      {}
      <div style={{position:'absolute',inset:0,opacity:0.45,backgroundImage:'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',backgroundSize:'14px 14px',pointerEvents:'none'}}/>
      {}
      <div style={{position:'absolute',right:-60,top:-40,width:220,height:220,borderRadius:999,background:`radial-gradient(circle at center, ${accent}55, transparent 65%)`,filter:'blur(6px)',pointerEvents:'none'}}/>
      {twinkle&&<>
          <span style={{position:'absolute',right:86,top:14,width:3,height:3,borderRadius:999,background:accentLight||accent,opacity:0.85,animation:'lims-twinkle 3.2s ease-in-out infinite'}}/>
          <span style={{position:'absolute',right:158,bottom:12,width:3,height:3,borderRadius:999,background:'#fff',opacity:0.55,animation:'lims-twinkle 4.1s ease-in-out 0.6s infinite'}}/>
        </>}
      <div style={{position:'relative',display:'flex',alignItems:'center',gap:12}}>
        <span style={{width:32,height:32,borderRadius:9,background:`${accent}33`,border:`1px solid ${accent}66`,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{React.cloneElement(icon,{color:accentLight||accent})}</span>
        <span style={{fontSize:16,fontWeight:700,letterSpacing:'-0.01em'}}>{title}</span>
        {count!=null&&<span style={{minWidth:24,padding:'0 8px',height:22,borderRadius:999,background:accent,color:'#1e1e24',fontSize:11.5,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{count}</span>}
      </div>
      {right&&<div style={{position:'relative'}}>{right}</div>}
    </div>;
export default BannerHeader;
export { BannerHeader };
