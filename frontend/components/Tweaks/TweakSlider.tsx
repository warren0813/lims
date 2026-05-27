// @ts-nocheck
"use client";
import TweakRow from '@/components/Tweaks/TweakRow';

function TweakSlider({label,value,min=0,max=100,step=1,unit='',onChange}){return<TweakRow label={label}value={`${value}${unit}`}>
      <input type="range"className="twk-slider"min={min}max={max}step={step}value={value}onChange={e=>onChange(Number(e.target.value))}/>
    </TweakRow>;}
export default TweakSlider;
export { TweakSlider };
