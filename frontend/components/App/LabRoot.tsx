// @ts-nocheck
"use client";
import React,{useState}from'react';import Sidebar from '@/components/Shell/Sidebar';import NAV_ITEMS from '@/components/Shell/NAV_ITEMS';import LabApp from '@/components/Lab/LabApp';
export default function LabRoot({user,onLogout,tweaksUI}){const[route,setRoute]=useState({page:'lab_dashboard'});const navigate=r=>setRoute(r);const LAB_NAV_ITEMS=NAV_ITEMS.map(n=>({...n,id:'lab_'+n.id}));return <div className="app" data-screen-label={`App · lab_mem · ${route.page}`}><Sidebar route={route} navigate={navigate} navItems={LAB_NAV_ITEMS} sectionLabel="Lab Operations" sublabel="Lab Member" user={user} onLogout={onLogout}/><main className="main"><LabApp route={route} navigate={navigate}/></main>{tweaksUI}</div>}
