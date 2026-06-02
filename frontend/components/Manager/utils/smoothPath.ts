'use client';

type SmoothPathOptions = {
  yMin?: number;
  yMax?: number;
};

const smoothPath = (pts: [number, number][], options: SmoothPathOptions = {}) => {
  if (pts.length === 0) return '';
  const clampY = (y: number) => {
    const lower = options.yMin ?? Number.NEGATIVE_INFINITY;
    const upper = options.yMax ?? Number.POSITIVE_INFINITY;
    return Math.min(upper, Math.max(lower, y));
  };
  if (pts.length === 1) return `M ${pts[0][0]},${clampY(pts[0][1])}`;
  let d = `M ${pts[0][0]},${clampY(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const p0y = clampY(p0[1]);
    const p1y = clampY(p1[1]);
    const p2y = clampY(p2[1]);
    const p3y = clampY(p3[1]);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1y + (p2y - p0y) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2y - (p3y - p1y) / 6);
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2y}`;
  }
  return d;
};
export default smoothPath;
export { smoothPath };
