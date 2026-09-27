import type { ReactNode } from 'react';

export interface FP_ChipScrollProps { children?: ReactNode; className?: string }

/** Horizontal, edge-bleeding chip scroller (the prototype's `.chip-scroll`). */
export default function FP_ChipScroll({ children, className }: FP_ChipScrollProps) {
  return <div className={`chip-scroll ${className || ''}`}>{children}</div>;
}
