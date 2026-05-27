// @ts-nocheck
"use client";
import React from 'react';
import useMgrTrend from '@/components/Manager/useMgrTrend';
import Card from '@/components/Manager/Card';
import mMuted from '@/components/Manager/mMuted';
import smoothPath from '@/components/Manager/smoothPath';
import mLineSft from '@/components/Manager/mLineSft';
import mInk from '@/components/Manager/mInk';
import mBgSoft from '@/components/Manager/mBgSoft';
import mText2 from '@/components/Manager/mText2';

const TrendChart=()=>{const{data:trend,loading,error}=useMgrTrend('requests_per_day',30);const days=React.useMemo(()=>{const points=trend?.points||[];const arr=points.map(p=>({date:p.date,dispatches:p.count}));for(let i=0;i<arr.length;i++){const prev=i>0?arr[i-1].dispatches:0;arr[i].utilization=Math.min(100,(arr[i].dispatches*0.6+prev*0.4)*24);}return arr;},[trend]);if(loading&&!trend){return<Card padding={22}style={{marginTop:18,textAlign:'center',color:mMuted,fontSize:13}}>
        Loading trend…
      </Card>;}if(error){return<Card padding={22}style={{marginTop:18}}>
        <div style={{padding:'12px 16px',borderRadius:10,background:'#fde4e4',color:'#c0394a',fontSize:13.5,fontWeight:500,border:'1px solid #f6c4c4'}}>Couldn't load trend: {error}</div>
      </Card>;}if(days.length===0){return<Card padding={22}style={{marginTop:18,textAlign:'center',color:mMuted,fontSize:13}}>
        No trend data yet.
      </Card>;}const maxDispatches=Math.max(1,...days.map(d=>d.dispatches));const W=880,H=220,PL=36,PR=56,PT=24,PB=36;const chartW=W-PL-PR;const chartH=H-PT-PB;const x=i=>PL+(days.length===1?chartW/2:i/(days.length-1)*chartW);const yDispatch=v=>PT+chartH-v/maxDispatches*chartH;const yUtil=v=>PT+chartH-v/100*chartH;const dispatchPts=days.map((d,i)=>[x(i),yDispatch(d.dispatches)]);const utilPts=days.map((d,i)=>[x(i),yUtil(d.utilization)]);const dispatchPath=smoothPath(dispatchPts);const utilPath=smoothPath(utilPts);const baselineY=PT+chartH;const areaPath=pts=>pts.length?smoothPath(pts)+` L ${pts[pts.length-1][0]},${baselineY} L ${pts[0][0]},${baselineY} Z`:'';const tickStep=days.length>14?Math.ceil(days.length/8):2;const ticks=days.map((d,i)=>({i,label:d.date.slice(5).replace('-','/'),show:i===0||i===days.length-1||i%tickStep===0}));return<Card padding={0}style={{marginTop:18}}>
      <div style={{padding:'18px 22px',borderBottom:`1px solid ${mLineSft}`,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <span style={{width:10,height:10,borderRadius:999,background:'#6c67b8',boxShadow:'0 0 10px rgba(108,103,184,0.45)'}}/>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:mInk,letterSpacing:'-0.01em'}}>資源利用 / 產能趨勢</div>
          <div style={{fontSize:12,color:mMuted,marginTop:2}}>設備稼動率與每日派工量</div>
        </div>
        <div style={{marginLeft:'auto',fontSize:12,color:mMuted,fontWeight:600,padding:'6px 12px',borderRadius:999,background:mBgSoft,border:`1px solid ${mLineSft}`}}>Last {trend?.days??30} days</div>
      </div>

      <div style={{padding:'14px 22px 20px'}}>
        {}
        <div style={{display:'flex',justifyContent:'flex-end',gap:18,marginBottom:4,fontSize:12,color:mText2}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
            <span style={{width:10,height:10,borderRadius:999,border:'2px solid #2563eb',background:'#fff'}}/>
            每日派工量
          </span>
          <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
            <span style={{width:10,height:10,borderRadius:999,border:'2px solid #6c67b8',background:'#fff'}}/>
            設備稼動率 (%)
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`}style={{width:'100%',height:'auto',display:'block'}}>
          <defs>
            <linearGradient id="dispFill"x1="0"y1="0"x2="0"y2="1">
              <stop offset="0%"stopColor="#2563eb"stopOpacity="0.18"/>
              <stop offset="100%"stopColor="#2563eb"stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="utilFill"x1="0"y1="0"x2="0"y2="1">
              <stop offset="0%"stopColor="#6c67b8"stopOpacity="0.16"/>
              <stop offset="100%"stopColor="#6c67b8"stopOpacity="0"/>
            </linearGradient>
          </defs>

          {}
          {[0,20,40,60,80,100].map(p=>{const yy=yUtil(p);return<g key={p}>
                <line x1={PL}y1={yy}x2={W-PR}y2={yy}stroke="#eef0f4"strokeWidth="1"/>
                <text x={W-PR+6}y={yy+4}fontSize="10.5"fill="#8e8ea0"fontFamily="var(--font-mono)">{p}%</text>
              </g>;})}
          {}
          {[0,maxDispatches].map((v,i)=><text key={i}x={PL-8}y={yDispatch(v)+4}fontSize="10.5"fill="#8e8ea0"textAnchor="end"fontFamily="var(--font-mono)">{v}</text>)}

          {}
          <path d={areaPath(dispatchPts)}fill="url(#dispFill)"/>
          <path d={areaPath(utilPts)}fill="url(#utilFill)"/>
          {}
          <path d={dispatchPath}fill="none"stroke="#2563eb"strokeWidth="2"strokeLinejoin="round"strokeLinecap="round"/>
          <path d={utilPath}fill="none"stroke="#6c67b8"strokeWidth="2"strokeLinejoin="round"strokeLinecap="round"/>

          {}
          {ticks.map(t=>t.show&&<text key={t.i}x={x(t.i)}y={H-PB+18}fontSize="10.5"fill="#8e8ea0"textAnchor="middle"fontFamily="var(--font-mono)">{t.label}</text>)}
        </svg>
      </div>
    </Card>;};
export default TrendChart;
export { TrendChart };
