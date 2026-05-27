// @ts-nocheck
"use client";


const RECIPES=[{id:'tct_std',expId:'tct',name:'TCT_Standard_Reflow_Simulation_v1',params:{cycles:500,t_min:'-55°C',t_max:'125°C',dwell:'15 min',ramp:'15°C/min'}},{id:'tct_long',expId:'tct',name:'TCT_Extended_1000_Cycle_v2',params:{cycles:1000,t_min:'-65°C',t_max:'150°C',dwell:'10 min',ramp:'20°C/min'}},{id:'hast_std',expId:'hast',name:'HAST_85C_85RH_v1',params:{temperature:'85°C',humidity:'85% RH',duration:'168 h',bias:'5V'}},{id:'cp_full',expId:'cp',name:'CP_Full_Param_Sweep_v3',params:{sites:1024,touchdowns:24,vdd:'1.0 V',clock:'100 MHz'}},{id:'ft_basic',expId:'ft',name:'FT_Basic_Functional_v1',params:{tests:240,voltage:'1.2 V',temp:'25°C'}}];
export default RECIPES;
export { RECIPES };
