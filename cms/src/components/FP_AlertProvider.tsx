import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { onAlert, onAlertDismiss, type FPAlertPayload } from '@firon/shared';
import type { ReactNode } from 'react';
import FP_Alert from './FP_Alert';
import useFpFocusTrap from './useFpFocusTrap';

export interface FP_AlertProviderProps { children?: ReactNode }

/**
 * Mounted exactly once at the CMS root. Subscribes to the shared alert bus and
 * renders `FP_Alert` for each published alert — every `clientProxy` failure and
 * every direct `fpAlert.*` call ends up here. Contains no business logic.
 */
export default function FP_AlertProvider({ children }: FP_AlertProviderProps) {
  const [alerts, setAlerts] = useState<FPAlertPayload[]>([]);

  const dismiss = useCallback((id: string) => {
    setAlerts((list) => list.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const offAlert = onAlert((alert) => {
      setAlerts((list) => [...list, alert]);
      // Errors and confirms stay until the user acts; the rest self-dismiss.
      if (alert.autoDismissMs && alert.variant !== 'error' && alert.variant !== 'confirm') {
        setTimeout(() => dismiss(alert.id), alert.autoDismissMs);
      }
    });
    const offDismiss = onAlertDismiss(dismiss);
    return () => { offAlert(); offDismiss(); };
  }, [dismiss]);

  const top = alerts[alerts.length - 1];
  const trapRef = useFpFocusTrap(Boolean(top), top ? () => dismiss(top.id) : undefined);

  return (
    <>
      {children}
      {top ? createPortal(
        <div className="overlay" onMouseDown={(e) => {
          // A confirm must be answered, not dismissed by a stray backdrop click.
          if (e.target === e.currentTarget && top.variant !== 'confirm') dismiss(top.id);
        }}>
          <div
            ref={trapRef}
            role="alertdialog"
            aria-modal="true"
            aria-label={top.title}
            aria-describedby={`fp-alert-msg-${top.id}`}
            tabIndex={-1}
            className="fp-alert-stack"
          >
            {alerts.map((alert) => (
              <div key={alert.id} id={`fp-alert-msg-${alert.id}`}>
                <FP_Alert alert={alert} onDismiss={dismiss} />
              </div>
            ))}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
