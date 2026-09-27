import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface FP_SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

/** On/off toggle. */
export default function FP_Switch({ checked, onChange, label, disabled }: FP_SwitchProps) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={typeof label === 'string' ? label : 'Toggle'}
      disabled={disabled}
      className={clsx('switch', checked && 'switch--on')}
      onClick={() => onChange?.(!checked)}
    />
  );
  if (!label) return toggle;
  return <span className="row" style={{ gap: 9 }}>{toggle}<span className="small muted">{label}</span></span>;
}
