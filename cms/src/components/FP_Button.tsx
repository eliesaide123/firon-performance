import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { MouseEventHandler, ReactNode } from 'react';
import FP_Spinner from './FP_Spinner';

export type FP_ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface FP_ButtonProps {
  children?: ReactNode;
  variant?: FP_ButtonVariant;
  size?: 'sm' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  onPress?: MouseEventHandler<HTMLButtonElement>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
  'aria-label'?: string;
}

/** The only button in the CMS. 0.98 press scale comes from the stylesheet. */
export default function FP_Button({
  children, variant = 'primary', size, fullWidth, loading, disabled,
  icon: Icon, onPress, onClick, type = 'button', className, title, ...rest
}: FP_ButtonProps) {
  return (
    <button
      type={type}
      title={title}
      className={clsx('btn', variant !== 'primary' && `btn--${variant}`,
        size && `btn--${size}`, fullWidth && 'btn--block', !children && 'btn--icon', className)}
      disabled={disabled || loading}
      onClick={onPress ?? onClick}
      {...rest}
    >
      {loading ? <FP_Spinner /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}
