import clsx from 'clsx';
import type { ReactNode } from 'react';

export type FP_TabItem = string | { value: string; label: ReactNode };

export interface FP_TabsProps {
  value?: string;
  onChange?: (next: string) => void;
  tabs?: FP_TabItem[];
  className?: string;
}

/** In-page tabs with an underlined active state. */
export default function FP_Tabs({ value, onChange, tabs = [], className }: FP_TabsProps) {
  return (
    <div className={clsx('tabs', className)} role="tablist">
      {tabs.map((t) => {
        const v = typeof t === 'object' ? t.value : t;
        const label = typeof t === 'object' ? t.label : t;
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
