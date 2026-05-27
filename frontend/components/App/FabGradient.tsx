// @ts-nocheck
"use client";
import { FAB_OPTIONS } from './constants';
export default function FabGradient({value,onChange}){return <div style={{display:'flex',flexDirection:'column',gap:6,padding:'6px 10px 10px'}}><div style={{fontSize:11,color:'#5a5a6e',fontWeight:600,letterSpacing:'0.04em',textTransform:'uppercase'}}>fab_user icon</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{FAB_OPTIONS.map(g=>{const active=value===g;return <button key={g} type="button" onClick={()=>onChange(g)} title={g} style={{width:36,height:36,borderRadius:8,padding:0,background:g,cursor:'pointer',border:active?'2px solid #1e1e24':'1px solid rgba(0,0,0,0.15)',boxShadow:active?'0 0 0 2px rgba(108,103,184,0.25)':'none'}}/>})}</div></div>}
