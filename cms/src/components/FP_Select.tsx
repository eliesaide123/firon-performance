import clsx from 'clsx';
import { useId, type ChangeEventHandler, type ReactNode } from 'react';

export type FP_SelectOption = string | { value: string | number; label: ReactNode };

export interface FP_SelectProps {
  label?: ReactNode;
  value?: string | number;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  options?: FP_SelectOption[];
  /** Shown as the empty first option (e.g. "All types"). */
  placeholder?: string;
  error?: string | null;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Dropdown. */
export default function FP_Select({
  label, error, hint, options = [], placeholder, className, ...rest
}: FP_SelectProps) {
  const id = useId();
  return (
    <div className="field">
      {label ? <label className="field__label" htmlFor={id}>{label}</label> : null}
      <select id={id} className={clsx('input', error && 'input--err', className)} {...rest}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => {
          const value = typeof o === 'object' ? o.value : o;
          const text = typeof o === 'object' ? o.label : o;
          return <option key={String(value)} value={value}>{text as string}</option>;
        })}
      </select>
      {error ? <div className="field__err">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}
