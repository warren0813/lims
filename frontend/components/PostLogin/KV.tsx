// @ts-nocheck
"use client";


const KV=({label,value})=><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontSize:12.5}}>
    <span style={{color:'var(--text-muted)'}}>{label}</span>
    <span style={{color:'var(--text-primary)'}}>{value}</span>
  </div>;
export default KV;
export { KV };
