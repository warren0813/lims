// @ts-nocheck
"use client";
import React from 'react';
import FabDashboard from '@/components/Fab/FabDashboard';
import FabRequestList from '@/components/Fab/FabRequestList';
import FabNewRequest from '@/components/Fab/FabNewRequest';
import FabDraftEdit from '@/components/Fab/FabDraftEdit';
import FabRequestDetail from '@/components/Fab/FabRequestDetail';

const FabApp=({route,navigate})=>{const[toast,setToast]=React.useState(null);const showToast=msg=>{setToast({msg,t:Date.now()});setTimeout(()=>setToast(null),2200);};let page=null;if(route.page==='fab_dashboard')page=<FabDashboard navigate={navigate}/>;else if(route.page==='fab_requests')page=<FabRequestList navigate={navigate}initialTab={route.tab||'all'}/>;else if(route.page==='fab_drafts')page=<FabRequestList navigate={navigate}drafts titleOverride="Drafts"/>;else if(route.page==='fab_new')page=<FabNewRequest navigate={navigate}showToast={showToast}/>;else if(route.page==='fab_draft_edit')page=<FabDraftEdit id={route.id}navigate={navigate}showToast={showToast}/>;else if(route.page==='fab_request')page=<FabRequestDetail id={route.id}navigate={navigate}showToast={showToast}/>;else page=<FabDashboard navigate={navigate}/>;return<>
        {page}
        {toast&&<div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',padding:'12px 20px',borderRadius:10,background:'#1e1e24',color:'#fff',fontSize:14,fontWeight:500,boxShadow:'0 12px 36px rgba(30,30,36,0.32)',animation:'slide-in 0.18s ease-out',zIndex:100}}>{toast.msg}</div>}
      </>;};
export default FabApp;
export { FabApp };
