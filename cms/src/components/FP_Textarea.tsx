import clsx from 'clsx';
import { useId, type ChangeEventHandler, type ReactNode } from 'react';

export interface FP_TextareaProps {
  label?: ReactNode;
  value?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
  error?: string | null;
  hint?: ReactNode;
  /** Show a "used / max" counter under the field. */
  maxLength?: number;
  mono?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Multi-line input with an optional character counter. */
export default function FP_Textarea({
  label, error, hint, mono, rows = 4, maxLength, value, className, ...rest
}: FP_TextareaProps) {
  const id = useId();
  const used = String(value ?? '').length;
  return (
    <div className="field">
      {label ? <label className="field__label" htmlFor={id}>{label}</label> : null}
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        className={clsx('input', mono && 'input--mono', error && 'input--err', className)}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
      {error ? <div className="field__err">{error}</div> : (
        <div className="row between">
          {hint ? <div className="field__hint">{hint}</div> : <span />}
          {maxLength ? <div className="field__hint">{used}/{maxLength}</div> : null}
        </div>
      )}
    </div>
  );
}
