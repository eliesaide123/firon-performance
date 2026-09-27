import { useId } from 'react';
import type { ReactNode } from 'react';
import { FP_COLORS } from '@firon/shared';

export interface FP_ColorPickerProps {
  label?: ReactNode;
  value?: string;
  onChange?: (next: string) => void;
  error?: string | null;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Swatch + hex field, used by `color`-typed content keys. */
export default function FP_ColorPicker({ label, value, onChange, error }: FP_ColorPickerProps) {
  const id = useId();
  const swatch = HEX.test(String(value)) ? String(value) : FP_COLORS.accent;
  return (
    <div className="field">
      {label ? <label className="field__label" htmlFor={id}>{label}</label> : null}
      <div className="input-color">
        <input
          type="color"
          aria-label="Pick a colour"
          value={swatch}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <input
          id={id}
          className={`input ${error ? 'input--err' : ''}`}
          value={value ?? ''}
          placeholder={FP_COLORS.accent}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
      {error ? <div className="field__err">{error}</div> : null}
    </div>
  );
}
