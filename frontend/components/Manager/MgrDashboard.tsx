// @ts-nocheck
"use client";
import * as I from '@/components/ui/I';
import useMgrDashboardData from '@/components/Manager/useMgrDashboardData';
import Page from '@/components/Manager/Page';
import MgrStatTile from '@/components/Manager/MgrStatTile';
import Card from '@/components/Manager/Card';
import CardHeader from '@/components/Manager/CardHeader';
import mAccent from '@/components/Manager/mAccent';
import mMuted from '@/components/Manager/mMuted';
import mLineSft from '@/components/Manager/mLineSft';
import mInk from '@/components/Manager/mInk';
import mText2 from '@/components/Manager/mText2';
import Pill from '@/components/Manager/Pill';
import URGENCY_LABEL from '@/components/Manager/URGENCY_LABEL';
import TrendChart from '@/components/Manager/TrendChart';
const MI=I;
const MgrDashboard=({navigate})=>{const{requests,equipmentCount,loading:countsLoading,error:countsError}=useMgrDashboardData();const pending=requests.filter(r=>r.status==='submitted');const inProgress=requests.filter(r=>r.status==='in_progress').length;const completed=requests.filter(r=>r.status==='completed').length;const initialLoad=countsLoading&&requests.length===0;const v=n=>initialLoad?'—':n;return<Page title="Dashboard"subtitle="Welcome back, lab_manager">
      {countsError&&<div style={{padding:'12px 16px',marginBottom:14,borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>
          Couldn't load tile counts: {countsError}
        </div>}
      {}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:14,marginBottom:22}}>
        <MgrStatTile label="To approve"value={v(pending.length)}icon={<MI.Clock size={16}/>}tint="#fef0d4"accent="#b8720e"onClick={()=>navigate({page:'mgr_all_requests'})}/>
        <MgrStatTile label="In Progress"value={v(inProgress)}icon={<MI.Activity size={16}/>}tint="#ecebf3"accent="#5550a0"onClick={()=>navigate({page:'mgr_all_requests'})}/>
        <MgrStatTile label="Completed"value={v(completed)}icon={<MI.CircleCheck size={16}/>}tint="#dbeafe"accent="#1d4ed8"/>
        <MgrStatTile label="Equipment"value={v(equipmentCount)}icon={<MI.Equipment size={16}/>}tint="#ecebf3"accent="#4f4a8f"onClick={()=>navigate({page:'lab_equipment'})}/>
      </div>

      <Card padding={0}style={{borderColor:'rgba(108,103,184,0.32)',boxShadow:'0 8px 28px -18px rgba(108,103,184,0.45)'}}>
        <CardHeader style={{background:'linear-gradient(90deg, rgba(244,168,191,0.12), rgba(187,183,232,0.12))'}}>
          <MI.ClipboardList size={13}color={mAccent}/>
          <span>Awaiting your Response</span>
          <span style={{marginLeft:'auto',padding:'2px 8px',borderRadius:999,background:'#ecebf3',color:'#4f4a8f',fontSize:11,fontWeight:700}}>{pending.length}</span>
        </CardHeader>
        {pending.length===0?<div style={{padding:'28px 22px',textAlign:'center',color:mMuted,fontSize:13}}>
            All clear — nothing waiting on you.
          </div>:pending.map(r=><button key={r.id}onClick={()=>navigate({page:'mgr_request',id:r.id})}style={{display:'grid',gridTemplateColumns:'90px 1fr 110px 130px auto',alignItems:'center',gap:14,width:'100%',padding:'14px 22px',borderTop:`1px solid ${mLineSft}`,background:'#fff',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'background 0.12s'}}onMouseEnter={e=>e.currentTarget.style.background='#fafafd'}onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:mMuted}}>
              #{String(r.id).padStart(4,'0')}
            </span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:mInk}}>{r.title}</div>
              <div style={{fontSize:12,color:mMuted,marginTop:3,display:'inline-flex',alignItems:'center',gap:6,flexWrap:'wrap',whiteSpace:'nowrap'}}>
                <MI.Calendar size={11}/>
                <span style={{fontFamily:'var(--font-mono)'}}>{(r.submitted||r.created||'').split(' ')[0]||'—'}</span>
                <span aria-hidden>·</span>
                <span>{r.sampleCount??r.samples.length} wafer{(r.sampleCount??r.samples.length)===1?'':'s'}</span>
                <span aria-hidden>·</span>
                <span>by <span style={{fontFamily:'var(--font-mono)',color:mText2}}>{r.requester?.username||r.history[0]?.by||'—'}</span></span>
              </div>
            </div>
            <Pill kind={r.urgency}mapping={URGENCY_LABEL}/>
            <Pill kind={r.status}/>
            <span style={{fontSize:12.5,fontWeight:700,color:mAccent,display:'inline-flex',alignItems:'center',gap:4}}>
              Respond <MI.ArrowRight size={12}color={mAccent}/>
            </span>
          </button>)}
      </Card>

      <TrendChart/>
    </Page>;};
export default MgrDashboard;
export { MgrDashboard };
