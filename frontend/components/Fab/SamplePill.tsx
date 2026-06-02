'use client';
import SAMPLE_STATUS_LABEL from '@/components/Fab/constants/sampleStatusLabel';
import Pill from '@/components/Manager/Pill';

type PillStyle = { label: string; bg: string; fg: string };
const SAMPLE_STATUS_MAP: Record<string, PillStyle> = SAMPLE_STATUS_LABEL;
const SamplePill = ({ status, size = 'sm' }: { status: string; size?: string }) => {
  return <Pill kind={status} mapping={SAMPLE_STATUS_MAP} size={size} />;
};
export default SamplePill;
export { SamplePill };
