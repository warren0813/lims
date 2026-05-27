// @ts-nocheck
"use client";
import TweakRow from '@/components/Tweaks/TweakRow';

function TweakSelect({label,value,options,onChange}){return<TweakRow label={label}>
      <select className="twk-field"value={value}onChange={e=>onChange(e.target.value)}>
        {options.map(o=>{const v=typeof o==='object'?o.value:o;const l=typeof o==='object'?o.label:o;return<option key={v}value={v}>{l}</option>;})}
      </select>
    </TweakRow>;}
export default TweakSelect;
export { TweakSelect };
