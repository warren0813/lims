// @ts-nocheck
"use client";
import React from 'react';
import * as I from '@/components/ui/I';
import useRequests from '@/components/Fab/useRequests';
import FabPage from '@/components/Fab/FabPage';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FabStatTile from '@/components/Fab/FabStatTile';
import FabCard from '@/components/Fab/FabCard';
import BannerHeader from '@/components/Fab/BannerHeader';
import HeaderLinkButton from '@/components/Fab/HeaderLinkButton';
import InProgressRow from '@/components/Fab/InProgressRow';
import StatusPill from '@/components/Fab/StatusPill';
const F=I;
const FabDashboard=({navigate})=>{const{data:requests,loading,error}=useRequests();const inProgress=requests.filter(r=>r.status==='in_progress').slice(0,5);const drafts=requests.filter(r=>r.status==='draft');const attention=requests.filter(r=>r.status==='returned'||r.status==='rejected').slice(0,3);const waitingApproval=requests.filter(r=>r.status==='submitted');const[expandedId,setExpandedId]=React.useState(undefined);React.useEffect(()=>{if(expandedId===undefined&&inProgress.length>0)setExpandedId(inProgress[0].id);},[inProgress,expandedId]);const activity=React.useMemo(()=>{const items=[];requests.forEach(r=>{const at=r.updated||r.created;if(!at)return;const rs=r.rawStatus;if(rs==='approved')items.push({action:'APPROVE',at,request:r});else if(rs==='sample_shipped')items.push({action:'SHIP',at,request:r});else if(rs==='in_progress')items.push({action:'IN_PROG',at,request:r});else if(rs==='completed')items.push({action:'COMPLETED',at,request:r});else if(rs==='returned')items.push({action:'RETURN',at,request:r});else if(rs==='rejected')items.push({action:'REJECT',at,request:r});});return items.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,10);},[requests]);if(loading&&requests.length===0){return<FabPage title="Dashboard"subtitle="Welcome back, fab_user"right={<PrimaryBtn icon={<F.Plus size={16}/>}onClick={()=>navigate({page:'fab_new'})}>New Request</PrimaryBtn>}>
          <div style={{padding:'60px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:14}}>
            Loading…
          </div>
        </FabPage>;}return<FabPage title="Dashboard"subtitle="Welcome back, fab_user"right={<PrimaryBtn icon={<F.Plus size={16}/>}onClick={()=>navigate({page:'fab_new'})}>New Request</PrimaryBtn>}>
        {error&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
            Failed to load requests: {error}
          </div>}
        {}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:14,marginBottom:18}}>
          <FabStatTile label="Waiting Approval"value={waitingApproval.length}icon={<F.Clock size={16}/>}tint="#fef0d4"accent="#b8720e"onClick={()=>navigate({page:'fab_requests',tab:'all'})}/>
          <FabStatTile label="In Progress"value={inProgress.length}icon={<F.Activity size={16}/>}tint="#ecebf3"accent="#5550a0"onClick={()=>navigate({page:'fab_requests',tab:'in_progress'})}/>
          <FabStatTile label="Needs Attention"value={attention.length}icon={<F.CircleAlert size={16}/>}tint="#fceef2"accent="#a73d56"onClick={()=>navigate({page:'fab_requests',tab:'returned'})}/>
          <FabStatTile label="Drafts"value={drafts.length}icon={<F.FilePlus size={16}/>}tint="#e3eef3"accent="#2a7a91"onClick={()=>navigate({page:'fab_drafts'})}/>
        </div>

        {}
        <FabCard padding={0}style={{marginBottom:18,overflow:'hidden'}}>
          <BannerHeader icon={<F.Activity size={16}/>}title="In Progress"count={inProgress.length}accent="#bbb7e8"accentLight="#d6d3f0"right={<HeaderLinkButton accent="#bbb7e8"onClick={()=>navigate({page:'fab_requests',tab:'in_progress'})}>View all <F.ArrowRight size={13}/></HeaderLinkButton>}/>
          <div style={{display:'grid',gridTemplateColumns:'80px 1fr 130px 130px 24px',padding:'10px 24px',borderTop:'1px solid #f1f1f5',fontSize:11,fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.06em',gap:16}}>
            <div>ID</div><div>Title · Phase</div><div>Wafers</div><div>Submitted</div><div/>
          </div>
          {inProgress.map(r=><InProgressRow key={r.id}request={r}navigate={navigate}open={expandedId===r.id}onToggle={()=>setExpandedId(prev=>prev===r.id?null:r.id)}/>)}
        </FabCard>

        {}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
          {}
          <FabCard padding={0}style={{overflow:'hidden'}}>
            <BannerHeader icon={<F.CircleAlert size={16}/>}title="Needs Attention"count={attention.length}accent="#f4a8bf"accentLight="#fbd0dc"/>
            <div>
              {attention.length===0?<div style={{padding:'28px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                  Nothing flagged. Good work.
                </div>:attention.map(r=><button key={r.id}onClick={()=>navigate({page:'fab_request',id:r.id})}style={{width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderTop:'1px solid #f1f1f5',background:'#fff',cursor:'pointer',transition:'background 0.12s'}}onMouseEnter={e=>e.currentTarget.style.background='#fafafd'}onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>{r.title}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3,fontFamily:'var(--font-mono)'}}>
                      #{r.id} · {r.created.split(' ')[0]}
                    </div>
                  </div>
                  <StatusPill status={r.status}size="sm"/>
                  <F.ChevronRight size={15}color="#cbcbd6"/>
                </button>)}
            </div>
          </FabCard>

          {}
          <FabCard padding={0}style={{overflow:'hidden'}}>
            <BannerHeader icon={<F.FilePlus size={16}/>}title="Drafts"count={drafts.length}accent="#9ebbc8"accentLight="#c7dde6"right={<HeaderLinkButton accent="#9ebbc8"onClick={()=>navigate({page:'fab_drafts'})}>Open Drafts <F.ArrowRight size={13}/></HeaderLinkButton>}/>
            <div>
              {drafts.length===0?<div style={{padding:'28px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                  No drafts saved.
                  <div style={{marginTop:10}}>
                    <button onClick={()=>navigate({page:'fab_new'})}style={{fontSize:13,fontWeight:600,color:'#6c67b8',display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer'}}><F.Plus size={13}/> Start a new request</button>
                  </div>
                </div>:drafts.slice(0,4).map(r=><button key={r.id}onClick={()=>navigate({page:'fab_draft_edit',id:r.id})}style={{width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderTop:'1px solid #f1f1f5',background:'#fff',cursor:'pointer',transition:'background 0.12s'}}onMouseEnter={e=>e.currentTarget.style.background='#fafafd'}onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                  <F.FilePlus size={16}color="#6c67b8"style={{flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>{r.title||'Untitled draft'}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3,fontFamily:'var(--font-mono)'}}>
                      #{r.id} · {r.sampleCount??r.samples.length} wafer{(r.sampleCount??r.samples.length)===1?'':'s'} · {r.created.split(' ')[0]}
                    </div>
                  </div>
                  <span style={{fontSize:12.5,fontWeight:600,color:'#6c67b8'}}>Continue →</span>
                </button>)}
            </div>
          </FabCard>
        </div>

        {}
        <FabCard padding={0}style={{overflow:'hidden'}}>
          <BannerHeader icon={<F.Clock size={16}/>}title="Recent Activity"count={activity.length}accent="#a8a8b8"accentLight="#d4d4dc"right={<span style={{fontSize:11.5,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,0.72)'}}>Last 10 events</span>}/>

          <div style={{padding:'24px 28px 26px'}}>
            {(()=>{const STYLES={APPROVE:{dot:'#1f8a5b',tintBg:'#e8f6ee',tintFg:'#157a4a',verb:'Approved',icon:c=><F.Check size={12}color={c}strokeWidth={3}/>,text:a=><>{a.request.title} approved — awaiting sample shipment</>},SHIP:{dot:'#2980b9',tintBg:'#ddeef8',tintFg:'#1a6696',verb:'Shipped',icon:c=><F.Package size={11}color={c}strokeWidth={2.5}/>,text:a=><>{a.request.title} — samples shipped to lab</>},IN_PROG:{dot:'#6c67b8',tintBg:'#ecebf7',tintFg:'#5550a0',verb:'In Progress',icon:c=><F.Activity size={11}color={c}strokeWidth={2.5}/>,text:a=><>{a.request.title} — processing in progress</>},COMPLETED:{dot:'#0f766e',tintBg:'#ccfbf1',tintFg:'#0f766e',verb:'Completed',icon:c=><F.CircleCheck size={11}color={c}strokeWidth={2.5}/>,text:a=><>{a.request.title} — experiment completed</>},RETURN:{dot:'#c1556e',tintBg:'#fceef2',tintFg:'#a73d56',verb:'Returned',icon:c=><F.Refresh size={11}color={c}strokeWidth={2.5}/>,text:a=><>{a.request.title} returned for correction</>},REJECT:{dot:'#d24a5d',tintBg:'#fde6e6',tintFg:'#c0394a',verb:'Rejected',icon:c=><F.X size={11}color={c}strokeWidth={3}/>,text:a=><>{a.request.title} rejected</>}};const MONTH=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const groups={};activity.forEach(a=>{const day=a.at.split(' ')[0];(groups[day]=groups[day]||[]).push(a);});const days=Object.keys(groups).sort().reverse();return<div style={{position:'relative'}}>
                  {}
                  <div style={{position:'absolute',left:76,top:8,bottom:8,width:2,background:'linear-gradient(180deg, #e2e2ea 0%, #f1f1f5 100%)',borderRadius:2}}/>

                  {days.map((day,di)=>{const[,m,d]=day.split('-');const items=groups[day];return<div key={day}style={{display:'flex',flexDirection:'column',gap:12,marginBottom:di===days.length-1?0:22}}>
                        {items.map((a,i)=>{const s=STYLES[a.action];if(!s)return null;const time=a.at.split(' ')[1];return<div key={i}style={{position:'relative',display:'grid',gridTemplateColumns:'60px 36px 1fr',alignItems:'center',gap:16}}>
                              {}
                              {i===0?<div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'6px 0',borderRadius:8,background:'#1e1e24',color:'#fff'}}>
                                  <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,0.66)'}}>{MONTH[parseInt(m,10)-1]}</span>
                                  <span style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,lineHeight:1,marginTop:2}}>{String(parseInt(d,10)).padStart(2,'0')}</span>
                                </div>:<div/>}
                              {}
                              <div style={{display:'flex',justifyContent:'center',position:'relative'}}>
                                <div style={{width:28,height:28,borderRadius:999,background:'#fff',border:`2px solid ${s.dot}`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 0 4px #fff, 0 1px 4px rgba(30,30,36,0.08)`}}>{s.icon(s.dot)}</div>
                              </div>
                              {}
                              <div style={{minWidth:0,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                                <span style={{padding:'3px 9px',borderRadius:999,background:s.tintBg,color:s.tintFg,fontSize:11,fontWeight:700,letterSpacing:'0.04em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{s.verb}</span>
                                <span style={{fontSize:13.5,color:'var(--text-primary)',fontWeight:500}}>
                                  {s.text(a)}
                                </span>
                                <span style={{marginLeft:'auto',fontSize:12,fontFamily:'var(--font-mono)',color:'var(--text-muted)'}}>{time}</span>
                              </div>
                            </div>;})}
                      </div>;})}
                </div>;})()}
          </div>
        </FabCard>
      </FabPage>;};
export default FabDashboard;
export { FabDashboard };
