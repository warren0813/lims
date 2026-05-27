// @ts-nocheck
"use client";
import EXPERIMENTS from '@/components/Lab/EXPERIMENTS';

const findExp=id=>EXPERIMENTS.find(e=>e.id===id);
export default findExp;
export { findExp };
