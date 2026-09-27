import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { FP_COLORS } from '@firon/shared';

export type FP_StatTone = 'accent' | 'warn' | 'danger' | 'accent2';

export interface FP_StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: FP_StatTone;
}

const TONE: Record<FP_StatTone, string> = {
  accent: FP_COLORS.accent,
  accent2: FP_COLORS.accent2,
  warn: FP_COLORS.warn,
  danger: FP_COLORS.danger,
};

/** Big number + small label. */
export default function FP_StatCard({ label, value, hint, icon: Icon, tone }: FP_StatCardProps) {
  return (
    <div className="stat">
      <div className="stat__top">
        {Icon ? <Icon size={15} className="stat__icon" /> : null}
        <span className="stat__label">{label}</span>
      </div>
      <div className="stat__value" style={tone ? { color: TONE[tone] } : undefined}>
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
      </div>
      {hint ? <div className="stat__hint">{hint}</div> : null}
    </div>
  );
}
