// @ts-nocheck
"use client";


const phaseIndexFor=(sample,request)=>{const rawReq=request.rawStatus||request.status;if(rawReq==='draft'||rawReq==='submitted'||rawReq==='pending_approval')return-1;if(request.status==='completed'||sample.status==='completed')return 4;if(sample.status==='in_wip'||sample.status==='processing'||sample.raw_status==='processing'||sample.raw_status==='processing_exception'||sample.raw_status==='split')return 3;if(sample.status==='received'||sample.raw_status==='received')return 2;if(sample.raw_status==='shipped')return 1;return 0;};
export default phaseIndexFor;
export { phaseIndexFor };
