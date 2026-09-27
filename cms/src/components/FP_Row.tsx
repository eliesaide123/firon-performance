import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

export interface FP_RowProps {
  children?: ReactNode;
  gap?: number;
  between?: boolean;
  wrap?: boolean;
  top?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'header' | 'footer' | 'section';
}

/** Horizontal flex layout primitive. */
export default function FP_Row({
  children, gap = 10, between, wrap, top, className, style, as: Tag = 'div',
}: FP_RowProps) {
  return (
    <Tag
      className={clsx('row', between && 'between', wrap && 'row--wrap', top && 'row--top', className)}
      style={{ gap, ...style }}
    >
      {children}
    </Tag>
  );
}
