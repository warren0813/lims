// @ts-nocheck
"use client";


const Icon=({children,size=16,color='currentColor',strokeWidth=2,style,...rest})=><svg width={size}height={size}viewBox="0 0 24 24"fill="none"stroke={color}strokeWidth={strokeWidth}strokeLinecap="round"strokeLinejoin="round"style={{flexShrink:0,...style}}{...rest}>
    {children}
  </svg>;
export default Icon;
export { Icon };
