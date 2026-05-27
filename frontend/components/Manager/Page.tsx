// @ts-nocheck
"use client";
import mInk from '@/components/Manager/mInk';
import mText2 from '@/components/Manager/mText2';

const Page=({title,subtitle,breadcrumb,right,children})=><div style={{padding:'32px 44px 80px',maxWidth:1320,margin:'0 auto'}}>
    {breadcrumb}
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:24,marginBottom:24}}>
      <div style={{minWidth:0}}>
        {title&&<h1 style={{fontFamily:'var(--font-display)',fontSize:28,fontWeight:700,letterSpacing:'-0.02em',margin:0,color:mInk}}>{title}</h1>}
        {subtitle&&<div style={{fontSize:13,color:mText2,marginTop:6}}>{subtitle}</div>}
      </div>
      {right&&<div style={{display:'inline-flex',gap:10,flexShrink:0}}>{right}</div>}
    </div>
    {children}
  </div>;
export default Page;
export { Page };
