import type { ReactNode } from 'react';

export interface FP_ListItemProps {
  /** Avatar, thumb or icon slot. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  className?: string;
}

/** leading + title/subtitle + trailing, with a bottom hairline. */
export default function FP_ListItem({
  leading, title, subtitle, trailing, onPress, className,
}: FP_ListItemProps) {
  return (
    <div
      className={`list-item ${className || ''}`}
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress}
      onKeyDown={onPress ? (e) => { if (e.key === 'Enter') onPress(); } : undefined}
      style={onPress ? { cursor: 'pointer' } : undefined}
    >
      {leading}
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="strong truncate">{title}</div>
        {subtitle ? <div className="tiny muted truncate">{subtitle}</div> : null}
      </div>
      {trailing}
    </div>
  );
}
