import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import FP_Toast, { type FP_ToastItem, type FP_ToastTone } from './FP_Toast';

export interface FP_ToastOptions {
  tone?: FP_ToastTone;
  sub?: ReactNode;
  /** 0 keeps the toast until dismissed. */
  ttl?: number;
}

export interface FP_ToastApi {
  push: (message: ReactNode, opts?: FP_ToastOptions) => number;
  success: (message: ReactNode, opts?: FP_ToastOptions) => number;
  error: (message: ReactNode, opts?: FP_ToastOptions) => number;
  event: (message: ReactNode, opts?: FP_ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<FP_ToastApi | null>(null);

export interface FP_ToastProviderProps { children?: ReactNode }

/** Hosts the toast stack and exposes `useToast()`. */
export default function FP_ToastProvider({ children }: FP_ToastProviderProps) {
  const [toasts, setToasts] = useState<FP_ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: ReactNode, opts: FP_ToastOptions = {}) => {
    seq.current += 1;
    const id = seq.current;
    const { tone = 'info', sub, ttl = 3800 } = opts;
    setToasts((list) => [...list.slice(-4), { id, message, tone, sub }]);
    if (ttl) setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  const api = useMemo<FP_ToastApi>(() => ({
    push,
    success: (m, o) => push(m, { ...o, tone: 'success' }),
    error: (m, o) => push(m, { ...o, tone: 'error', ttl: o?.ttl ?? 6000 }),
    event: (m, o) => push(m, { ...o, tone: 'event', ttl: o?.ttl ?? 3000 }),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {toasts.map((t) => <FP_Toast key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

export function useToast(): FP_ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <FP_ToastProvider>');
  return ctx;
}
