// @ts-nocheck
"use client";
import RECIPES from '@/components/Lab/RECIPES';

const recipesFor=expId=>RECIPES.filter(r=>r.expId===expId);
export default recipesFor;
export { recipesFor };
