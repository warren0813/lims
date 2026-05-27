// @ts-nocheck
"use client";
import React from 'react';
import WAFER_PHASES from '@/components/Fab/WAFER_PHASES';

const PhasePipeline=({idx,compact=false})=>{const dot=(active,done)=><span style={{width:active?11:9,height:active?11:9,borderRadius:999,background:done||active?'#6c67b8':'#e2e2ea',boxShadow:active?'0 0 0 3px rgba(108,103,184,0.18)':'none',transition:'all 0.2s',display:'inline-block',flexShrink:0}}/>;return<div style={{display:'flex',alignItems:'center',gap:0,width:'100%'}}>
        {WAFER_PHASES.map((p,i)=>{const active=i===idx;const done=i<idx;return<React.Fragment key={p}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,flexShrink:0}}>
                {dot(active,done)}
                {!compact&&<span style={{fontSize:11,fontWeight:active?700:500,color:active?'#6c67b8':done?'var(--text-secondary)':'var(--text-muted)',whiteSpace:'nowrap'}}>{p}</span>}
              </div>
              {i<WAFER_PHASES.length-1&&<div style={{flex:1,height:2,minWidth:16,background:i<idx?'#6c67b8':'#e2e2ea',margin:compact?'0 2px':'0 4px',marginBottom:compact?0:22}}/>}
            </React.Fragment>;})}
      </div>;};
export default PhasePipeline;
export { PhasePipeline };
