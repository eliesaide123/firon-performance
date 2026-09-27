import type { ReactNode } from 'react';

export interface FP_TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** Hover/focus tooltip built on a CSS-only bubble (no portal, no library). */
export default function FP_Tooltip({ label, children, className }: FP_TooltipProps) {
  return (
    <span className={`fp-tooltip ${className || ''}`} tabIndex={0}>
      {children}
      <span className="fp-tooltip__bubble" role="tooltip">{label}</span>
    </span>
  );
}
