'use client';
import React, { use, useState } from 'react';
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';
import { makeMgrNavigate, makeLabNavigate } from '@/lib/navigate';
import { ink } from '@/lib/colors';
import MgrDashboard from '@/components/Manager/MgrDashboard';
import MgrAllRequests from '@/components/Manager/MgrAllRequests';
import MgrRequestDetail from '@/components/Manager/MgrRequestDetail';
import MgrRecipes from '@/components/Manager/MgrRecipes';
import MgrReports from '@/components/Manager/MgrReports';
import LabDashboard from '@/components/Lab/LabDashboard';
import LabSamples from '@/components/Lab/LabSamples';
import LabWaferDetail from '@/components/Lab/LabWaferDetail';
import LabWipList from '@/components/Lab/LabWipList';
import LabWipDetail from '@/components/Lab/LabWipDetail';
import LabDispatchList from '@/components/Lab/LabDispatchList';
import LabDispatchDetail from '@/components/Lab/LabDispatchDetail';
import LabEquipment from '@/components/Lab/LabEquipment';

type Navigate = ReturnType<typeof makeMgrNavigate>;
type LabNavigate = ReturnType<typeof makeLabNavigate>;
type ShowToast = (msg: string) => void;

type RouteContext = {
  navigate: Navigate;
  labNavigate: LabNavigate;
  showToast: ShowToast;
  searchParams: ReadonlyURLSearchParams;
};

// /manager/lab/... — lab operations for manager (with canManage=true)
function pickLabPage(
  seg1: string | undefined,
  seg2: string | undefined,
  ctx: RouteContext,
): React.ReactNode {
  const { labNavigate, showToast, searchParams } = ctx;
  switch (seg1) {
    case 'samples':
      return seg2 ? (
        <LabWaferDetail id={Number(seg2)} navigate={labNavigate} showToast={showToast} />
      ) : (
        <LabSamples
          navigate={labNavigate}
          defaultTab={searchParams.get('tab') || 'all'}
          showToast={showToast}
        />
      );
    case 'wips':
      return seg2 ? (
        <LabWipDetail id={Number(seg2)} navigate={labNavigate} showToast={showToast} />
      ) : (
        <LabWipList navigate={labNavigate} showToast={showToast} />
      );
    case 'dispatches':
      return seg2 ? (
        <LabDispatchDetail id={Number(seg2)} navigate={labNavigate} showToast={showToast} />
      ) : (
        <LabDispatchList navigate={labNavigate} defaultTab={searchParams.get('tab') || 'active'} />
      );
    case 'equipment':
      return <LabEquipment navigate={labNavigate} canManage={true} showToast={showToast} />;
    default:
      // undefined, 'dashboard', or any unknown segment → dashboard
      return <LabDashboard navigate={labNavigate} />;
  }
}

function pickManagerPage(
  seg0: string | undefined,
  seg1: string | undefined,
  seg2: string | undefined,
  ctx: RouteContext,
): React.ReactNode {
  const { navigate, showToast } = ctx;
  if (seg0 === 'lab') {
    return pickLabPage(seg1, seg2, ctx);
  }
  switch (seg0) {
    case 'requests':
      return seg1 ? (
        <MgrRequestDetail id={Number(seg1)} navigate={navigate} showToast={showToast} />
      ) : (
        <MgrAllRequests navigate={navigate} />
      );
    case 'recipes':
      return <MgrRecipes showToast={showToast} />;
    case 'reports':
      return <MgrReports />;
    default:
      // undefined, 'dashboard', or any unknown segment → dashboard
      return <MgrDashboard navigate={navigate} />;
  }
}

export default function ManagerPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const navigate = makeMgrNavigate(router.push.bind(router));
  // Lab navigate within manager context uses /manager/lab/* base
  const labNavigate = makeLabNavigate(router.push.bind(router), '/manager/lab');
  const [toast, setToast] = useState(null);

  const showToast = (msg: string) => {
    setToast({ msg, t: Date.now() });
    setTimeout(() => setToast(null), 2200);
  };

  const [seg0, seg1, seg2] = path;

  const page = pickManagerPage(seg0, seg1, seg2, {
    navigate,
    labNavigate,
    showToast,
    searchParams,
  });

  return (
    <>
      {page}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            borderRadius: 10,
            background: ink,
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 12px 36px rgba(20,20,28,0.32)',
            animation: 'slide-in 0.18s ease-out',
            zIndex: 300,
          }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}
