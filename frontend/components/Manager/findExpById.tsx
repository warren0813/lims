// @ts-nocheck
"use client";
import MGR_EXPERIMENTS from '@/components/Manager/MGR_EXPERIMENTS';

const findExpById=id=>MGR_EXPERIMENTS.find(e=>e.id===id);
export default findExpById;
export { findExpById };
