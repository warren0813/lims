// @ts-nocheck
"use client";
import * as UI from '@/components/ui/UI';
import stepFromRequest from '@/components/Fab/stepFromRequest';
import WORKFLOW_STEPS from '@/components/Fab/WORKFLOW_STEPS';
import WORKFLOW_LABELS from '@/components/Fab/WORKFLOW_LABELS';
const FUI=UI;
const RequestFlow=({request,label=false})=>{const s=stepFromRequest(request);if(s.aborted){const colors={draft:{dot:'#a8a8b8',text:'Draft'},cancelled:{dot:'#a8a8b8',text:'Cancelled'},rejected:{dot:'#c0394a',text:'Rejected'},returned:{dot:'#a73d56',text:'Returned'}}[s.status]||{dot:'#a8a8b8',text:s.status};return<span style={{display:'inline-flex',alignItems:'center',gap:8}}>
          <span style={{display:'inline-flex',gap:4}}>
            {[0,1,2,3].map(i=><span key={i}style={{width:6,height:6,borderRadius:999,background:i===0?colors.dot:'rgba(0,0,0,0.09)',opacity:i===0?0.7:1}}/>)}
          </span>
          {label&&<span style={{fontSize:11.5,color:'var(--text-muted)'}}>{colors.text}</span>}
        </span>;}const idx=s.idx;const current=idx>=0?WORKFLOW_STEPS[idx]:null;const labelText=idx>=0?WORKFLOW_LABELS[idx]:'Awaiting approval';return<span style={{display:'inline-flex',alignItems:'center',gap:8}}>
        <FUI.FlowDots steps={WORKFLOW_STEPS}current={current}size={6}gap={4}doneColor="#6c67b8"currentColor="#6c67b8"/>
        {label&&<span style={{fontSize:11.5,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{labelText}</span>}
      </span>;};
export default RequestFlow;
export { RequestFlow };
