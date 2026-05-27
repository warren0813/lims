// @ts-nocheck
"use client";
import mLine from '@/components/Manager/mLine';

const Card=({children,padding=22,style})=><div style={{background:'#fff',borderRadius:12,border:`1px solid ${mLine}`,padding,...style}}>{children}</div>;
export default Card;
export { Card };
