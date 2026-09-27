import clsx from 'clsx';
import type { CSSProperties, KeyboardEvent, MouseEventHandler, ReactNode } from 'react';

export interface FP_PressableProps {
  children?: ReactNode;
  onPress?: MouseEventHandler<HTMLElement>;
  /** Required when the content is not self-describing text (icons, thumbnails). */
  label?: string;
  disabled?: boolean;
  /**
   * Use 'div' when the pressable region legitimately contains other interactive elements —
   * nesting a <button> inside a <button> is invalid HTML. Keyboard support is preserved.
   */
  as?: 'button' | 'div';
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Generic pressable surface: for when a whole region (a media tile, a roster row) is clickable
 * and the content is richer than a label or an icon.
 *
 * Exists so pages never reach for a raw <button> (CONTRACT §12): FP_Button is for labelled CTAs
 * and FP_IconButton takes an icon only, so neither can wrap arbitrary children.
 */
export default function FP_Pressable({
  children,
  onPress,
  label,
  disabled,
  as = 'button',
  className,
  style,
  title,
}: FP_PressableProps) {
  const classes = clsx('pressable', disabled && 'pressable--disabled', className);

  if (as === 'div') {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled || undefined}
        title={title}
        className={classes}
        style={style}
        onClick={disabled ? undefined : onPress}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            (event.currentTarget as HTMLElement).click();
          }
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      title={title}
      className={classes}
      style={style}
      onClick={onPress}
    >
      {children}
    </button>
  );
}
