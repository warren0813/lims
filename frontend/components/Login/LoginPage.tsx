// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import ACCOUNTS from '@/components/Login/ACCOUNTS';
import I from '@/components/ui/I';

const LoginPage=({onLogin})=>{const[username,setUsername]=React.useState('');const[password,setPassword]=React.useState('');const[error,setError]=React.useState('');const[showPw,setShowPw]=React.useState(false);const[busy,setBusy]=React.useState(false);const submit=async e=>{e.preventDefault();setError('');const u=username.trim();if(!u||!password){setError('Username and password required');return;}if(api&&api.auth){setBusy(true);try{const user=await api.auth.login(u,password);onLogin({username:user.username,role:user.role,display:user.username,subtitle:user.department||user.role});}catch(err){setError(err.message||'Sign-in failed');}finally{setBusy(false);}return;}const acct=ACCOUNTS[u];if(!acct||acct.password!==password){setError('Invalid username or password');return;}onLogin({username:u,...acct});};const fillDemo=u=>{setUsername(u);setPassword(ACCOUNTS[u].password);setError('');};return<div style={{display:'flex',minHeight:'100vh',background:'#fff'}}>
      {}
      <div style={{flex:'1 1 50%',minWidth:0,position:'relative',overflow:'hidden',background:'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0a1628 100%)',color:'#fff',padding:'40px 56px',display:'flex',flexDirection:'column'}}>
        {}
        <div style={{position:'absolute',inset:0,opacity:0.35,backgroundImage:'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',backgroundSize:'48px 48px'}}/>
        {}
        <div style={{position:'absolute',top:-80,right:-80,width:380,height:380,borderRadius:'50%',background:'radial-gradient(circle, rgba(108,103,184,0.32) 0%, transparent 65%)',filter:'blur(40px)'}}/>
        <div style={{position:'absolute',bottom:-100,left:-60,width:320,height:320,borderRadius:'50%',background:'radial-gradient(circle, rgba(244,168,191,0.20) 0%, transparent 65%)',filter:'blur(40px)'}}/>

        {}
        <div style={{display:'flex',alignItems:'center',gap:12,position:'relative',zIndex:1}}>
          <div style={{width:44,height:44,borderRadius:11,background:'linear-gradient(135deg, #f4a8bf 0%, #bbb7e8 100%)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 18px rgba(244,168,191,0.4)'}}>
            <I.Flask size={22}color="#0f172a"/>
          </div>
          <div style={{fontSize:22,fontWeight:700,letterSpacing:'-0.01em'}}>LIMS</div>
        </div>

        <div style={{flex:1}}/>

        {}
        <div style={{position:'relative',zIndex:1}}>
          <h1 style={{fontSize:56,fontWeight:700,lineHeight:1.05,letterSpacing:'-0.025em',maxWidth:560}}>
            Laboratory Information<br/>Management System
          </h1>
          <p style={{marginTop:24,fontSize:16,lineHeight:1.55,color:'rgba(226,232,240,0.72)',maxWidth:480}}>
            End-to-end lab operations — commission requests, sample tracking, experiment dispatch, and reporting in one unified platform.
          </p>
        </div>

        <div style={{flex:1}}/>

        {}
        <div style={{display:'flex',gap:56,position:'relative',zIndex:1}}>
          {[{v:'3',l:'User Roles'},{v:'12+',l:'Workflow States'},{v:'Full',l:'Audit Trail'}].map(s=><div key={s.l}>
              <div style={{fontSize:32,fontWeight:700,letterSpacing:'-0.02em'}}>{s.v}</div>
              <div style={{fontSize:13,color:'rgba(226,232,240,0.55)',marginTop:4}}>{s.l}</div>
            </div>)}
        </div>
      </div>

      {}
      <div style={{flex:'1 1 50%',minWidth:0,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 56px',background:'#fafbfd'}}>
        <form onSubmit={submit}style={{width:'100%',maxWidth:400}}>
          <h2 style={{fontSize:32,fontWeight:700,letterSpacing:'-0.02em',color:'#0f172a'}}>Sign in</h2>
          <p style={{marginTop:6,fontSize:14,color:'#64748b'}}>Enter your credentials to continue</p>

          <div style={{marginTop:32}}>
            <label style={{display:'block',fontSize:13,fontWeight:600,color:'#334155',marginBottom:8}}>Username</label>
            <input value={username}onChange={e=>{setUsername(e.target.value);setError('');}}placeholder="username"style={{width:'100%',padding:'12px 14px',borderRadius:8,background:'#eef2f9',border:'1px solid transparent',fontSize:14,color:'#0f172a',outline:'none',transition:'border-color 0.15s, background 0.15s'}}onFocus={e=>{e.target.style.borderColor='#3b82f6';e.target.style.background='#fff';}}onBlur={e=>{e.target.style.borderColor='transparent';e.target.style.background='#eef2f9';}}autoComplete="username"/>
          </div>

          <div style={{marginTop:18}}>
            <label style={{display:'block',fontSize:13,fontWeight:600,color:'#334155',marginBottom:8}}>Password</label>
            <div style={{position:'relative'}}>
              <input type={showPw?'text':'password'}value={password}onChange={e=>{setPassword(e.target.value);setError('');}}placeholder="••••••••••"style={{width:'100%',padding:'12px 42px 12px 14px',borderRadius:8,background:'#eef2f9',border:'1px solid transparent',fontSize:14,color:'#0f172a',outline:'none',transition:'border-color 0.15s, background 0.15s'}}onFocus={e=>{e.target.style.borderColor='#3b82f6';e.target.style.background='#fff';}}onBlur={e=>{e.target.style.borderColor='transparent';e.target.style.background='#eef2f9';}}autoComplete="current-password"/>
              <button type="button"onClick={()=>setShowPw(s=>!s)}style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#64748b',padding:6,borderRadius:4}}aria-label="Toggle password">
                {showPw?<I.EyeOff size={16}/>:<I.Eye size={16}/>}
              </button>
            </div>
          </div>

          {error&&<div style={{marginTop:14,padding:'10px 12px',borderRadius:8,background:'#fef2f2',border:'1px solid #fecaca',color:'#b91c1c',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
              <I.Alert size={14}/> {error}
            </div>}

          <button type="submit"disabled={busy}style={{marginTop:24,width:'100%',padding:'13px 14px',borderRadius:8,background:'var(--tweak-signin-bg, #6c67b8)',color:'var(--tweak-signin-fg, #fff)',fontWeight:600,fontSize:15,transition:'background 0.15s, filter 0.15s',boxShadow:'0 1px 2px rgba(108,103,184,0.30)',opacity:busy?0.7:1,cursor:busy?'wait':'pointer'}}onMouseEnter={e=>{if(!busy)e.currentTarget.style.filter='brightness(0.92)';}}onMouseLeave={e=>e.currentTarget.style.filter='none'}>{busy?'Signing in…':'Sign In'}</button>

          {}
          <div style={{marginTop:28,padding:14,borderRadius:10,background:'#fff',border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Demo accounts</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {Object.entries(ACCOUNTS).map(([u,a])=><button key={u}type="button"onClick={()=>fillDemo(u)}style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:6,textAlign:'left',transition:'background 0.12s'}}onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'}onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:u==='fab_user'?'var(--tweak-fab-bg, linear-gradient(135deg, #f4a8bf, #bbb7e8))':'linear-gradient(135deg, #f4a8bf, #bbb7e8)',color:'#fff',fontSize:12,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{u[0].toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#0f172a',lineHeight:1.3}}>{u}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{a.subtitle} · click to fill</div>
                  </div>
                  <I.ChevronRight size={14}color="#cbd5e1"/>
                </button>)}
            </div>
          </div>
        </form>
      </div>
    </div>;};
export default LoginPage;
export { LoginPage };
