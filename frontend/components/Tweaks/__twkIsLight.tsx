// @ts-nocheck
"use client";


function __twkIsLight(hex){const h=String(hex).replace('#','');const x=h.length===3?h.replace(/./g,c=>c+c):h.padEnd(6,'0');const n=parseInt(x.slice(0,6),16);if(Number.isNaN(n))return true;const r=n>>16&255,g=n>>8&255,b=n&255;return r*299+g*587+b*114>148000;}
export default __twkIsLight;
export { __twkIsLight };
