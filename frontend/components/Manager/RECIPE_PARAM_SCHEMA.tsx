// @ts-nocheck
"use client";


const RECIPE_PARAM_SCHEMA={tct:[{key:'cycles',label:'Cycles',placeholder:'500'},{key:'t_min',label:'T Min',placeholder:'-55 \u00b0C'},{key:'t_max',label:'T Max',placeholder:'125 \u00b0C'},{key:'dwell',label:'Dwell',placeholder:'15 min'},{key:'ramp',label:'Ramp',placeholder:'15 \u00b0C/min'}],hast:[{key:'temperature',label:'Temperature',placeholder:'85 \u00b0C'},{key:'humidity',label:'Humidity',placeholder:'85% RH'},{key:'duration',label:'Duration',placeholder:'168 h'},{key:'bias',label:'Bias',placeholder:'5 V'}],btc:[{key:'cycles',label:'Cycles',placeholder:'300'},{key:'bias',label:'Bias',placeholder:'3.3 V'},{key:'temp',label:'Temp',placeholder:'125 \u00b0C'}],cp:[{key:'sites',label:'Sites',placeholder:'1024'},{key:'touchdowns',label:'Touchdowns',placeholder:'24'},{key:'vdd',label:'VDD',placeholder:'1.0 V'},{key:'clock',label:'Clock',placeholder:'100 MHz'}],ft:[{key:'tests',label:'Tests',placeholder:'240'},{key:'voltage',label:'Voltage',placeholder:'1.2 V'},{key:'temp',label:'Temp',placeholder:'25 \u00b0C'}]};
export default RECIPE_PARAM_SCHEMA;
export { RECIPE_PARAM_SCHEMA };
