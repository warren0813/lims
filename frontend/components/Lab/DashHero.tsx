// @ts-nocheck
"use client";
import React from 'react';
import TODAY from '@/components/Lab/TODAY';

const DashHero=({counts,navigate})=>{const hour=new Date().getHours();const greeting=hour<5?'Working late':hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';const stars=React.useMemo(()=>{const arr=[];const rng=seed=>{let x=seed*9301+49297;return x%233280/233280;};for(let i=0;i<38;i++){arr.push({left:rng(i+1)*100,top:rng(i+17)*100,size:1+rng(i+31)*2.4,delay:rng(i+47)*6,dur:3.5+rng(i+53)*4});}return arr;},[]);return<div style={{position:'relative',overflow:'hidden',borderRadius:18,marginBottom:22,background:'linear-gradient(135deg, #1a1726 0%, #2a2342 45%, #3a2a4f 100%)',color:'#fff',padding:'36px 40px 32px',boxShadow:'0 14px 40px -16px rgba(36, 28, 64, 0.45)'}}>
      {}
      <div style={{position:'absolute',inset:0,opacity:0.3,backgroundImage:'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',backgroundSize:'20px 20px',pointerEvents:'none'}}/>
      {}
      {stars.map((s,i)=><span key={i}style={{position:'absolute',left:`${s.left}%`,top:`${s.top}%`,width:s.size,height:s.size,borderRadius:999,background:i%3===0?'#f4a8bf':i%3===1?'#bbb7e8':'#fff',opacity:0.6,pointerEvents:'none',animation:`lims-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`}}/>)}
      {}
      <div style={{position:'absolute',right:-120,top:-80,width:360,height:360,borderRadius:999,background:'radial-gradient(circle at center, rgba(244,168,191,0.35), rgba(244,168,191,0) 65%)',pointerEvents:'none',filter:'blur(8px)'}}/>
      <div style={{position:'absolute',right:80,bottom:-100,width:280,height:280,borderRadius:999,background:'radial-gradient(circle at center, rgba(108,103,184,0.45), rgba(108,103,184,0) 65%)',pointerEvents:'none',filter:'blur(8px)'}}/>

      <div style={{position:'relative',display:'grid',gridTemplateColumns:'1fr auto',alignItems:'flex-end',gap:32}}>
        <div>
          <div style={{fontSize:12,fontWeight:600,letterSpacing:'0.18em',textTransform:'uppercase',color:'#bbb7e8',marginBottom:14}}>
            ✦ Lab Operations · {TODAY}
          </div>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:38,fontWeight:600,margin:0,letterSpacing:'-0.02em',lineHeight:1.1,color:'#fff'}}>
            {greeting},<br/>
            <span style={{background:'linear-gradient(90deg, #f4a8bf, #bbb7e8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>lab_member</span>
          </h1>
          <div style={{marginTop:14,fontSize:14,color:'#d8d4eb',maxWidth:520,lineHeight:1.55}}>
            {counts.running>0?<>{counts.running} experiment{counts.running===1?'':'s'} running. {counts.needsRecord>0?`${counts.needsRecord} awaiting your result.`:'No results pending.'}</>:counts.incoming>0?<>{counts.incoming} wafer{counts.incoming===1?'':'s'} just arrived from the fab.</>:<>Quiet shift. All chambers clear.</>}
          </div>
        </div>

        {}
        <div style={{display:'flex',gap:14,position:'relative'}}>
          {[{v:counts.running,l:'Running',c:'#f4a8bf',onClick:()=>navigate({page:'lab_dispatches',tab:'active'}),pulse:counts.running>0},{v:counts.needsRecord,l:'To record',c:'#bbb7e8',onClick:()=>navigate({page:'lab_dispatches',tab:'record'})},{v:counts.incoming,l:'Incoming',c:'#6c67b8',onClick:()=>navigate({page:'lab_samples',tab:'incoming'})}].map(s=><button key={s.l}onClick={s.onClick}style={{width:110,padding:'14px 12px',borderRadius:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',backdropFilter:'blur(6px)',cursor:'pointer',fontFamily:'inherit',textAlign:'center',position:'relative',transition:'transform 0.18s, background 0.18s'}}onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.10)';e.currentTarget.style.transform='translateY(-2px)';}}onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.transform='translateY(0)';}}>
              <div style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:6}}>
                {s.pulse&&<span style={{position:'absolute',inset:-2,borderRadius:999,border:`2px solid ${s.c}`,opacity:0.6,animation:'pulse 1.6s ease-in-out infinite'}}/>}
                <span style={{width:8,height:8,borderRadius:999,background:s.c,boxShadow:`0 0 10px ${s.c}`}}/>
              </div>
              <div style={{fontFamily:'var(--font-display)',fontSize:30,fontWeight:700,color:'#fff',letterSpacing:'-0.02em',lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:11,color:'#bbb7e8',marginTop:6,fontWeight:600,letterSpacing:'0.04em'}}>{s.l}</div>
            </button>)}
        </div>
      </div>
    </div>;};
export default DashHero;
export { DashHero };
