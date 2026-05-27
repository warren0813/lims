// @ts-nocheck
"use client";


const HistoryDot=({action})=>{const c={APPROVE:{dot:'#157a4a',bg:'#c8eedd',fg:'#157a4a'},REJECT:{dot:'#c0394a',bg:'#fde4e4',fg:'#c0394a'},RETURN:{dot:'#a73d56',bg:'#f9d7e0',fg:'#a73d56'},CANCEL:{dot:'#777788',bg:'#ebebf0',fg:'#5a5a6e'}}[action]||{dot:'#a8a8b8',bg:'#f1f1f5',fg:'#5a5a6e'};return c;};
export default HistoryDot;
export { HistoryDot };
