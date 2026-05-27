// @ts-nocheck
"use client";
import AddDispatchModalInner from '@/components/Lab/AddDispatchModalInner';

const AddDispatchModal=({open,onClose,wip,onCreated})=>{if(!open||!wip)return null;return<AddDispatchModalInner onClose={onClose}wip={wip}onCreated={onCreated}/>;};
export default AddDispatchModal;
export { AddDispatchModal };
