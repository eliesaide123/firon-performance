import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { onAlert, onAlertDismiss, type FPAlertPayload } from '@firon/shared';
import FP_Alert from './FP_Alert';

export interface FP_AlertProviderProps {
  children: React.ReactNode;
}

/**
 * Mounted exactly once at the app root. Subscribes to the shared alert bus and renders
 * `FP_Alert`. Contains no business logic — it is a pure presenter (CONTRACT §11.4).
 *
 * Alerts stack: the newest is shown, the rest wait behind it.
 */
export const FP_AlertProvider: React.FC<FP_AlertProviderProps> = ({ children }) => {
  const [queue, setQueue] = useState<FPAlertPayload[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setQueue(prev => prev.filter(alert => alert.id !== id));
  }, []);

  useEffect(() => {
    const offAlert = onAlert(alert => {
      setQueue(prev => [...prev, alert]);
      // Errors and confirms never auto-dismiss (the bus leaves autoDismissMs unset for them).
      if (alert.autoDismissMs && alert.autoDismissMs > 0) {
        timers.current.set(
          alert.id,
          setTimeout(() => dismiss(alert.id), alert.autoDismissMs),
        );
      }
    });
    const offDismiss = onAlertDismiss(dismiss);
    return () => {
      offAlert();
      offDismiss();
    };
  }, [dismiss]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  const current = queue.length > 0 ? queue[queue.length - 1] : null;

  return (
    <View style={styles.root}>
      {children}
      <FP_Alert alert={current ?? null} onDismiss={dismiss} />
    </View>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export default FP_AlertProvider;
