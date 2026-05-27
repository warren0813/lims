// @ts-nocheck
"use client";
import mText2 from '@/components/Manager/mText2';

const FieldLabel=({children,required})=><div style={{fontSize:12,fontWeight:600,color:mText2,marginBottom:6}}>
    {children}{required&&<span style={{color:'#c0394a',marginLeft:4}}>*</span>}
  </div>;
export default FieldLabel;
export { FieldLabel };
