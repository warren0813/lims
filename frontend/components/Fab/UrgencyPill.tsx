// @ts-nocheck
"use client";
import URGENCY_LABEL from '@/components/Manager/URGENCY_LABEL';
import Pill from '@/components/Manager/Pill';

const UrgencyPill=({urgency,size='sm'})=>{const m=URGENCY_LABEL[urgency]||URGENCY_LABEL['1w'];return<Pill{...m}size={size}/>;};
export default UrgencyPill;
export { UrgencyPill };
