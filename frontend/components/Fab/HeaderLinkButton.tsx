// @ts-nocheck
"use client";
import accent from '@/components/Lab/accent';

const HeaderLinkButton=({children,onClick,accent})=><button onClick={onClick}style={{fontSize:13,fontWeight:700,color:'#fff',padding:'7px 13px',borderRadius:8,background:'rgba(255,255,255,0.10)',border:`1px solid ${accent}55`,display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer',transition:'background 0.15s',fontFamily:'inherit'}}onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.20)'}onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.10)'}>{children}</button>;
export default HeaderLinkButton;
export { HeaderLinkButton };
