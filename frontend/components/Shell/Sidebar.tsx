// @ts-nocheck
"use client";
import React from 'react';
import NAV_ITEMS from '@/components/Shell/NAV_ITEMS';
import I from '@/components/ui/I';
import Icon from '@/components/ui/Icon';

const Sidebar=({route,navigate,counts,user,onLogout,navItems=NAV_ITEMS,navSections,sectionLabel='Lab Operations',sublabel='Lab Operator'})=>{const isFab=false;const sections=navSections||[{label:sectionLabel,items:navItems}];const allItems=sections.flatMap(s=>s.items);return<aside style={{width:'var(--sidebar-width)',height:'100vh',position:'fixed',left:0,top:0,background:isFab?'#0f172a':'var(--bg-sidebar)',color:'#cbd5e1',display:'flex',flexDirection:'column',borderRight:'1px solid rgba(255,255,255,0.04)',zIndex:20,overflow:'hidden'}}>
    {!isFab&&<>
      {}
      <div style={{position:'absolute',top:-40,right:-50,width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle, rgba(244,168,191,0.18) 0%, transparent 65%)',pointerEvents:'none',filter:'blur(8px)'}}/>
      <div style={{position:'absolute',bottom:80,left:-60,width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle, rgba(187,183,232,0.15) 0%, transparent 65%)',pointerEvents:'none',filter:'blur(8px)'}}/>
      <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',backgroundSize:'14px 14px',pointerEvents:'none'}}/>
      {}
      <div style={{position:'absolute',top:60,right:28,width:4,height:4,background:'#f4a8bf',borderRadius:'50%',animation:'lims-twinkle 3.2s infinite'}}/>
      <div style={{position:'absolute',top:180,left:22,width:3,height:3,background:'#bbb7e8',borderRadius:'50%',animation:'lims-twinkle 4.1s infinite 0.8s'}}/>
      <div style={{position:'absolute',bottom:220,right:40,width:3,height:3,background:'#9ebbc8',borderRadius:'50%',animation:'lims-twinkle 3.6s infinite 1.6s'}}/>
    </>}

    {}
    <div style={{padding:'20px 20px 24px',display:'flex',alignItems:'center',gap:11,position:'relative'}}>
      <div style={{width:36,height:36,borderRadius:10,background:isFab?'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)':'linear-gradient(135deg, #f4a8bf 0%, #bbb7e8 100%)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:isFab?'0 2px 10px rgba(37,99,235,0.35)':'0 2px 10px rgba(244,168,191,0.35)'}}>
        <I.Flask size={19}color="#fff"/>
      </div>
      <div style={{color:'#fff',fontWeight:700,fontSize:18,letterSpacing:'-0.01em'}}>LIMS</div>
    </div>

    {}
    {isFab&&(()=>{const item=navItems[0];const active=route.page===item.id;const Icon=I[item.icon];return<nav style={{padding:'0 10px',position:'relative'}}>
          <button onClick={()=>navigate({page:item.id})}style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:active?'rgba(59,130,246,0.15)':'transparent',color:active?'#60a5fa':'#94a3b8',borderRadius:8,fontSize:14,fontWeight:active?600:500,textAlign:'left',transition:'background 0.12s, color 0.12s'}}onMouseEnter={e=>{if(!active){e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='#cbd5e1';}}}onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#94a3b8';}}}>
            <Icon size={18}/>
            <span>{item.label}</span>
          </button>
        </nav>;})()}

    {}
    {sections.map((sec,si)=><React.Fragment key={si}>
        <div style={{padding:si===0?'14px 18px 8px':'20px 18px 8px',fontSize:10.5,fontWeight:600,letterSpacing:'0.12em',color:'#5a5a6e',textTransform:'uppercase',position:'relative'}}>{sec.label}</div>
        <nav style={{display:'flex',flexDirection:'column',gap:2,padding:'0 10px',position:'relative'}}>
          {sec.items.map(item=>{const active=route.page===item.id;const Icon=I[item.icon];const count=counts&&counts[item.id];return<button key={item.id}onClick={()=>navigate({page:item.id})}style={{display:'flex',alignItems:'center',gap:11,padding:'9px 10px',background:active?'var(--bg-sidebar-active)':'transparent',color:active?'#fff':'var(--text-sidebar)',borderRadius:8,fontSize:13.5,fontWeight:active?600:500,textAlign:'left',position:'relative',transition:'background 0.12s, color 0.12s'}}onMouseEnter={e=>{if(!active){e.currentTarget.style.background='var(--bg-sidebar-hover)';}}}onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';}}}>
                <Icon size={16}/>
                <span style={{flex:1}}>{item.label}</span>
                {count>0&&<span style={{minWidth:20,padding:'0 6px',height:18,borderRadius:999,background:active?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.06)',color:active?'#fff':'#bbbbcc',fontSize:11,fontWeight:600,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{count}</span>}
              </button>;})}
        </nav>
      </React.Fragment>)}

    <div style={{flex:1}}/>

    {}
    <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:isFab?'16px 18px':'14px 14px',display:'flex',alignItems:'center',gap:11,position:'relative'}}>
      <div style={{width:isFab?36:34,height:isFab?36:34,borderRadius:'50%',background:isFab?'#2563eb':'linear-gradient(135deg, #f4a8bf 0%, #bbb7e8 100%)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14}}>{user?.display?.[0]?.toUpperCase()||'L'}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{color:'#fff',fontSize:13.5,fontWeight:600,lineHeight:1.3}}>{user?.display||'lab_member'}</div>
        <div style={{fontSize:11,color:isFab?'#64748b':'#888899',marginTop:2}}>{user?.subtitle||'實驗室成員'}</div>
      </div>
      {onLogout&&<button onClick={onLogout}title="Sign out"style={{width:28,height:28,borderRadius:6,color:isFab?'#64748b':'#888899',display:'inline-flex',alignItems:'center',justifyContent:'center',transition:'background 0.12s, color 0.12s'}}onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='#fff';}}onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=isFab?'#64748b':'#888899';}}>{isFab?<I.ChevronDown size={14}/>:<I.LogOut size={14}/>}</button>}
    </div>
  </aside>;};
export default Sidebar;
export { Sidebar };
