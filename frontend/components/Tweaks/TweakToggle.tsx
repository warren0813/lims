// @ts-nocheck
"use client";


function TweakToggle({label,value,onChange}){return<div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button"className="twk-toggle"data-on={value?'1':'0'}role="switch"aria-checked={!!value}onClick={()=>onChange(!value)}><i/></button>
    </div>;}
export default TweakToggle;
export { TweakToggle };
