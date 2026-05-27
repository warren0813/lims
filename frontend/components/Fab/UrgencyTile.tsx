// @ts-nocheck
"use client";
import * as I from '@/components/ui/I';
const F=I;
const UrgencyTile=({opt,active,onClick})=><button onClick={onClick}style={{display:'flex',alignItems:'center',gap:12,flex:1,padding:'14px 16px',borderRadius:12,background:active?'#f5f4fb':'#fff',border:`1px solid ${active?'#6c67b8':'rgba(0,0,0,0.12)'}`,boxShadow:active?'0 0 0 3px rgba(108,103,184,0.12)':'none',cursor:'pointer',textAlign:'left',transition:'all 0.12s',fontFamily:'inherit'}}>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{opt.label}</div>
        <div style={{fontSize:12.5,color:'var(--text-muted)',marginTop:2}}>{opt.sub}</div>
      </div>
      <span style={{width:20,height:20,borderRadius:999,flexShrink:0,border:`2px solid ${active?'#6c67b8':'rgba(0,0,0,0.16)'}`,background:active?'#6c67b8':'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {active&&<F.Check size={11}color="#fff"strokeWidth={3}/>}
      </span>
    </button>;
export default UrgencyTile;
export { UrgencyTile };
