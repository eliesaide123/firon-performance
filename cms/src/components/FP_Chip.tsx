import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FP_ChipProps {
  children?: ReactNode;
  active?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  /** Small trailing count, e.g. the content group tree. */
  count?: number | string | null;
  className?: string;
  title?: string;
}

/** Pill. Interactive when `onPress` is given, otherwise a static tag. */
export default function FP_Chip({
  children, active, onPress, icon: Icon, count, className, title,
}: FP_ChipProps) {
  const Tag = onPress ? 'button' : 'span';
  return (
    <Tag
      type={onPress ? 'button' : undefined}
      title={title}
      className={clsx('chip', active && 'chip--active', !onPress && 'chip--static', className)}
      onClick={onPress}
      aria-pressed={onPress ? Boolean(active) : undefined}
    >
      {Icon ? <Icon size={13} /> : null}
      {children}
      {count != null && count !== '' ? <span className="chip__count">{count}</span> : null}
    </Tag>
  );
}
