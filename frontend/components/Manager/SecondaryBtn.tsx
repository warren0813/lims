// @ts-nocheck
"use client";
import mInk from '@/components/Manager/mInk';
import mLine from '@/components/Manager/mLine';

const SecondaryBtn=({children,onClick,icon,danger,style})=><button onClick={onClick}style={{display:'inline-flex',alignItems:'center',gap:7,padding:'9px 14px',borderRadius:8,background:'#fff',color:danger?'#b9384a':mInk,border:`1px solid ${danger?'#e6c2c7':mLine}`,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',...style}}>{icon}{children}</button>;
export default SecondaryBtn;
export { SecondaryBtn };
