import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

export interface FP_ColumnProps {
  children?: ReactNode;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

/** Vertical flex layout primitive. */
export default function FP_Column({ children, gap = 10, className, style }: FP_ColumnProps) {
  return <div className={clsx('col', className)} style={{ gap, ...style }}>{children}</div>;
}
