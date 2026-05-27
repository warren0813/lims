// @ts-nocheck
"use client";


const EquipmentDots=({used,capacity})=>{const cells=Array.from({length:capacity});return<div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>
      {cells.map((_,i)=><span key={i}style={{width:9,height:9,borderRadius:999,background:i<used?'#6c67b8':'#ececf2',boxShadow:i<used?'0 0 6px rgba(108,103,184,0.45)':'none'}}/>)}
    </div>;};
export default EquipmentDots;
export { EquipmentDots };
