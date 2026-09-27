import { useId } from 'react';
import type { ReactNode } from 'react';

export interface FP_TimePickerProps {
  label?: ReactNode;
  /** 'HH:mm' */
  value?: string;
  onChange?: (next: string) => void;
  disabled?: boolean;
  error?: string | null;
}

/** `HH:mm` picker (trainer availability windows). */
export default function FP_TimePicker({ label, value, onChange, disabled, error }: FP_TimePickerProps) {
  const id = useId();
  return (
    <div className="field">
      {label ? <label className="field__label" htmlFor={id}>{label}</label> : null}
      <input
        id={id}
        type="time"
        className={`input ${error ? 'input--err' : ''}`}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {error ? <div className="field__err">{error}</div> : null}
    </div>
  );
}
