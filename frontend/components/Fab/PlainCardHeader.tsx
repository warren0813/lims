// @ts-nocheck
"use client";


const PlainCardHeader=({children,right})=><div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 20px',borderBottom:'1px solid rgba(0,0,0,0.06)',fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
      {children}
      {right&&<div style={{marginLeft:'auto',textTransform:'none',letterSpacing:0}}>{right}</div>}
    </div>;
export default PlainCardHeader;
export { PlainCardHeader };
