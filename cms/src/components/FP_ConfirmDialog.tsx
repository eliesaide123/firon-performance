import { useEffect } from 'react';
import { fpAlert } from '@firon/shared';

export interface FP_ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Plain text — the alert bus carries strings, not nodes. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Thin declarative wrapper over `fpAlert.confirm` — it renders nothing itself,
 * so there is exactly one confirm surface in the app (FP_Alert).
 */
export default function FP_ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel, danger = true, onConfirm, onClose,
}: FP_ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    fpAlert
      .confirm(title, message, { confirmLabel, cancelLabel, danger })
      .then((ok) => {
        if (cancelled) return;
        if (ok) onConfirm();
        else onClose();
      });
    return () => { cancelled = true; };
    // Re-asking on every prop tick would spawn duplicate dialogs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return null;
}

/** Imperative form for one-off confirmations inside an event handler. */
export function fpConfirm(
  title: string,
  message: string,
  opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean },
): Promise<boolean> {
  return fpAlert.confirm(title, message, opts);
}
