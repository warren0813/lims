// @ts-nocheck
"use client";
import * as I from '@/components/ui/I';
import phaseIndexFor from '@/components/Fab/phaseIndexFor';
import PhasePipeline from '@/components/Fab/PhasePipeline';
const F=I;
const DetailWaferRow=({wafer,request})=>{const idx=phaseIndexFor(wafer,request);return<div style={{display:'grid',gridTemplateColumns:'180px minmax(0, 1fr)',alignItems:'center',gap:22,padding:'16px 18px',background:'#fff',borderRadius:12,border:'1px solid rgba(0,0,0,0.07)'}}>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
            <F.Wafer size={15}color="#6c67b8"/>
            <span style={{fontFamily:'var(--font-mono)',fontSize:13.5,fontWeight:700,color:'var(--text-primary)'}}>{wafer.wafer}</span>
          </div>
          <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:4,marginLeft:23}}>{wafer.size}</div>
        </div>
        <PhasePipeline idx={idx}/>
      </div>;};
export default DetailWaferRow;
export { DetailWaferRow };
