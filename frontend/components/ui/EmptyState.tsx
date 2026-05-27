// @ts-nocheck
"use client";
import React from 'react';

const EmptyState=({icon,title,message,action})=><div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'48px 24px',gap:10,color:'var(--text-muted)',textAlign:'center'}}>
    {icon&&<div style={{color:'var(--text-muted)'}}>{React.cloneElement(icon,{size:28})}</div>}
    <div style={{fontSize:14,fontWeight:500,color:'var(--text-secondary)'}}>{title}</div>
    {message&&<div style={{fontSize:13,color:'var(--text-muted)',maxWidth:320}}>{message}</div>}
    {action}
  </div>;
export default EmptyState;
export { EmptyState };
