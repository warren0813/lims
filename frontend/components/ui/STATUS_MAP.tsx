// @ts-nocheck
"use client";


const STATUS_MAP={created:{bg:'var(--status-created-bg)',color:'var(--status-created-text)',label:'Created'},shipped:{bg:'var(--status-shipped-bg)',color:'var(--status-shipped-text)',label:'Shipped'},received:{bg:'var(--status-received-bg)',color:'var(--status-received-text)',label:'Received'},processing:{bg:'var(--status-progress-bg)',color:'var(--status-progress-text)',label:'Processing'},completed:{bg:'var(--status-completed-bg)',color:'var(--status-completed-text)',label:'Completed'},lost:{bg:'var(--status-aborted-bg)',color:'var(--status-aborted-text)',label:'Lost'},in_progress:{bg:'var(--status-progress-bg)',color:'var(--status-progress-text)',label:'In Progress'},aborted:{bg:'var(--status-aborted-bg)',color:'var(--status-aborted-text)',label:'Aborted'},pending:{bg:'var(--status-pending-bg)',color:'var(--status-pending-text)',label:'Pending'},running:{bg:'var(--status-progress-bg)',color:'var(--status-progress-text)',label:'Running'},failed:{bg:'var(--status-aborted-bg)',color:'var(--status-aborted-text)',label:'Failed'},PASS:{bg:'var(--status-pass-bg)',color:'var(--status-pass-text)',label:'PASS'},FAIL:{bg:'var(--status-fail-bg)',color:'var(--status-fail-text)',label:'FAIL'}};
export default STATUS_MAP;
export { STATUS_MAP };
