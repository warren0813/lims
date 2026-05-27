// @ts-nocheck
"use client";
import React from 'react';
import api from '@/lib/api';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';

const CancelRequestModal=({requestId,onClose,onCancelled,showToast})=>{const[reason,setReason]=React.useState('');const[busy,setBusy]=React.useState(false);const[err,setErr]=React.useState(null);const canConfirm=reason.trim().length>0&&!busy;const confirm=async()=>{setBusy(true);setErr(null);try{await api.requests.cancel(requestId,reason.trim());showToast&&showToast(`Request #${requestId} cancelled`);onCancelled&&onCancelled();}catch(e){setErr(e.message||String(e));}finally{setBusy(false);}};return<div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(20,20,28,0.42)',backdropFilter:'blur(2px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}onClick={onClose}>
        <div onClick={e=>e.stopPropagation()}style={{width:'min(460px, 100%)',background:'#fff',borderRadius:14,boxShadow:'0 24px 60px rgba(20,20,28,0.32)',padding:24}}>
          <div style={{fontSize:17,fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>
            Cancel Request #{String(requestId).padStart(4,'0')}
          </div>
          <div style={{fontSize:13.5,color:'var(--text-secondary)',marginBottom:14,lineHeight:1.5}}>
            Cancellation is permanent. The lab will see your reason in the request history.
          </div>
          <label style={{fontSize:11.5,fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.06em'}}>
            Reason <span style={{color:'#c0394a'}}>*</span>
          </label>
          <textarea value={reason}onChange={e=>setReason(e.target.value)}rows={4}autoFocus placeholder="Why is this request being cancelled?"style={{width:'100%',marginTop:6,padding:'10px 12px',borderRadius:8,border:'1px solid rgba(0,0,0,0.16)',fontSize:13.5,fontFamily:'inherit',resize:'vertical',outline:'none'}}/>
          {err&&<div style={{marginTop:12,padding:'10px 12px',borderRadius:8,background:'#fde4e4',color:'#c0394a',fontSize:13,fontWeight:500,border:'1px solid #f6c4c4'}}>
              {err}
            </div>}
          <div style={{marginTop:18,display:'flex',justifyContent:'flex-end',gap:10}}>
            <SecondaryBtn onClick={onClose}disabled={busy}>Keep request</SecondaryBtn>
            <PrimaryBtn disabled={!canConfirm}onClick={confirm}style={{background:canConfirm?'#c0394a':'#cbcbd6'}}>
              {busy?'Cancelling…':'Cancel request'}
            </PrimaryBtn>
          </div>
        </div>
      </div>;};
export default CancelRequestModal;
export { CancelRequestModal };
