import clsx from 'clsx';
import type { ReactNode } from 'react';

export type FP_SegmentedOption = string | { value: string; label: ReactNode };

export interface FP_SegmentedProps {
  value?: string;
  onChange?: (next: string) => void;
  options?: FP_SegmentedOption[];
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Segmented control with the lime active pill. */
export default function FP_Segmented({
  value, onChange, options = [], fullWidth, className, ...rest
}: FP_SegmentedProps) {
  return (
    <div className={clsx('seg', fullWidth && 'seg--block', className)} role="tablist" {...rest}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const label = typeof o === 'object' ? o.label : o;
        return (
          <button
            key={String(v)}
            type="button"
            role="tab"
            aria-selected={v === value}
            className={clsx(v === value && 'is-active')}
            onClick={() => onChange?.(v)}
          >
            {label as ReactNode}
          </button>
        );
      })}
    </div>
  );
}
