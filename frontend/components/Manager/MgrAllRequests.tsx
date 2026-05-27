// @ts-nocheck
"use client";
import React from 'react';
import * as I from '@/components/ui/I';
import useMgrRequests from '@/components/Manager/useMgrRequests';
import ALL_REQ_TABS from '@/components/Manager/ALL_REQ_TABS';
import Page from '@/components/Manager/Page';
import mMuted from '@/components/Manager/mMuted';
import mLine from '@/components/Manager/mLine';
import mInk from '@/components/Manager/mInk';
import mText2 from '@/components/Manager/mText2';
import Card from '@/components/Manager/Card';
import findExpById from '@/components/Manager/findExpById';
import Pill from '@/components/Manager/Pill';
import URGENCY_LABEL from '@/components/Manager/URGENCY_LABEL';
const MI=I;
const MgrAllRequests=({navigate})=>{const{data:requests,loading,error}=useMgrRequests();const[tab,setTab]=React.useState('pending');const nonDraftRequests=React.useMemo(()=>requests.filter(r=>r.status!=='draft'),[requests]);const counts=React.useMemo(()=>Object.fromEntries(ALL_REQ_TABS.map(t=>[t.id,nonDraftRequests.filter(t.filter).length])),[nonDraftRequests]);const list=nonDraftRequests.filter(ALL_REQ_TABS.find(t=>t.id===tab)?.filter||(()=>true));if(loading&&requests.length===0){return<Page title="All Requests"subtitle="Loading…">
        <div style={{padding:'60px 20px',textAlign:'center',color:mMuted,fontSize:14}}>Loading…</div>
      </Page>;}return<Page title="All Requests"subtitle="廠區送審申請 — approve, return, or reject submitted requests">
      {error&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          Couldn't load requests: {error}
        </div>}
      <div style={{display:'flex',gap:22,borderBottom:`1px solid ${mLine}`,marginBottom:22}}>
        {ALL_REQ_TABS.map(t=>{const active=t.id===tab;return<button key={t.id}onClick={()=>setTab(t.id)}style={{position:'relative',display:'inline-flex',alignItems:'center',gap:8,padding:'12px 0 14px',cursor:'pointer',color:active?mInk:mText2,fontSize:14,fontWeight:active?700:500,fontFamily:'inherit',background:'transparent',border:'none'}}>
              {t.label}
              <span style={{minWidth:22,height:19,padding:'0 7px',borderRadius:999,fontSize:11,fontWeight:700,background:active?mInk:'#ebebf0',color:active?'#fff':'#5a5a6e',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{counts[t.id]}</span>
              {active&&<span style={{position:'absolute',left:0,right:0,bottom:-1,height:2,background:mInk,borderRadius:2}}/>}
            </button>;})}
      </div>

      <div style={{fontSize:13,color:mMuted,marginBottom:14}}>
        Showing <strong style={{color:mInk}}>{list.length}</strong> of {nonDraftRequests.length} requests
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {list.length===0?<Card padding={48}style={{textAlign:'center',color:mMuted}}>
            <MI.ClipboardList size={32}color="#cbcbd6"style={{marginBottom:10}}/>
            <div style={{fontSize:14,fontWeight:600,color:mText2}}>No requests in this view</div>
          </Card>:list.map(r=>{const sampleCount=r.sampleCount??r.samples.length;const requester=r.requester?.username||r.history[0]?.by||'—';return<button key={r.id}onClick={()=>navigate({page:'mgr_request',id:r.id})}style={{display:'grid',gridTemplateColumns:'80px minmax(0,1fr) 1.3fr 110px 130px 24px',alignItems:'center',gap:18,padding:'18px 22px',borderRadius:14,background:'#fff',border:'1px solid rgba(0,0,0,0.08)',textAlign:'left',cursor:'pointer',transition:'border-color 0.12s',fontFamily:'inherit'}}onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.18)';}}onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.08)';}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'#a8a8b8',letterSpacing:'0.02em'}}>
                #{String(r.id).padStart(4,'0')}
              </span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:mInk}}>{r.title}</div>
                <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,fontSize:12.5,color:mMuted,flexWrap:'wrap',whiteSpace:'nowrap'}}>
                  <MI.Calendar size={12}/>
                  <span style={{fontFamily:'var(--font-mono)'}}>{(r.submitted||r.created||'').split(' ')[0]||'—'}</span>
                  <span aria-hidden>·</span>
                  <span>{sampleCount} wafer{sampleCount===1?'':'s'}</span>
                  <span aria-hidden>·</span>
                  <span>by <span style={{fontFamily:'var(--font-mono)',color:mText2}}>{requester}</span></span>
                </div>
              </div>
              {}
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {r.expIds.map(findExpById).filter(Boolean).map(e=><span key={e.id}style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 9px 4px 4px',borderRadius:999,background:'#f5f5fa',border:`1px solid ${mLine}`}}>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:999,background:e.group==='RA'?'#e8e7f6':'#d4eaf0',color:e.group==='RA'?'#5550a0':'#2a7a91',letterSpacing:'0.05em'}}>{e.code}</span>
                    <span style={{fontSize:12.5,color:mText2,fontWeight:500}}>{e.name}</span>
                  </span>)}
              </div>
              <Pill kind={r.urgency}mapping={URGENCY_LABEL}/>
              <Pill kind={r.status}/>
              <MI.ChevronRight size={15}color="#cbcbd6"/>
            </button>;})}
      </div>
    </Page>;};
export default MgrAllRequests;
export { MgrAllRequests };
