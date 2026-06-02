'use client';
import URGENCY_LABEL from '@/components/Manager/constants/urgencyLabel';
import Pill from '@/components/Manager/Pill';

type PillStyle = { label: string; bg: string; fg: string };
const URGENCY_MAP: Record<string, PillStyle> = URGENCY_LABEL;
const UrgencyPill = ({ urgency, size = 'sm' }: { urgency: string; size?: string }) => {
  return <Pill kind={urgency} mapping={URGENCY_MAP} size={size} />;
};
export default UrgencyPill;
export { UrgencyPill };
