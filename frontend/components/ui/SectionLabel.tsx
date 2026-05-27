// @ts-nocheck
"use client";

const SectionLabel = ({ children, style, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', ...style }}>
    <span>{children}</span>
    {right}
  </div>
);

export default SectionLabel;
export { SectionLabel };
