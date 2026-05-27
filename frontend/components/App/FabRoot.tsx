// @ts-nocheck
"use client";
import React,{useState}from'react';import Sidebar from '@/components/Shell/Sidebar';import FAB_NAV_ITEMS from '@/components/Shell/FAB_NAV_ITEMS';import FabApp from '@/components/Fab/FabApp';
export default function FabRoot({user,onLogout,tweaksUI}){const[route,setRoute]=useState({page:'fab_dashboard'});const navigate=r=>setRoute(r);const navFromSidebar=r=>{if(r.page==='fab_requests')setRoute({page:'fab_requests',tab:'all'});else setRoute(r)};return <div className="app" data-screen-label={`App · fab_user · ${route.page}`}><Sidebar route={route} navigate={navFromSidebar} navItems={FAB_NAV_ITEMS} sectionLabel="Requests" user={user} onLogout={onLogout}/><main className="main"><FabApp route={route} navigate={navigate}/></main>{tweaksUI}</div>}
