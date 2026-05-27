// @ts-nocheck
"use client";
import mLineSft from '@/components/Manager/mLineSft';
import mText2 from '@/components/Manager/mText2';

const CardHeader=({children,style})=><div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 20px',borderBottom:`1px solid ${mLineSft}`,fontSize:11,fontWeight:700,color:mText2,textTransform:'uppercase',letterSpacing:'0.08em',...style}}>{children}</div>;
export default CardHeader;
export { CardHeader };
