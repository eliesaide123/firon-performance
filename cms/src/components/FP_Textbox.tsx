import clsx from 'clsx';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { useId, useState, type ChangeEventHandler, type KeyboardEventHandler, type ReactNode } from 'react';

export interface FP_TextboxProps {
  label?: ReactNode;
  value?: string | number;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'password' | 'number' | 'search' | 'color';
  /** Renders the show/hide eye toggle for passwords. */
  secure?: boolean;
  error?: string | null;
  hint?: ReactNode;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  large?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel';
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  'aria-label'?: string;
}

/** Single-line input: the CMS never uses a raw <input>. */
export default function FP_Textbox({
  label, error, hint, leftIcon: Left, rightIcon: Right, secure, type = 'text',
  large, className, ...rest
}: FP_TextboxProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const effectiveType = secure ? (reveal ? 'text' : 'password') : type;
  const hasAffix = Boolean(Left || Right || secure);

  const input = (
    <input
      id={id}
      type={effectiveType}
      className={clsx(!hasAffix && 'input', large && 'input--lg', error && 'input--err', className)}
      aria-invalid={error ? 'true' : undefined}
      {...rest}
    />
  );

  return (
    <div className="field">
      {label ? <label className="field__label" htmlFor={id}>{label}</label> : null}
      {hasAffix ? (
        <div className={clsx('search-in', error && 'input--err')}>
          {Left ? <Left size={15} /> : null}
          {input}
          {secure ? (
            <button type="button" className="toast__close" aria-label={reveal ? 'Hide password' : 'Show password'} onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          ) : null}
          {Right ? <Right size={15} /> : null}
        </div>
      ) : input}
      {error ? <div className="field__err">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}
