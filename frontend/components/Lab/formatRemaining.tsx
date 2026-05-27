// @ts-nocheck
"use client";


const formatRemaining=ms=>{if(ms==null)return{text:'—',level:'none'};if(ms<0){const d=Math.ceil(-ms/86400000);return{text:`Overdue ${d}d`,level:'overdue'};}const d=Math.floor(ms/86400000);const h=Math.floor(ms%86400000/3600000);if(d===0)return{text:h<=0?'Due now':`${h}h left`,level:'critical'};if(d<=1)return{text:`${d}d ${h}h left`,level:'critical'};if(d<=3)return{text:`${d}d left`,level:'warning'};return{text:`${d}d left`,level:'normal'};};
export default formatRemaining;
export { formatRemaining };
