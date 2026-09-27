import clsx from 'clsx';

export interface FP_ProgressBarProps {
  /** 0..100 */
  value?: number;
  tone?: 'warn' | 'bad';
  className?: string;
}

/** Linear progress. */
export default function FP_ProgressBar({ value = 0, tone, className }: FP_ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={clsx('progress', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={clsx('progress__bar', tone && `bar__fill--${tone}`)} style={{ width: `${pct}%` }} />
    </div>
  );
}
