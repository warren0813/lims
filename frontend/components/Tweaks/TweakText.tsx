// @ts-nocheck
"use client";
import TweakRow from '@/components/Tweaks/TweakRow';

function TweakText({label,value,placeholder,onChange}){return<TweakRow label={label}>
      <input className="twk-field"type="text"value={value}placeholder={placeholder}onChange={e=>onChange(e.target.value)}/>
    </TweakRow>;}
export default TweakText;
export { TweakText };
