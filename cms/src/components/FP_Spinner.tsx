import clsx from 'clsx';

export interface FP_SpinnerProps { large?: boolean; className?: string; label?: string }

/** Activity indicator. */
export default function FP_Spinner({ large, className, label = 'Loading' }: FP_SpinnerProps) {
  return <span className={clsx('spinner', large && 'spinner--lg', className)} role="status" aria-label={label} />;
}
