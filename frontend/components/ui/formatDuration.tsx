// @ts-nocheck
"use client";


function formatDuration(totalSec){if(totalSec==null)return'—';if(totalSec===0)return'0s';const d=Math.floor(totalSec/86400);const h=Math.floor(totalSec%86400/3600);const m=Math.floor(totalSec%3600/60);const s=Math.floor(totalSec%60);const parts=[];if(d)parts.push(`${d}d`);if(h)parts.push(`${h}h`);if(m)parts.push(`${m}m`);if(s&&d===0)parts.push(`${s}s`);return parts.join(' ')||'0s';}
export default formatDuration;
export { formatDuration };
