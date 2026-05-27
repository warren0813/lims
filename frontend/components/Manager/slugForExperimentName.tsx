// @ts-nocheck
"use client";


const slugForExperimentName=name=>{if(!name)return null;const l=name.toLowerCase();if(l.includes('temperature cycling'))return'tct';if(l.includes('hast')||l.includes('highly accelerated'))return'hast';if(l.includes('bias temperature'))return'btc';if(l.includes('circuit prob'))return'cp';if(l.includes('final test'))return'ft';return null;};
export default slugForExperimentName;
export { slugForExperimentName };
