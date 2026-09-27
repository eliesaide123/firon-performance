import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { MouseEventHandler } from 'react';

export interface FP_IconButtonProps {
  icon: LucideIcon;
  /** Required — this button has no visible text. */
  label: string;
  onPress?: MouseEventHandler<HTMLButtonElement>;
  active?: boolean;
  small?: boolean;
  size?: number;
  disabled?: boolean;
  className?: string;
}

/** Square icon-only button (the prototype's `.icon-btn`). */
export default function FP_IconButton({
  icon: Icon, label, onPress, active, small, size = 17, disabled, className,
}: FP_IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onPress}
      className={clsx('icon-btn', small && 'icon-btn--sm', active && 'icon-btn--active', className)}
    >
      <Icon size={size} />
    </button>
  );
}
