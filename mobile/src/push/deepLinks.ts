/**
 * Notification tap -> navigation (CONTRACT §7).
 *
 * Every push carries `{ type, deepLink, notificationId }` in its DATA payload, so a tap knows
 * where to go. There are three distinct tap paths and all three are wired here:
 *
 *   A. app was KILLED      -> `getInitialNotification()` at startup. The navigator almost never
 *                             exists yet, so we park the link with `setPendingDeepLink()`;
 *                             NavigationContainer's onReady calls `flushPendingDeepLink()`.
 *   B. app was BACKGROUNDED -> `onNotificationOpenedApp()`. The navigator is already mounted, so
 *                             `navigateDeepLink()` runs immediately.
 *   C. app was FOREGROUNDED and we drew the notification ourselves with notifee -> that tap never
 *                             reaches firebase-messaging, only notifee's foreground event stream.
 *
 * The `firon://<target>[/<id>]` grammar and the screen mapping live in
 * src/navigation/navigationRef.ts — this file only extracts links and hands them over.
 */
import { flushPendingDeepLink, setPendingDeepLink } from '../navigation/navigationRef';
import log from '../log';
import { getInitialNotification, onNotificationOpened, type RemoteMessage } from './firebase';

type DataPayload = Record<string, unknown> | undefined;

/** Pull the deepLink out of a data payload (FCM data values are always strings). */
export function deepLinkOf(data: DataPayload): string | null {
  const value = data && data.deepLink;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Navigate now if the navigator is up, otherwise park it for onReady. Safe to call at any time. */
export function routeDeepLink(deepLink: string | null | undefined, reason: string): void {
  if (!deepLink) {
    return;
  }
  log.info('notification tap ->', deepLink, `(${reason})`);
  // Park first, then flush: navigateDeepLink() itself re-parks when the navigator is not ready,
  // so this ordering is correct whether or not NavigationContainer has mounted.
  setPendingDeepLink(deepLink);
  flushPendingDeepLink();
}

/** Path A — the notification that cold-started the app. Runs once, at startup. */
export async function handleColdStartNotification(): Promise<void> {
  const message = await getInitialNotification();
  if (!message) {
    return;
  }
  routeDeepLink(deepLinkOf(message.data), 'cold start');
}

/** Path B — background -> foreground. Returns an unsubscribe. */
export function watchNotificationOpens(): () => void {
  return onNotificationOpened((message: RemoteMessage) => {
    routeDeepLink(deepLinkOf(message.data), 'background open');
  });
}

/**
 * Path C — a tap on a notification WE displayed with notifee while foregrounded.
 * firebase-messaging never sees these, so without this the tap only dismisses the banner.
 * Returns an unsubscribe; a no-op if notifee is unavailable.
 */
export function watchNotifeePresses(): () => void {
  try {
    const notifee = require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
    const { EventType } = require('@notifee/react-native') as typeof import('@notifee/react-native');
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        routeDeepLink(deepLinkOf(detail.notification?.data), 'notifee press');
      }
    });
  } catch (err) {
    log.warn('notifee foreground events unavailable:', err instanceof Error ? err.message : err);
    return () => undefined;
  }
}

export default routeDeepLink;
