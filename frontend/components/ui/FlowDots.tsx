// @ts-nocheck
"use client";


const FlowDots=({steps,current,size=6,gap=4,doneColor='var(--primary)',currentColor='var(--primary)',style})=>{const idx=steps.indexOf(current);return<span style={{display:'inline-flex',alignItems:'center',gap,...style}}>
      {steps.map((s,i)=><span key={s}style={{width:i===idx?size+2:size,height:i===idx?size+2:size,borderRadius:999,background:i<idx?doneColor:i===idx?currentColor:'rgba(0,0,0,0.09)',...(i===idx?{boxShadow:`0 0 0 2px rgba(108,103,184,0.20)`}:{})}}/>)}
    </span>;};
export default FlowDots;
export { FlowDots };
