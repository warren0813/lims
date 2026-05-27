// @ts-nocheck
"use client";


const TABS=[{id:'all',label:'All',filter:r=>r.status!=='draft'},{id:'pending',label:'Pending Approval',filter:r=>r.status==='submitted'},{id:'in_progress',label:'In Progress',filter:r=>r.status==='in_progress'},{id:'returned',label:'Returned',filter:r=>r.status==='returned'},{id:'rejected',label:'Rejected',filter:r=>r.status==='rejected'},{id:'cancelled',label:'Cancelled',filter:r=>r.status==='cancelled'}];
export default TABS;
export { TABS };
