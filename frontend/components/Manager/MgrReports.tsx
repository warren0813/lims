'use client';
import DispatchResultsReport from '@/components/Manager/DispatchResultsReport';
import Page from '@/components/Manager/Page';
import RequestStatisticsReport from '@/components/Manager/RequestStatisticsReport';

const MgrReports = () => (
  <Page title="Reports" subtitle="Generate dispatch results and request statistics">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <DispatchResultsReport />
      <RequestStatisticsReport />
    </div>
  </Page>
);

export default MgrReports;
export { MgrReports };
