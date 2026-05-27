// @ts-nocheck
"use client";

const Card = ({ children, style, padding = 0, ...rest }) => (
  <div {...rest} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding, ...style }}>{children}</div>
);

export default Card;
export { Card };
