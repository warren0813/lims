// @ts-nocheck
"use client";
import React from 'react';

function TweakNumber({label,value,min,max,step=1,unit='',onChange}){const clamp=n=>{if(min!=null&&n<min)return min;if(max!=null&&n>max)return max;return n;};const startRef=React.useRef({x:0,val:0});const onScrubStart=e=>{e.preventDefault();startRef.current={x:e.clientX,val:value};const decimals=(String(step).split('.')[1]||'').length;const move=ev=>{const dx=ev.clientX-startRef.current.x;const raw=startRef.current.val+dx*step;const snapped=Math.round(raw/step)*step;onChange(clamp(Number(snapped.toFixed(decimals))));};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);};return<div className="twk-num">
      <span className="twk-num-lbl"onPointerDown={onScrubStart}>{label}</span>
      <input type="number"value={value}min={min}max={max}step={step}onChange={e=>onChange(clamp(Number(e.target.value)))}/>
      {unit&&<span className="twk-num-unit">{unit}</span>}
    </div>;}
export default TweakNumber;
export { TweakNumber };
