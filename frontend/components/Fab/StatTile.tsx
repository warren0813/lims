// @ts-nocheck
"use client";
import FabCard from '@/components/Fab/FabCard';
import accent from '@/components/Lab/accent';

const StatTile=({label,value,accent,valueBg})=><FabCard padding={20}style={{display:'flex',alignItems:'center',gap:16}}>
      <div style={{width:56,height:56,borderRadius:12,background:valueBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,color:accent,letterSpacing:'-0.02em',lineHeight:1}}>{value}</div>
      </div>
      <div style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>{label}</div>
    </FabCard>;
export default StatTile;
export { StatTile };
