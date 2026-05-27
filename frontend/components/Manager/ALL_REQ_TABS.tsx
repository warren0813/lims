// @ts-nocheck
"use client";


const ALL_REQ_TABS=[{id:'pending',label:'Pending Approval',filter:r=>r.status==='submitted'},{id:'all',label:'All',filter:()=>true},{id:'in_progress',label:'In Progress',filter:r=>r.status==='in_progress'},{id:'completed',label:'Completed',filter:r=>r.status==='completed'},{id:'returned',label:'Returned',filter:r=>r.status==='returned'},{id:'rejected',label:'Rejected',filter:r=>r.status==='rejected'}];
export default ALL_REQ_TABS;
export { ALL_REQ_TABS };
