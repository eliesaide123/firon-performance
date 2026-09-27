import clsx from 'clsx';
import { AlertTriangle, Check, Radio, X } from 'lucide-react';
import type { ReactNode } from 'react';

export type FP_ToastTone = 'info' | 'success' | 'error' | 'event';

export interface FP_ToastItem {
  id: number;
  message: ReactNode;
  sub?: ReactNode;
  tone: FP_ToastTone;
}

export interface FP_ToastProps {
  toast: FP_ToastItem;
  onDismiss: (id: number) => void;
}

const ICONS = { success: Check, error: AlertTriangle, event: Radio, info: Radio } as const;

/**
 * Floating pill — the prototype's `toast()`. Distinct from FP_Alert: a toast is
 * a passing confirmation, an alert is a failure the user must acknowledge.
 */
export default function FP_Toast({ toast, onDismiss }: FP_ToastProps) {
  const Icon = ICONS[toast.tone] ?? Radio;
  return (
    <div className={clsx('toast', `toast--${toast.tone}`)} role="status">
      <Icon size={15} className="toast__icon" />
      <div className="toast__body">
        <div className="toast__msg">{toast.message}</div>
        {toast.sub ? <div className="toast__sub">{toast.sub}</div> : null}
      </div>
      <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
        <X size={13} />
      </button>
    </div>
  );
}
