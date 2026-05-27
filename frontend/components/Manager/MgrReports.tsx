// @ts-nocheck
"use client";
import api from '@/lib/api';
import * as I from '@/components/ui/I';
import Page from '@/components/Manager/Page';
import ReportCard from '@/components/Manager/ReportCard';
const MI=I;
const MgrReports=()=>{const equipmentReport=async({start,end})=>{const out=await api.reports.equipmentUtilization({period:'custom',start_date:start,end_date:end});const totalWips=(out.data||[]).reduce((s,e)=>s+(e.wip_count||0),0);const totalSamples=(out.data||[]).reduce((s,e)=>s+(e.sample_count||0),0);return[{label:'Units covered',value:(out.data||[]).length},{label:'Total WIPs',value:totalWips},{label:'Sample runs',value:totalSamples}];};const requestReport=async({start,end})=>{const out=await api.reports.requestStatistics({start_date:start,end_date:end});const dist=out.status_distribution||{};const approvedLike=(dist.approved||0)+(dist.sample_shipped||0)+(dist.in_progress||0)+(dist.completed||0)+(dist.closed||0);return[{label:'Total',value:out.total_requests??0},{label:'Approved',value:approvedLike},{label:'Rejected',value:dist.rejected||0}];};return<Page title="Reports"subtitle="報表 — generate equipment utilization and request statistics">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <ReportCard title="Equipment Utilization"subtitle="Per-equipment WIP + sample counts across the window."accent="#2563eb"accentBg="#dbeafe"icon={<MI.TrendUp size={14}/>}onGenerate={equipmentReport}/>
        <ReportCard title="Request Statistics"subtitle="Total / approved / rejected requests in the window."accent="#157a4a"accentBg="#c8eedd"icon={<MI.ClipboardList size={14}/>}onGenerate={requestReport}/>
      </div>
    </Page>;};
export default MgrReports;
export { MgrReports };
