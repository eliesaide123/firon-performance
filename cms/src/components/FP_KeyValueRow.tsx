import type { ReactNode } from 'react';

export interface FP_KeyValueRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

/** The prototype's `.kv` row: muted key left, value right, hairline below. */
export default function FP_KeyValueRow({ label, value, className }: FP_KeyValueRowProps) {
  return (
    <div className={`kv ${className || ''}`}>
      <span className="kv__k">{label}</span>
      <span>{value ?? '—'}</span>
    </div>
  );
}
