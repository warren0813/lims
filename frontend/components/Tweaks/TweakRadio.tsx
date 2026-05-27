// @ts-nocheck
"use client";
import React from 'react';
import TweakSelect from '@/components/Tweaks/TweakSelect';
import TweakRow from '@/components/Tweaks/TweakRow';

function TweakRadio({label,value,options,onChange}){const trackRef=React.useRef(null);const[dragging,setDragging]=React.useState(false);const valueRef=React.useRef(value);valueRef.current=value;const labelLen=o=>String(typeof o==='object'?o.label:o).length;const maxLen=options.reduce((m,o)=>Math.max(m,labelLen(o)),0);const fitsAsSegments=maxLen<=({2:16,3:10}[options.length]??0);if(!fitsAsSegments){const resolve=s=>{const m=options.find(o=>String(typeof o==='object'?o.value:o)===s);return m===undefined?s:typeof m==='object'?m.value:m;};return<TweakSelect label={label}value={value}options={options}onChange={s=>onChange(resolve(s))}/>;}const opts=options.map(o=>typeof o==='object'?o:{value:o,label:o});const idx=Math.max(0,opts.findIndex(o=>o.value===value));const n=opts.length;const segAt=clientX=>{const r=trackRef.current.getBoundingClientRect();const inner=r.width-4;const i=Math.floor((clientX-r.left-2)/inner*n);return opts[Math.max(0,Math.min(n-1,i))].value;};const onPointerDown=e=>{setDragging(true);const v0=segAt(e.clientX);if(v0!==valueRef.current)onChange(v0);const move=ev=>{if(!trackRef.current)return;const v=segAt(ev.clientX);if(v!==valueRef.current)onChange(v);};const up=()=>{setDragging(false);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);};return<TweakRow label={label}>
      <div ref={trackRef}role="radiogroup"onPointerDown={onPointerDown}className={dragging?'twk-seg dragging':'twk-seg'}>
        <div className="twk-seg-thumb"style={{left:`calc(2px + ${idx} * (100% - 4px) / ${n})`,width:`calc((100% - 4px) / ${n})`}}/>
        {opts.map(o=><button key={o.value}type="button"role="radio"aria-checked={o.value===value}>
            {o.label}
          </button>)}
      </div>
    </TweakRow>;}
export default TweakRadio;
export { TweakRadio };
