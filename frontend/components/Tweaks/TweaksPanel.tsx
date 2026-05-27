// @ts-nocheck
"use client";
import React from 'react';
import __TWEAKS_STYLE from '@/components/Tweaks/__TWEAKS_STYLE';
import TweakSection from '@/components/Tweaks/TweakSection';
import TweakToggle from '@/components/Tweaks/TweakToggle';

function TweaksPanel({title='Tweaks',noDeckControls=false,children}){const[open,setOpen]=React.useState(false);const dragRef=React.useRef(null);const hasDeckStage=React.useMemo(()=>typeof document!=='undefined'&&!!document.querySelector('deck-stage'),[]);const[railEnabled,setRailEnabled]=React.useState(()=>hasDeckStage&&!!document.querySelector('deck-stage')?._railEnabled);React.useEffect(()=>{if(!hasDeckStage||railEnabled)return undefined;const onMsg=e=>{if(e.data&&e.data.type==='__omelette_rail_enabled')setRailEnabled(true);};window.addEventListener('message',onMsg);return()=>window.removeEventListener('message',onMsg);},[hasDeckStage,railEnabled]);const[railVisible,setRailVisible]=React.useState(()=>{try{return localStorage.getItem('deck-stage.railVisible')!=='0';}catch(e){return true;}});const toggleRail=on=>{setRailVisible(on);window.postMessage({type:'__deck_rail_visible',on},'*');};const offsetRef=React.useRef({x:16,y:16});const PAD=16;const clampToViewport=React.useCallback(()=>{const panel=dragRef.current;if(!panel)return;const w=panel.offsetWidth,h=panel.offsetHeight;const maxRight=Math.max(PAD,window.innerWidth-w-PAD);const maxBottom=Math.max(PAD,window.innerHeight-h-PAD);offsetRef.current={x:Math.min(maxRight,Math.max(PAD,offsetRef.current.x)),y:Math.min(maxBottom,Math.max(PAD,offsetRef.current.y))};panel.style.right=offsetRef.current.x+'px';panel.style.bottom=offsetRef.current.y+'px';},[]);React.useEffect(()=>{if(!open)return;clampToViewport();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',clampToViewport);return()=>window.removeEventListener('resize',clampToViewport);}const ro=new ResizeObserver(clampToViewport);ro.observe(document.documentElement);return()=>ro.disconnect();},[open,clampToViewport]);React.useEffect(()=>{const onMsg=e=>{const t=e?.data?.type;if(t==='__activate_edit_mode')setOpen(true);else if(t==='__deactivate_edit_mode')setOpen(false);};window.addEventListener('message',onMsg);window.parent.postMessage({type:'__edit_mode_available'},'*');return()=>window.removeEventListener('message',onMsg);},[]);const dismiss=()=>{setOpen(false);window.parent.postMessage({type:'__edit_mode_dismissed'},'*');};const onDragStart=e=>{const panel=dragRef.current;if(!panel)return;const r=panel.getBoundingClientRect();const sx=e.clientX,sy=e.clientY;const startRight=window.innerWidth-r.right;const startBottom=window.innerHeight-r.bottom;const move=ev=>{offsetRef.current={x:startRight-(ev.clientX-sx),y:startBottom-(ev.clientY-sy)};clampToViewport();};const up=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);};window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);};if(!open)return null;return<>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef}className="twk-panel"data-noncommentable=""style={{right:offsetRef.current.x,bottom:offsetRef.current.y}}>
        <div className="twk-hd"onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x"aria-label="Close tweaks"onMouseDown={e=>e.stopPropagation()}onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
          {hasDeckStage&&railEnabled&&!noDeckControls&&<TweakSection label="Deck">
              <TweakToggle label="Thumbnail rail"value={railVisible}onChange={toggleRail}/>
            </TweakSection>}
        </div>
      </div>
    </>;}
export default TweaksPanel;
export { TweaksPanel };
