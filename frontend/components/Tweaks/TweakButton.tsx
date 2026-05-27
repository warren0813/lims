// @ts-nocheck
"use client";


function TweakButton({label,onClick,secondary=false}){return<button type="button"className={secondary?'twk-btn secondary':'twk-btn'}onClick={onClick}>{label}</button>;}
export default TweakButton;
export { TweakButton };
