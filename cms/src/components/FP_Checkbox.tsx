import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FP_CheckboxProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: ReactNode;
  /** Strike the label through when checked (the prototype's done state). */
  strikeWhenChecked?: boolean;
  disabled?: boolean;
}

/** 26px lime checkbox. */
export default function FP_Checkbox({
  checked, onChange, label, strikeWhenChecked, disabled,
}: FP_CheckboxProps) {
  return (
    <span className="row" style={{ gap: 10 }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(checked)}
        aria-label={typeof label === 'string' ? label : 'Toggle'}
        disabled={disabled}
        className={clsx('fp-checkbox', checked && 'fp-checkbox--done')}
        onClick={() => onChange?.(!checked)}
      >
        {checked ? <Check size={15} strokeWidth={3} /> : null}
      </button>
      {label ? (
        <span className={clsx('small', checked && strikeWhenChecked && 'done-text')}>{label}</span>
      ) : null}
    </span>
  );
}
