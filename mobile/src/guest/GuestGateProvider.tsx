/**
 * Guest preview mode (CONTRACT §13).
 *
 * Before anyone signs in the app opens straight into the client experience and looks
 * signed-in. Any tap on anything interactive calls `gate()`, which opens the Login modal.
 *
 * The interception itself lives inside the `FP_*` primitives (§13.2) — they call
 * `useGuestGate()` and bail out of their own `onPress` when `isGuest` is true. That makes the
 * behaviour airtight by construction and, crucially, leaves scrolling alone: there is no
 * full-screen overlay.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { fpAlert } from '@firon/shared';
import { useContent } from '../cms/ContentProvider';
import log from '../log';

export interface GuestGate {
  isGuest: boolean;
  /** Opens the Login modal. Returns true when the tap was intercepted. */
  gate: (reason?: string) => boolean;
  /** Banner dismissal is per-session, not persisted. */
  bannerDismissed: boolean;
  dismissBanner: () => void;
}

const GuestGateContext = createContext<GuestGate>({
  isGuest: false,
  gate: () => false,
  bannerDismissed: false,
  dismissBanner: () => undefined,
});

/** Rapid double taps must not stack two Login modals. */
const GATE_DEBOUNCE_MS = 700;

export const GuestGateProvider: React.FC<{
  isGuest: boolean;
  /** navigates to the Login modal */
  onRequireAuth: () => void;
  children: React.ReactNode;
}> = ({ isGuest, onRequireAuth, children }) => {
  const { t } = useContent();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const lastGateAt = useRef(0);
  /** The explainer pops on the first interception only — after that we navigate silently. */
  const explained = useRef(false);

  const gate = useCallback(
    (reason?: string): boolean => {
      if (!isGuest) {
        return false;
      }
      const now = Date.now();
      if (now - lastGateAt.current < GATE_DEBOUNCE_MS) {
        return true;
      }
      lastGateAt.current = now;

      if (reason) {
        log.info('guest gate:', reason);
      }
      if (!explained.current) {
        explained.current = true;
        fpAlert.info(t('guest.gate_title'), t('guest.gate_body'));
      }
      onRequireAuth();
      return true;
    },
    [isGuest, onRequireAuth, t],
  );

  const dismissBanner = useCallback(() => setBannerDismissed(true), []);

  const value = useMemo<GuestGate>(
    () => ({ isGuest, gate, bannerDismissed, dismissBanner }),
    [isGuest, gate, bannerDismissed, dismissBanner],
  );

  return <GuestGateContext.Provider value={value}>{children}</GuestGateContext.Provider>;
};

export function useGuestGate(): GuestGate {
  return useContext(GuestGateContext);
}

/**
 * Helper for the FP primitives: returns a press handler that gates when appropriate.
 * `guestAllowed` opts a control out (auth screens, the banner CTA, alert/toast dismissals).
 */
export function useGatedPress<A extends unknown[]>(
  onPress: ((...args: A) => void) | undefined,
  guestAllowed?: boolean,
): ((...args: A) => void) | undefined {
  const { isGuest, gate } = useGuestGate();
  return useCallback(
    (...args: A) => {
      if (isGuest && !guestAllowed) {
        gate();
        return;
      }
      onPress?.(...args);
    },
    [isGuest, guestAllowed, gate, onPress],
  );
}

export default GuestGateProvider;
