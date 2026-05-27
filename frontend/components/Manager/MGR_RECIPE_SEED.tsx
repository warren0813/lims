// @ts-nocheck
"use client";


const MGR_RECIPE_SEED=[{id:'tct_std',name:'TCT_Standard_Reflow_Simulation_v1',expId:'tct',description:'Industry-standard JESD22 condition G profile.',params:{cycles:500,t_min:'-55 \u00b0C',t_max:'125 \u00b0C',dwell:'15 min',ramp:'15 \u00b0C/min'}},{id:'tct_long',name:'TCT_Extended_1000_Cycle_v2',expId:'tct',description:'Extended profile used for HBM reliability sweeps.',params:{cycles:1000,t_min:'-65 \u00b0C',t_max:'150 \u00b0C',dwell:'10 min',ramp:'20 \u00b0C/min'}},{id:'hast_std',name:'HAST_85C_85RH_v1',expId:'hast',description:'Steady-state HAST with bias for packaged-part qualifications.',params:{temperature:'85 \u00b0C',humidity:'85% RH',duration:'168 h',bias:'5 V'}},{id:'cp_full',name:'CP_Full_Param_Sweep_v3',expId:'cp',description:'Full parametric sweep across the die map.',params:{sites:1024,touchdowns:24,vdd:'1.0 V',clock:'100 MHz'}},{id:'ft_basic',name:'FT_Basic_Functional_v1',expId:'ft',description:'Basic packaged-part functional bin sort.',params:{tests:240,voltage:'1.2 V',temp:'25 \u00b0C'}}];
export default MGR_RECIPE_SEED;
export { MGR_RECIPE_SEED };
