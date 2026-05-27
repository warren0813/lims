// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import useRequests from '@/components/Fab/useRequests';
import TABS from '@/components/Fab/TABS';
import FabPage from '@/components/Fab/FabPage';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FabCard from '@/components/Fab/FabCard';
import RequestFlow from '@/components/Fab/RequestFlow';
import UrgencyPill from '@/components/Fab/UrgencyPill';
import StatusPill from '@/components/Fab/StatusPill';
const F=I;
const FabRequestList=({navigate,initialTab='all',titleOverride,drafts=false})=>{const{data:requests,loading,error,refresh}=useRequests();const[tab,setTab]=React.useState(initialTab);const[search,setSearch]=React.useState('');const[urgency,setUrgency]=React.useState('all');const[sort,setSort]=React.useState('newest');const[deletingId,setDeletingId]=React.useState(null);const counts=React.useMemo(()=>Object.fromEntries(TABS.map(t=>[t.id,requests.filter(t.filter).length])),[requests]);const baseList=drafts?requests.filter(r=>r.status==='draft'):requests;const tabFilter=drafts?()=>true:TABS.find(t=>t.id===tab)?.filter||(()=>true);const list=React.useMemo(()=>{let l=baseList.filter(tabFilter);if(search.trim()){const q=search.toLowerCase();l=l.filter(r=>r.title.toLowerCase().includes(q)||String(r.id).includes(q));}if(urgency!=='all')l=l.filter(r=>r.urgency===urgency);if(sort==='newest')l=[...l].sort((a,b)=>b.id-a.id);if(sort==='oldest')l=[...l].sort((a,b)=>a.id-b.id);return l;},[baseList,tab,search,urgency,sort,drafts]);const inProgressCount=requests.filter(r=>r.status==='in_progress').length;const onRowClick=r=>navigate(drafts?{page:'fab_draft_edit',id:r.id}:{page:'fab_request',id:r.id});const handleDeleteDraft=r=>{if(!window.confirm(`Delete draft "${r.title||'Untitled draft'}"? This cannot be undone.`))return;setDeletingId(r.id);api.requests.deleteDraft(r.id).then(()=>refresh()).catch(err=>window.alert('Failed to delete draft: '+(err.message||String(err)))).finally(()=>setDeletingId(null));};if(loading&&requests.length===0){return<FabPage title={titleOverride||'My Requests'}subtitle=""right={<PrimaryBtn icon={<F.Plus size={16}/>}onClick={()=>navigate({page:'fab_new'})}>New Request</PrimaryBtn>}>
          <div style={{padding:'60px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:14}}>
            Loading…
          </div>
        </FabPage>;}return<FabPage title={titleOverride||'My Requests'}subtitle={drafts?`${baseList.length} draft${baseList.length===1?'':'s'} — finish and submit`:`${requests.length} total · ${inProgressCount} in progress`}right={<PrimaryBtn icon={<F.Plus size={16}/>}onClick={()=>navigate({page:'fab_new'})}>New Request</PrimaryBtn>}>
        {error&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
            Failed to load requests: {error}
          </div>}
        {}
        {!drafts&&<div style={{display:'flex',gap:22,borderBottom:'1px solid rgba(0,0,0,0.07)',marginBottom:22}}>
            {TABS.map(t=>{const active=t.id===tab;return<button key={t.id}onClick={()=>setTab(t.id)}style={{position:'relative',display:'inline-flex',alignItems:'center',gap:8,padding:'12px 0 14px',cursor:'pointer',color:active?'var(--text-primary)':'var(--text-secondary)',fontSize:14,fontWeight:active?700:500}}>
                  {t.label}
                  <span style={{minWidth:22,height:19,padding:'0 7px',borderRadius:999,fontSize:11,fontWeight:700,background:active?'#1e1e24':'#ebebf0',color:active?'#fff':'#5a5a6e',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{counts[t.id]}</span>
                  {active&&<span style={{position:'absolute',left:0,right:0,bottom:-1,height:2,background:'#1e1e24',borderRadius:2}}/>}
                </button>;})}
          </div>}

        {}
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14,flexWrap:'wrap'}}>
          <div style={{position:'relative',flex:'1 1 320px',maxWidth:380}}>
            <F.Search size={14}color="#a8a8b8"style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}/>
            <input value={search}onChange={e=>setSearch(e.target.value)}placeholder="Search by title or ID..."style={{width:'100%',padding:'10px 14px 10px 36px',borderRadius:10,border:'1px solid rgba(0,0,0,0.1)',background:'#fff',fontSize:13.5,color:'var(--text-primary)',outline:'none',fontFamily:'inherit'}}onFocus={e=>{e.target.style.borderColor='#6c67b8';e.target.style.boxShadow='0 0 0 3px rgba(108,103,184,0.12)';}}onBlur={e=>{e.target.style.borderColor='rgba(0,0,0,0.1)';e.target.style.boxShadow='none';}}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13,color:'var(--text-secondary)',fontWeight:600}}>Urgency:</span>
            {[{id:'all',label:'All'},{id:'3d',label:'3 Days'},{id:'1w',label:'1 Week'},{id:'2w',label:'2 Weeks'}].map(u=>{const active=urgency===u.id;return<button key={u.id}onClick={()=>setUrgency(u.id)}style={{padding:'6px 14px',borderRadius:999,background:active?'#e8e7f6':'transparent',color:active?'#5550a0':'var(--text-secondary)',border:active?'1px solid #c9c4ee':'1px solid transparent',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>{u.label}</button>;})}
          </div>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13,color:'var(--text-secondary)',fontWeight:600}}>Sort:</span>
            <select value={sort}onChange={e=>setSort(e.target.value)}style={{padding:'8px 32px 8px 12px',borderRadius:8,border:'1px solid rgba(0,0,0,0.1)',background:'#fff',fontSize:13,fontWeight:600,color:'var(--text-primary)',appearance:'none',cursor:'pointer',backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23777788\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center',fontFamily:'inherit'}}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:14}}>
          Showing <strong style={{color:'var(--text-primary)'}}>{list.length}</strong> of {baseList.length} requests
        </div>

        {}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {list.length===0?<FabCard padding={48}style={{textAlign:'center',color:'var(--text-muted)'}}>
              <F.ClipboardList size={32}color="#cbcbd6"style={{marginBottom:10}}/>
              <div style={{fontSize:14,fontWeight:600,color:'var(--text-secondary)'}}>No requests match these filters</div>
            </FabCard>:list.map(r=><button key={r.id}onClick={()=>onRowClick(r)}style={{display:'grid',gridTemplateColumns:drafts?'72px minmax(0,1fr) 180px 24px':'72px minmax(0,1fr) 140px 110px 130px 24px',alignItems:'center',gap:18,padding:'18px 22px',borderRadius:14,background:'#fff',border:'1px solid rgba(0,0,0,0.08)',textAlign:'left',cursor:'pointer',transition:'border 0.12s, background 0.12s',fontFamily:'inherit'}}onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.18)';}}onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.08)';}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'#a8a8b8',letterSpacing:'0.02em'}}>
                #{String(r.id).padStart(4,'0')}
              </span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:'var(--text-primary)'}}>{r.title||'Untitled draft'}</div>
                <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,fontSize:12.5,color:'var(--text-muted)'}}>
                  <F.Calendar size={12}/>
                  <span style={{fontFamily:'var(--font-mono)'}}>{r.created.split(' ')[0]}</span>
                  <span>·</span>
                  <span>{r.sampleCount??r.samples.length} wafer{(r.sampleCount??r.samples.length)===1?'':'s'}</span>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'flex-start',alignItems:'center',gap:10}}>
                {drafts?<>
                    <span style={{fontSize:12.5,fontWeight:600,color:'#6c67b8',display:'inline-flex',alignItems:'center',gap:6}}>
                      <F.FilePlus size={13}/> Continue editing
                    </span>
                    <span role="button"tabIndex={0}title="Delete draft"onClick={e=>{e.stopPropagation();handleDeleteDraft(r);}}onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.stopPropagation();handleDeleteDraft(r);}}}style={{display:'inline-flex',alignItems:'center',padding:'4px 5px',borderRadius:6,cursor:deletingId===r.id?'default':'pointer',color:deletingId===r.id?'#bbb':'#c0394a',transition:'background 0.12s',pointerEvents:deletingId===r.id?'none':'auto'}}onMouseEnter={e=>{if(deletingId!==r.id)e.currentTarget.style.background='#fde4e4';}}onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                      <F.Trash size={13}/>
                    </span>
                  </>:<RequestFlow request={r}/>}
              </div>
              {!drafts&&<div style={{display:'flex',justifyContent:'flex-start'}}>
                  <UrgencyPill urgency={r.urgency}size="md"/>
                </div>}
              {!drafts&&<div style={{display:'flex',justifyContent:'flex-start'}}>
                  <StatusPill status={r.status}size="md"/>
                </div>}
              <F.ChevronRight size={15}color="#cbcbd6"/>
            </button>)}
        </div>
      </FabPage>;};
export default FabRequestList;
export { FabRequestList };
