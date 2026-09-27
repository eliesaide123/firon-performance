import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';
import { useState } from 'react';
import type { FPAlertPayload, FPAlertVariant } from '@firon/shared';
import FP_Button from './FP_Button';
import FP_IconButton from './FP_IconButton';

export interface FP_AlertProps {
  alert: FPAlertPayload;
  onDismiss: (id: string) => void;
}

const ICONS = {
  error: AlertTriangle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  confirm: HelpCircle,
} as const;

const FALLBACK_TITLE: Record<FPAlertVariant, string> = {
  error: 'Something went wrong',
  success: 'Done',
  warning: 'Heads up',
  info: 'Note',
  confirm: 'Please confirm',
};

/**
 * Pure presenter for one alert from the shared alert bus. No business logic —
 * it renders the payload `clientProxy` (or `fpAlert.*`) published.
 */
export default function FP_Alert({ alert, onDismiss }: FP_AlertProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const Icon = ICONS[alert.variant] ?? Info;

  const runAction = async (index: number) => {
    const action = alert.actions?.[index];
    if (!action) return;
    setBusy(action.label);
    try {
      await action.onPress?.();
    } finally {
      setBusy(null);
      if (action.dismiss !== false) onDismiss(alert.id);
    }
  };

  return (
    <div className={clsx('fp-alert', `fp-alert--${alert.variant}`)}>
      <div className="fp-alert__head">
        <span className="fp-alert__icon"><Icon size={18} /></span>
        <div className="grow">
          <div className="fp-alert__title">{alert.title || FALLBACK_TITLE[alert.variant]}</div>
          {alert.message ? <div className="fp-alert__message">{alert.message}</div> : null}
        </div>
        {alert.variant !== 'confirm' ? (
          <FP_IconButton icon={X} label="Dismiss" small onPress={() => onDismiss(alert.id)} />
        ) : null}
      </div>

      {alert.technical ? <div className="fp-alert__technical">{alert.technical}</div> : null}

      <div className="fp-alert__actions">
        {alert.actions?.length ? alert.actions.map((action, i) => (
          <FP_Button
            key={`${action.label}-${i}`}
            variant={action.kind === 'danger' ? 'danger' : action.kind === 'ghost' ? 'secondary' : 'primary'}
            loading={busy === action.label}
            onPress={() => runAction(i)}
          >
            {action.label}
          </FP_Button>
        )) : (
          <FP_Button variant="secondary" onPress={() => onDismiss(alert.id)}>Close</FP_Button>
        )}
      </div>
    </div>
  );
}
