// @ts-nocheck
"use client";
import * as I from '@/components/ui/I';
import mLineSft from '@/components/Manager/mLineSft';
import mInk from '@/components/Manager/mInk';
import mMuted from '@/components/Manager/mMuted';
const MI=I;
const Modal=({open,onClose,title,children,width=580,footer})=>{if(!open)return null;return<div onClick={onClose}style={{position:'fixed',inset:0,background:'rgba(20,20,28,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20,animation:'fade-in 0.12s ease-out'}}>
      <div onClick={e=>e.stopPropagation()}style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:width,boxShadow:'0 30px 60px -20px rgba(20,20,28,0.4)',maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'20px 24px',borderBottom:`1px solid ${mLineSft}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:16,fontWeight:700,color:mInk}}>{title}</div>
          <button onClick={onClose}style={{border:'none',background:'transparent',cursor:'pointer',padding:4,color:mMuted,display:'inline-flex'}}><MI.X size={18}/></button>
        </div>
        <div style={{padding:24,overflow:'auto'}}>{children}</div>
        {footer&&<div style={{padding:'14px 24px',borderTop:`1px solid ${mLineSft}`,display:'flex',justifyContent:'flex-end',gap:10}}>{footer}</div>}
      </div>
    </div>;};
export default Modal;
export { Modal };
