// @ts-nocheck
"use client";


const StatusBars=({requests})=>{const buckets=[{key:'in_progress',label:'In Progress',color:'#9ebbc8'},{key:'returned',label:'Returned',color:'#f4a8bf'},{key:'rejected',label:'Rejected',color:'#e89aa8'},{key:'draft',label:'Draft',color:'#a8a8b8'},{key:'cancelled',label:'Cancelled',color:'#888899'}];const max=Math.max(1,...buckets.map(b=>requests.filter(r=>r.status===b.key).length));return<div style={{display:'flex',flexDirection:'column',gap:14}}>
        {buckets.map(b=>{const n=requests.filter(r=>r.status===b.key).length;const pct=n/max*100;return<div key={b.key}style={{display:'grid',gridTemplateColumns:'90px 1fr 28px',gap:14,alignItems:'center'}}>
              <span style={{fontSize:13,color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{b.label}</span>
              <div style={{height:8,background:'#f1f1f5',borderRadius:999,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:b.color,borderRadius:999,transition:'width 0.4s'}}/>
              </div>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text-primary)',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{n}</span>
            </div>;})}
      </div>;};
export default StatusBars;
export { StatusBars };
