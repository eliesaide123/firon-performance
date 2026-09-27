import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import FP_Toast from './FP_Toast';

/** The prototype's `toast()` hides after 1800ms. */
const AUTO_HIDE_MS = 1800;

interface FP_ToastContextValue {
  toast: (message: string) => void;
}

const FP_ToastContext = createContext<FP_ToastContextValue | null>(null);

/**
 * Hosts the floating toast pill. Distinct from FP_Alert: toasts are the prototype's
 * transient confirmations ("Added to favorites"), alerts are failures and confirms.
 */
export const FP_ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState('');
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (next: string) => {
      if (!next) {
        return;
      }
      setMessage(next);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }, AUTO_HIDE_MS);
    },
    [anim],
  );

  const value = useMemo<FP_ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <FP_ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {message ? <FP_Toast message={message} anim={anim} /> : null}
      </View>
    </FP_ToastContext.Provider>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export function useToast(): FP_ToastContextValue {
  const ctx = useContext(FP_ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <FP_ToastProvider>');
  }
  return ctx;
}

export default FP_ToastProvider;
