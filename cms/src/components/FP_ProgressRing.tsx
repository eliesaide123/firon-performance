import type { ReactNode } from 'react';

export interface FP_ProgressRingProps {
  /** 0..100 */
  value?: number;
  size?: number;
  thickness?: number;
  children?: ReactNode;
  label?: ReactNode;
}

/** Conic ring with an inner label (the prototype's nutrition ring). */
export default function FP_ProgressRing({
  value = 0, size = 92, thickness = 10, children, label,
}: FP_ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className="ring"
      style={{ width: size, height: size, ['--p' as string]: `${pct}%` }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="ring__inner" style={{ width: size - thickness * 2, height: size - thickness * 2 }}>
        {children ?? (
          <>
            <span className="strong">{Math.round(pct)}%</span>
            {label ? <span className="tiny muted">{label}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
