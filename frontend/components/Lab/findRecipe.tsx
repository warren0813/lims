// @ts-nocheck
"use client";
import RECIPES from '@/components/Lab/RECIPES';

const findRecipe=id=>RECIPES.find(r=>r.id===id);
export default findRecipe;
export { findRecipe };
