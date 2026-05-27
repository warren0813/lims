// @ts-nocheck
"use client";
import inputStyle from '@/components/Manager/inputStyle';

const SelectInput=({value,onChange,children,style})=><select value={value}onChange={onChange}style={{...inputStyle,cursor:'pointer',...style}}>{children}</select>;
export default SelectInput;
export { SelectInput };
