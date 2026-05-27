// @ts-nocheck
"use client";
import React from 'react';
import MGR_REQUEST_SEED from '@/components/Manager/MGR_REQUEST_SEED';
import MGR_RECIPE_SEED from '@/components/Manager/MGR_RECIPE_SEED';
import MgrDashboard from '@/components/Manager/MgrDashboard';
import MgrAllRequests from '@/components/Manager/MgrAllRequests';
import MgrRequestDetail from '@/components/Manager/MgrRequestDetail';
import MgrRecipes from '@/components/Manager/MgrRecipes';
import MgrReports from '@/components/Manager/MgrReports';
import mInk from '@/components/Manager/mInk';

const MgrApp=({route,navigate})=>{const[requests,setRequests]=React.useState(MGR_REQUEST_SEED);const[recipes,setRecipes]=React.useState(MGR_RECIPE_SEED);const[toast,setToast]=React.useState(null);const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2200);};const now=()=>new Date().toISOString().slice(0,16).replace('T',' ');const onAction=(id,action,reason)=>{const at=now();setRequests(rs=>rs.map(r=>{if(r.id!==id)return r;const nextStatus=action==='APPROVE'?'in_progress':action==='RETURN'?'returned':action==='COMPLETE'?'completed':'rejected';return{...r,status:nextStatus,history:[...r.history,{action,by:'lab_manager',at,note:reason||''}]};}));showToast(`#${id} ${action.toLowerCase()}d`);};const createRecipe=rec=>{setRecipes(rs=>[rec,...rs]);showToast('Recipe created');};const updateRecipe=rec=>{setRecipes(rs=>rs.map(x=>x.id===rec.id?rec:x));showToast('Recipe updated');};const deleteRecipe=id=>{setRecipes(rs=>rs.filter(x=>x.id!==id));showToast('Recipe deleted');};let page=null;const p=route.page;if(p==='mgr_dashboard')page=<MgrDashboard navigate={navigate}/>;else if(p==='mgr_all_requests')page=<MgrAllRequests navigate={navigate}/>;else if(p==='mgr_request')page=<MgrRequestDetail id={route.id}navigate={navigate}showToast={showToast}/>;else if(p==='mgr_recipes')page=<MgrRecipes showToast={showToast}/>;else if(p==='mgr_reports')page=<MgrReports/>;else page=<MgrDashboard navigate={navigate}/>;return<>
      {page}
      {toast&&<div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',padding:'12px 20px',borderRadius:10,background:mInk,color:'#fff',fontSize:14,fontWeight:500,boxShadow:'0 12px 36px rgba(20,20,28,0.32)',animation:'slide-in 0.18s ease-out',zIndex:300}}>{toast}</div>}
    </>;};
export default MgrApp;
export { MgrApp };
