// @ts-nocheck
"use client";
import * as I from '@/components/ui/I';
import CATEGORY_BADGE from '@/components/Fab/CATEGORY_BADGE';
const F=I;
const ExpCard=({exp,active,onClick})=>{const badge=CATEGORY_BADGE[exp.group]||{bg:'#ecedf0',fg:'#5a5a6e'};return<button onClick={onClick}style={{display:'block',textAlign:'left',width:'100%',padding:'14px 16px',borderRadius:12,fontFamily:'inherit',cursor:'pointer',background:active?'#f5f4fb':'#fff',border:`1px solid ${active?'#6c67b8':'rgba(0,0,0,0.12)'}`,boxShadow:active?'0 0 0 3px rgba(108,103,184,0.10)':'none',transition:'all 0.12s'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:10.5,fontWeight:700,padding:'3px 8px',borderRadius:999,background:badge.bg,color:badge.fg,letterSpacing:'0.05em'}}>{exp.group||'—'}</span>
          <span style={{fontSize:14.5,color:'var(--text-primary)',fontWeight:700,flex:1}}>{exp.name}</span>
          <span style={{width:18,height:18,borderRadius:999,flexShrink:0,border:`2px solid ${active?'#6c67b8':'rgba(0,0,0,0.16)'}`,background:active?'#6c67b8':'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{active&&<F.Check size={10}color="#fff"strokeWidth={3}/>}</span>
        </div>
        {exp.desc&&<div style={{fontSize:12.5,color:'var(--text-secondary)',marginTop:8,lineHeight:1.5}}>{exp.desc}</div>}
      </button>;};
export default ExpCard;
export { ExpCard };
