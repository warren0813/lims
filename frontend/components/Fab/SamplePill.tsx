// @ts-nocheck
"use client";
import SAMPLE_STATUS_LABEL from '@/components/Fab/SAMPLE_STATUS_LABEL';
import Pill from '@/components/Manager/Pill';

const SamplePill=({status,size='sm'})=>{const m=SAMPLE_STATUS_LABEL[status]||{label:status,bg:'#ebebf0',fg:'#5a5a6e'};return<Pill{...m}size={size}/>;};
export default SamplePill;
export { SamplePill };
