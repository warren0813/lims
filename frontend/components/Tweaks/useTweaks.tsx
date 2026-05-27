// @ts-nocheck
"use client";
import React from 'react';

function useTweaks(defaults){const[values,setValues]=React.useState(defaults);const setTweak=React.useCallback((keyOrEdits,val)=>{const edits=typeof keyOrEdits==='object'&&keyOrEdits!==null?keyOrEdits:{[keyOrEdits]:val};setValues(prev=>({...prev,...edits}));window.parent.postMessage({type:'__edit_mode_set_keys',edits},'*');window.dispatchEvent(new CustomEvent('tweakchange',{detail:edits}));},[]);return[values,setTweak];}
export default useTweaks;
export { useTweaks };
