// @ts-nocheck
"use client";


const Avatar=({name,size=32,bg='#6c67b8'})=>{const initial=(name||'?')[0].toUpperCase();return<span style={{width:size,height:size,borderRadius:999,background:bg,color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:size*0.42,fontWeight:600,letterSpacing:'0.02em',flexShrink:0}}>{initial}</span>;};
export default Avatar;
export { Avatar };
