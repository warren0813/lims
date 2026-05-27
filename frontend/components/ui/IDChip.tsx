// @ts-nocheck
"use client";
import muted from '@/components/Lab/muted';

const IDChip=({id,prefix='#',size='md',muted=false,style})=>{const fs=size==='sm'?11:12;const ph=size==='sm'?'2px 6px':'3px 8px';return<span style={{display:'inline-flex',alignItems:'center',padding:ph,borderRadius:6,background:muted?'transparent':'#ebebf0',color:muted?'var(--text-muted)':'var(--text-secondary)',fontFamily:'JetBrains Mono, monospace',fontSize:fs,fontWeight:500,letterSpacing:'0.01em',...style}}>{prefix}{id}</span>;};
export default IDChip;
export { IDChip };
