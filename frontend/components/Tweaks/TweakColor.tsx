// @ts-nocheck
"use client";
import TweakRow from '@/components/Tweaks/TweakRow';
import __TwkCheck from '@/components/Tweaks/__TwkCheck';
import __twkIsLight from '@/components/Tweaks/__twkIsLight';

function TweakColor({label,value,options,onChange}){if(!options||!options.length){return<div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color"className="twk-swatch"value={value}onChange={e=>onChange(e.target.value)}/>
      </div>;}const key=o=>String(JSON.stringify(o)).toLowerCase();const cur=key(value);return<TweakRow label={label}>
      <div className="twk-chips"role="radiogroup">
        {options.map((o,i)=>{const colors=Array.isArray(o)?o:[o];const[hero,...rest]=colors;const sup=rest.slice(0,4);const on=key(o)===cur;return<button key={i}type="button"className="twk-chip"role="radio"aria-checked={on}data-on={on?'1':'0'}aria-label={colors.join(', ')}title={colors.join(' · ')}style={{background:hero}}onClick={()=>onChange(o)}>
              {sup.length>0&&<span>
                  {sup.map((c,j)=><i key={j}style={{background:c}}/>)}
                </span>}
              {on&&<__TwkCheck light={__twkIsLight(hero)}/>}
            </button>;})}
      </div>
    </TweakRow>;}
export default TweakColor;
export { TweakColor };
