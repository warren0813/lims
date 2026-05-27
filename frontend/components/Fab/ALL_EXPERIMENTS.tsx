// @ts-nocheck
"use client";
import RA_EXPERIMENTS from '@/components/Fab/RA_EXPERIMENTS';
import TM_EXPERIMENTS from '@/components/Fab/TM_EXPERIMENTS';

const ALL_EXPERIMENTS=[...RA_EXPERIMENTS.map(e=>({...e,group:'RA'})),...TM_EXPERIMENTS.map(e=>({...e,group:'TM'}))];
export default ALL_EXPERIMENTS;
export { ALL_EXPERIMENTS };
