// @ts-nocheck
"use client";


const TopBar=({title,subtitle,breadcrumb,right})=><header style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'24px 32px 0',gap:24}}>
    <div style={{minWidth:0,flex:1}}>
      {breadcrumb&&<div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,color:'var(--text-secondary)',fontSize:13}}>
          {breadcrumb}
        </div>}
      <h1 style={{fontSize:22,fontWeight:700,letterSpacing:'-0.01em',color:'var(--text-primary)',lineHeight:1.2}}>{title}</h1>
      {subtitle&&<div style={{marginTop:4,fontSize:13.5,color:'var(--text-secondary)'}}>{subtitle}</div>}
    </div>
    {right&&<div style={{display:'flex',gap:8,alignItems:'center'}}>{right}</div>}
  </header>;
export default TopBar;
export { TopBar };
