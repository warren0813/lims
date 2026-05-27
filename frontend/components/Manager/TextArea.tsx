// @ts-nocheck
"use client";
import inputStyle from '@/components/Manager/inputStyle';

const TextArea=p=><textarea{...p}style={{...inputStyle,minHeight:70,resize:'vertical',fontFamily:'inherit',...p.style}}/>;
export default TextArea;
export { TextArea };
