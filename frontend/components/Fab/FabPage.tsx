// @ts-nocheck
"use client";


const FabPage=({title,subtitle,breadcrumb,right,children})=><div style={{padding:'32px 44px 80px',maxWidth:1280,margin:'0 auto'}}>
      {breadcrumb}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:24,marginBottom:24}}>
        <div style={{minWidth:0,flex:1}}>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:28,fontWeight:700,letterSpacing:'-0.02em',color:'var(--text-primary)',lineHeight:1.2,margin:0}}>{title}</h1>
          {subtitle&&<div style={{marginTop:6,fontSize:14,color:'var(--text-secondary)'}}>{subtitle}</div>}
        </div>
        {right&&<div style={{display:'flex',gap:10,alignItems:'center',flexShrink:0}}>{right}</div>}
      </div>
      {children}
    </div>;
export default FabPage;
export { FabPage };
