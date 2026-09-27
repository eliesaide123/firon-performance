import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface FP_JsonEditorProps {
  label?: ReactNode;
  /** Raw text or an object; emitted back as raw text so invalid drafts survive. */
  value?: unknown;
  onChange?: (nextText: string, valid: boolean) => void;
  rows?: number;
  compact?: boolean;
}

const toText = (value: unknown) =>
  (typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2));

/** JSON textarea that validates as you type and reports validity upward. */
export default function FP_JsonEditor({
  label, value, onChange, rows = 4, compact,
}: FP_JsonEditorProps) {
  const [text, setText] = useState(() => toText(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setText(toText(value)); }, [value]);

  const handle = (next: string) => {
    setText(next);
    let valid = true;
    try { JSON.parse(next); setError(null); }
    catch (err) { valid = false; setError((err as Error).message); }
    onChange?.(next, valid);
  };

  return (
    <div className="field" style={{ width: '100%' }}>
      {label ? <label className="field__label">{label}</label> : null}
      <textarea
        className={`input input--mono ${error ? 'input--err' : ''}`}
        rows={compact ? 2 : rows}
        style={compact ? { minHeight: 44 } : undefined}
        value={text}
        aria-label="JSON value"
        aria-invalid={error ? 'true' : undefined}
        onChange={(e) => handle(e.target.value)}
      />
      {error ? <div className="field__err">Invalid JSON: {error}</div> : null}
    </div>
  );
}
