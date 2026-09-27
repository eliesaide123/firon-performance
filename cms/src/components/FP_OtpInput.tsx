import { useRef } from 'react';

export interface FP_OtpInputProps {
  /** Exactly `length` characters, '' for an empty box. */
  value: string[];
  onChange: (next: string[]) => void;
  length?: number;
  autoFocus?: boolean;
}

/** The 4-box OTP row: auto-advance, backspace-to-previous, paste support. */
export default function FP_OtpInput({ value, onChange, length = 4, autoFocus }: FP_OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setAt = (i: number, digit: string) => {
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className="otp-inputs">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={value[i] ?? ''}
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => setAt(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (!text) return;
            e.preventDefault();
            const next = Array.from({ length }, (_, j) => text[j] ?? '');
            onChange(next);
            refs.current[Math.min(text.length, length - 1)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
