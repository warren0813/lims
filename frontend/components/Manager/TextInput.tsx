// @ts-nocheck
"use client";
import inputStyle from '@/components/Manager/inputStyle';

const TextInput=p=><input{...p}style={{...inputStyle,...p.style}}/>;
export default TextInput;
export { TextInput };
