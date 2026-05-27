// @ts-nocheck
"use client";
import React from 'react';
import Modal from '@/components/Manager/Modal';
import SecondaryBtn from '@/components/Manager/SecondaryBtn';
import PrimaryBtn from '@/components/Manager/PrimaryBtn';
import FieldLabel from '@/components/Manager/FieldLabel';
import TextArea from '@/components/Manager/TextArea';
import mMuted from '@/components/Manager/mMuted';

const ApprovalModal=({open,onClose,action,onSubmit})=>{const[reason,setReason]=React.useState('');React.useEffect(()=>{if(open)setReason('');},[open]);const map={APPROVE:{title:'Approve request',cta:'Approve',needs:false,hint:'Optional note recorded with the approval.'},RETURN:{title:'Return request',cta:'Return',needs:true,hint:'Tell the requester what needs to change.'},REJECT:{title:'Reject request',cta:'Reject',needs:true,hint:'Tell the requester why.'}}[action]||{};const valid=!map.needs||reason.trim().length>0;return<Modal open={open}onClose={onClose}title={map.title}width={520}footer={<>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn disabled={!valid}danger={action==='REJECT'||action==='RETURN'}success={action==='APPROVE'}onClick={()=>onSubmit(reason.trim())}>{map.cta}</PrimaryBtn>
      </>}>
      <div>
        <FieldLabel required={map.needs}>Reason {map.needs?'':'(optional)'}</FieldLabel>
        <TextArea value={reason}onChange={e=>setReason(e.target.value)}placeholder={map.hint}/>
        <div style={{fontSize:12,color:mMuted,marginTop:6}}>{map.hint}</div>
      </div>
    </Modal>;};
export default ApprovalModal;
export { ApprovalModal };
