// @ts-nocheck
"use client";


const dispatchesOf=(wipId,dps)=>dps.filter(d=>d.wipId===wipId);
export default dispatchesOf;
export { dispatchesOf };
