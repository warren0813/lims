'use client';
import STATUS_LABEL from '@/components/Manager/constants/statusLabel';
import Pill from '@/components/Manager/Pill';

type PillStyle = { label: string; bg: string; fg: string };
const STATUS_MAP: Record<string, PillStyle> = STATUS_LABEL;
const StatusPill = ({ status, size = 'md' }: { status: string; size?: string }) => {
  return <Pill kind={status} mapping={STATUS_MAP} size={size} />;
};
export default StatusPill;
export { StatusPill };
