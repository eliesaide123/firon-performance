/**
 * The one place that drives the push lifecycle. Renders nothing.
 *
 * Mount it INSIDE AuthProvider and pass `enabled={signedIn}` — the same idiom
 * NotificationsProvider uses. Taking `enabled` as a prop rather than calling useAuth() keeps
 * src/push free of any dependency on the session implementation.
 *
 *   <PushProvider enabled={signedIn} />
 *
 * What happens when:
 *
 *   mount (guest or not)  channel created, tap handlers attached, cold-start notification routed.
 *                         NOTHING is registered with the backend and NO permission prompt fires —
 *                         a guest must never register a token (CONTRACT §7).
 *   enabled false -> true after login: permission prompt, FCM token, POST /auth/fcm-token, plus a
 *                         subscription that re-POSTs on rotation.
 *   enabled true -> false on logout: best-effort DELETE /auth/fcm-token so the next person on a
 *                         shared device does not inherit the pushes. See the note on
 *                         `unregisterPushToken` below for why this is best-effort here.
 *
 * Every step is guarded: with no GoogleService-Info.plist / google-services.json this component
 * mounts, logs one warning from src/push/firebase.ts, and does nothing else.
 */
import React, { useEffect, useRef } from 'react';
import log from '../log';
import tokenStore from '../auth/tokenStore';
import { ensureDefaultChannel } from './channels';
import {
  handleColdStartNotification,
  watchNotificationOpens,
  watchNotifeePresses,
} from './deepLinks';
import { displayForegroundNotification, onForegroundMessage } from './firebase';
import { registerPushTokenForSession, unregisterPushToken, watchTokenRefresh } from './tokenRegistration';

export interface PushProviderProps {
  /** `signedIn` from useAuth(). Registration is gated on this. */
  enabled: boolean;
  /**
   * Draw a notifee heads-up banner for pushes that arrive while the app is FOREGROUNDED.
   *
   * Default false on purpose: while foregrounded the socket has already delivered
   * `notification:new` and the in-app FP_NotificationBanner is showing it, so a second OS-level
   * heads-up would double-notify. Turn this on if you ever want the OS banner instead of (or as a
   * fallback to) the in-app one — the underlying FCM listener is attached either way.
   */
  showForegroundHeadsUp?: boolean;
}

export const PushProvider: React.FC<PushProviderProps> = ({ enabled, showForegroundHeadsUp = false }) => {
  const wasEnabled = useRef(false);

  /* ---- session-independent: channel + the three tap paths + the foreground listener ---- */
  useEffect(() => {
    void ensureDefaultChannel();
    void handleColdStartNotification();

    const unsubscribeOpens = watchNotificationOpens();
    const unsubscribePresses = watchNotifeePresses();
    const unsubscribeForeground = onForegroundMessage(message => {
      log.info('foreground push:', message.notification?.title ?? '(data-only)');
      if (showForegroundHeadsUp) {
        void displayForegroundNotification(message);
      }
    });

    return () => {
      unsubscribeOpens();
      unsubscribePresses();
      unsubscribeForeground();
    };
  }, [showForegroundHeadsUp]);

  /* ---- session-dependent: register after login, remove on logout ---- */
  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      wasEnabled.current = true;
      // Fire and forget — the permission prompt must never block the first screen.
      void registerPushTokenForSession();
      const unsubscribe = watchTokenRefresh();
      return unsubscribe;
    }

    if (!enabled && wasEnabled.current) {
      wasEnabled.current = false;
      // AuthProvider.logout() clears the tokens BEFORE `signedIn` flips, so by the time we get
      // here the request would usually go out unauthenticated and 401. Only try when a token
      // survives (forced logout, or a caller that removed first). The definitive fix is for
      // logout() to await unregisterPushToken() before clearSession() — see docs/FIREBASE.md.
      if (tokenStore.peekAccess()) {
        void unregisterPushToken();
      } else {
        log.info('logout already cleared the session — fcm token will be pruned on first failed send');
      }
    }
    return undefined;
  }, [enabled]);

  return null;
};

export default PushProvider;
