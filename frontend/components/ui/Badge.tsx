// @ts-nocheck
"use client";
import STATUS_MAP from '@/components/ui/STATUS_MAP';

const Badge=({status,label,dot,mono,style})=>{const s=STATUS_MAP[status]||{bg:'var(--status-created-bg)',color:'var(--status-created-text)',label:label||status};const isLive=status==='running'||status==='in_progress';return<span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:999,fontSize:12,fontWeight:500,background:s.bg,color:s.color,whiteSpace:'nowrap',fontFamily:mono?'JetBrains Mono, monospace':'inherit',letterSpacing:mono?'0.02em':'normal',...style}}>
      {(dot||isLive)&&<span style={{width:6,height:6,borderRadius:999,background:s.color,...(isLive?{animation:'pulse 1.4s infinite'}:{})}}/>}
      {label||s.label}
    </span>;};
export default Badge;
export { Badge };
