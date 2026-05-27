// @ts-nocheck
"use client";
import React from 'react';
import LabDashboard from '@/components/Lab/LabDashboard';
import LabSamples from '@/components/Lab/LabSamples';
import LabWaferDetail from '@/components/Lab/LabWaferDetail';
import LabWipList from '@/components/Lab/LabWipList';
import LabWipDetail from '@/components/Lab/LabWipDetail';
import LabDispatchList from '@/components/Lab/LabDispatchList';
import LabDispatchDetail from '@/components/Lab/LabDispatchDetail';
import LabEquipment from '@/components/Lab/LabEquipment';
import ink from '@/components/Lab/ink';

const LabApp=({route,navigate,canManage=false})=>{const[toast,setToast]=React.useState(null);const showToast=msg=>{setToast({msg,t:Date.now()});setTimeout(()=>setToast(null),2200);};let page=null;const p=route.page;if(p==='lab_dashboard'||p==='dashboard')page=<LabDashboard navigate={navigate}/>;else if(p==='lab_samples'||p==='samples')page=<LabSamples navigate={navigate}defaultTab={route.tab||'all'}showToast={showToast}/>;else if(p==='lab_wafer')page=<LabWaferDetail id={route.id}navigate={navigate}showToast={showToast}/>;else if(p==='lab_wip'||p==='wip')page=<LabWipList navigate={navigate}showToast={showToast}/>;else if(p==='lab_wip_detail')page=<LabWipDetail id={route.id}navigate={navigate}showToast={showToast}/>;else if(p==='lab_dispatches'||p==='dispatches')page=<LabDispatchList navigate={navigate}defaultTab={route.tab||'active'}/>;else if(p==='lab_dispatch_detail')page=<LabDispatchDetail id={route.id}navigate={navigate}showToast={showToast}/>;else if(p==='lab_equipment'||p==='equipment')page=<LabEquipment navigate={navigate}canManage={canManage}showToast={showToast}/>;else page=<LabDashboard navigate={navigate}/>;return<>
      {page}
      {}
      {toast&&<div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',padding:'12px 20px',borderRadius:10,background:ink,color:'#fff',fontSize:14,fontWeight:500,boxShadow:'0 12px 36px rgba(20,20,28,0.32)',animation:'slide-in 0.18s ease-out',zIndex:300}}>{toast.msg}</div>}
    </>;};
export default LabApp;
export { LabApp };
