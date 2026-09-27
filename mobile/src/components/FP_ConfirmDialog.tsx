import { fpAlert } from '@firon/shared';

export interface FP_ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Thin wrapper over `fpAlert.confirm` so screens never import the bus directly:
 *
 *     if (await fpConfirm({ title: 'Log out?', message: '…' })) { … }
 *
 * Renders through the single `FP_AlertProvider` / `FP_Alert` pair.
 */
export function fpConfirm(options: FP_ConfirmDialogOptions): Promise<boolean> {
  const { title, message, confirmLabel, cancelLabel, danger } = options;
  return fpAlert.confirm(title, message, { confirmLabel, cancelLabel, danger });
}

export default fpConfirm;
