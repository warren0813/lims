// @ts-nocheck
"use client";
import URGENCY_DAYS from '@/components/Lab/URGENCY_DAYS';

const computeRemaining=w=>{if(!w.arrivedAt)return null;if(w.status==='incoming'||w.status==='rejected')return null;const days=URGENCY_DAYS[w.urgency]??7;const start=new Date(w.arrivedAt.replace(' ','T')+':00').getTime();const deadline=start+days*86400000;return deadline-Date.now();};
export default computeRemaining;
export { computeRemaining };
