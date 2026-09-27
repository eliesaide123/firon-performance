/**
 * Unread badge + the in-app heads-up banner for `notification:new` (CONTRACT §6/§7).
 *
 * Public shape is fixed — `SocketProvider` and several screens depend on it:
 *   { unread, setUnread, refreshUnread, showBanner }
 * exported under both `useNotifications` and `useNotificationsBadge`.
 *
 * Layering note: the banner is an absolutely-positioned view inside the app root, NOT a native
 * `Modal`. `FP_Alert` and `FP_BottomSheet` are RN `Modal`s, and a `Modal` always paints above the
 * view hierarchy — so this guarantees the banner can never cover the alert popup (a hard
 * requirement of §11.4). The cost is that a banner arriving while a bottom sheet is open stays
 * behind that sheet; the badge and the inbox still record it, and it is re-presented as soon as
 * nothing is over it... which needs `FP_AlertProvider` to publish "is an alert visible" before we
 * could safely promote the banner into its own Modal.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@firon/shared';
import type { AppNotification } from '@firon/shared';
import log from '../log';
import { navigateDeepLink } from '../navigation/navigationRef';
import FP_NotificationBanner from '../components/FP_NotificationBanner';

/** Visible time per banner, and the beat between two queued ones. */
const BANNER_MS = 4000;
const GAP_MS = 180;
/** A burst (e.g. a coach assigning training + diet + a message) shows the first few, no more. */
const MAX_QUEUE = 3;
/** Window in which the same notification id is treated as already shown. */
const DEDUPE_MS = 15000;

interface NotificationsContextValue {
  unread: number;
  setUnread: (n: number) => void;
  refreshUnread: () => Promise<void>;
  showBanner: (notification: AppNotification) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const NotificationsProvider: React.FC<{
  children: React.ReactNode;
  enabled: boolean;
}> = ({ children, enabled }) => {
  const [unread, setUnreadState] = useState(0);
  const [banner, setBanner] = useState<AppNotification | null>(null);
  const [queued, setQueued] = useState(0);

  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<AppNotification[]>([]);
  /** Mirrors `banner` so `showBanner` can decide present-vs-queue without a stale closure. */
  const shown = useRef<AppNotification | null>(null);
  const seen = useRef(new Map<string, number>());
  const insets = useSafeAreaInsets();

  /* ---------------------------------------------------------------- badge */

  /**
   * `GET /auth/me` already returns `unreadNotifications`, but the mobile AuthProvider drops it,
   * so the badge is seeded with this one small authed call. It is never made for a guest.
   */
  const refreshUnread = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const { unread: count } = await api.notifications.unreadCount();
      setUnreadState(count);
    } catch (err) {
      log.warn('unread count failed', err);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      void refreshUnread();
    } else {
      setUnreadState(0);
    }
  }, [enabled, refreshUnread]);

  /* Signing out must not leave a stranger's notification on screen. */
  useEffect(() => {
    if (!enabled) {
      queue.current = [];
      seen.current.clear();
      shown.current = null;
      setQueued(0);
      setBanner(null);
      anim.setValue(0);
    }
  }, [enabled, anim]);

  /* --------------------------------------------------------------- banner */

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /** Slides the current banner out and presents whatever is queued behind it. */
  const hide = useCallback(() => {
    clearTimer();
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      shown.current = null;
      setBanner(null);
      const next = queue.current.shift();
      setQueued(queue.current.length);
      if (next) {
        timer.current = setTimeout(() => {
          shown.current = next;
          setBanner(next);
        }, GAP_MS);
      }
    });
  }, [anim, clearTimer]);

  /* One place that animates in + arms the auto-hide, for both the first and the queued ones. */
  useEffect(() => {
    if (!banner) {
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    clearTimer();
    timer.current = setTimeout(hide, BANNER_MS);
  }, [banner, anim, hide, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const showBanner = useCallback(
    (notification: AppNotification) => {
      if (!enabled || !notification) {
        return;
      }

      /* Background arrivals belong to the FCM/notifee path — a banner then would only show
       * up late, on resume, for something the user has already been told about. */
      if (AppState.currentState !== 'active') {
        return;
      }

      /* The same notification can reach us twice (socket + a foreground FCM message). */
      const id = String(notification.id ?? '');
      const now = Date.now();
      if (id) {
        seen.current.forEach((at, key) => {
          if (now - at > DEDUPE_MS) {
            seen.current.delete(key);
          }
        });
        if (seen.current.has(id)) {
          return;
        }
        seen.current.set(id, now);
      }

      /* Optimistic badge bump so the bell reacts on the same frame as the banner;
       * `notification:count` arrives a moment later and is authoritative. */
      if (!notification.read) {
        setUnreadState(n => n + 1);
      }

      if (shown.current) {
        if (queue.current.length < MAX_QUEUE) {
          queue.current.push(notification);
          setQueued(queue.current.length);
        }
        return;
      }
      shown.current = notification;
      setBanner(notification);
    },
    [enabled],
  );

  const onPressBanner = useCallback(() => {
    const target = banner?.deepLink ?? 'firon://notifications';
    hide();
    navigateDeepLink(target);
  }, [banner, hide]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ unread, setUnread: setUnreadState, refreshUnread, showBanner }),
    [unread, refreshUnread, showBanner],
  );

  return (
    <NotificationsContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {banner ? (
          <FP_NotificationBanner
            title={banner.title}
            body={banner.body}
            type={banner.type}
            glyph={banner.icon}
            queued={queued}
            anim={anim}
            top={insets.top + 6}
            onPress={onPressBanner}
            onDismiss={hide}
          />
        ) : null}
      </View>
    </NotificationsContext.Provider>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export function useNotificationsBadge(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotificationsBadge must be used inside <NotificationsProvider>');
  }
  return ctx;
}

/** The contract's name for the same hook — screens import this one. */
export const useNotifications = useNotificationsBadge;

export default NotificationsProvider;
