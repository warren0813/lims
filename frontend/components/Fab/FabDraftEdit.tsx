// @ts-nocheck
"use client";
import * as I from '@/components/ui/I';
import useRequestDetail from '@/components/Fab/useRequestDetail';
import FabPage from '@/components/Fab/FabPage';
import FabNewRequest from '@/components/Fab/FabNewRequest';
const F=I;
const FabDraftEdit=({id,navigate,showToast})=>{const{data:draft,loading,error}=useRequestDetail(id);if(loading&&!draft){return<FabPage title="Loading draft…">
          <div style={{padding:'60px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:14}}>
            Loading…
          </div>
        </FabPage>;}if(error||!draft){return<FabPage breadcrumb={<button onClick={()=>navigate({page:'fab_drafts'})}style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:13,fontWeight:600,color:'#6c67b8',marginBottom:14,cursor:'pointer'}}><F.ChevronLeft size={14}/> Drafts</button>}title="Draft not found">
          <div style={{padding:24,color:'#c0394a',fontSize:14}}>
            {error||'This draft is no longer available.'}
          </div>
        </FabPage>;}return<FabNewRequest navigate={navigate}draft={draft}isEdit showToast={showToast}/>;};
export default FabDraftEdit;
export { FabDraftEdit };
