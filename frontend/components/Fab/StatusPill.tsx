// @ts-nocheck
"use client";
import STATUS_LABEL from '@/components/Manager/STATUS_LABEL';
import Pill from '@/components/Manager/Pill';

const StatusPill=({status,size='md'})=>{const m=STATUS_LABEL[status]||{label:status,bg:'#ebebf0',fg:'#5a5a6e'};return<Pill{...m}size={size}/>;};
export default StatusPill;
export { StatusPill };
