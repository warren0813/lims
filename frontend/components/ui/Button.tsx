// @ts-nocheck
"use client";
import React from 'react';

const Button=({variant='primary',size='md',icon,children,style,disabled,...rest})=>{const sizes={sm:{h:28,px:10,fs:12,gap:6,iconSize:13},md:{h:34,px:14,fs:13,gap:7,iconSize:14},lg:{h:40,px:18,fs:14,gap:8,iconSize:15}}[size];const variants={primary:{bg:'var(--primary)',color:'#fff',border:'var(--primary)',hoverBg:'var(--primary-hover)'},secondary:{bg:'#fff',color:'var(--text-primary)',border:'var(--border-strong)',hoverBg:'#f8fafc'},ghost:{bg:'transparent',color:'var(--text-secondary)',border:'transparent',hoverBg:'#ebebf0'},danger:{bg:'#fff',color:'#a02e3d',border:'#f8c8cf',hoverBg:'#fde9eb'},success:{bg:'#1ea05a',color:'#fff',border:'#1ea05a',hoverBg:'#157a4a'},dark:{bg:'#1e1e24',color:'#fff',border:'#1e1e24',hoverBg:'#2d2d38'}}[variant];const[hover,setHover]=React.useState(false);return<button onMouseEnter={()=>setHover(true)}onMouseLeave={()=>setHover(false)}disabled={disabled}style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:sizes.gap,height:sizes.h,padding:`0 ${sizes.px}px`,fontSize:sizes.fs,fontWeight:500,background:hover&&!disabled?variants.hoverBg:variants.bg,color:variants.color,border:`1px solid ${variants.border}`,borderRadius:8,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,transition:'background 0.12s, border 0.12s',whiteSpace:'nowrap',...style}}{...rest}>
      {icon&&React.cloneElement(icon,{size:sizes.iconSize})}
      {children}
    </button>;};
export default Button;
export { Button };
