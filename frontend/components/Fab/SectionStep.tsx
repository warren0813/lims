// @ts-nocheck
"use client";
import FabCard from '@/components/Fab/FabCard';

const SectionStep=({n,title,subtitle,children})=><FabCard padding={0}style={{marginBottom:18}}>
      <div style={{display:'flex',alignItems:'center',gap:14,padding:'22px 24px 18px'}}>
        <div style={{width:28,height:28,borderRadius:999,background:'#1e1e24',color:'#fff',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{n}</div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:'var(--text-primary)'}}>{title}</div>
          {subtitle&&<div style={{fontSize:12.5,color:'var(--text-muted)',marginTop:2}}>{subtitle}</div>}
        </div>
      </div>
      <div style={{padding:'0 24px 24px'}}>{children}</div>
    </FabCard>;
export default SectionStep;
export { SectionStep };
