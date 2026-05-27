// @ts-nocheck
"use client";


const dayDiff=(a,b)=>Math.round((new Date(b)-new Date(a))/86400000);
export default dayDiff;
export { dayDiff };
