import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface FP_LabelProps {
  children?: ReactNode;
  htmlFor?: string;
  section?: boolean;
  className?: string;
}

/** Field label, or a small section heading when `section` is set. */
export default function FP_Label({ children, htmlFor, section, className }: FP_LabelProps) {
  if (section) return <div className={clsx('card__title', className)}>{children}</div>;
  return <label className={clsx('field__label', className)} htmlFor={htmlFor}>{children}</label>;
}
