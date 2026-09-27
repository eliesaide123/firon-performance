/**
 * Firebase Cloud Messaging, defensively wrapped.
 *
 * `GoogleService-Info.plist` / `google-services.json` are gitignored, so on a fresh clone the
 * native Firebase app does not exist. Every entry point here is guarded: we log one warning and
 * become a no-op, and the rest of the app keeps working (CONTRACT §7).
 *
 * @react-native-firebase/messaging v26 dropped the namespaced default export — there is no
 * `messaging()` and no `FirebaseMessagingTypes` any more. The module is now purely modular:
 * `getMessaging(app?)` returns a `Messaging` instance and every operation is a standalone
 * function taking that instance as its first argument. This module is the single place that
 * knows that, so callers keep the same small surface they always had.
 */
import { Platform } from 'react-native';
import log from '../log';
import { DEFAULT_CHANNEL_ID, ensureDefaultChannel } from './channels';

type MessagingModule = typeof import('@react-native-firebase/messaging');
type Messaging = import('@react-native-firebase/messaging').Messaging;
type RemoteMessage = import('@react-native-firebase/messaging').RemoteMessage;

let warned = false;
let cachedModule: MessagingModule | null = null;
let cached: Messaging | null = null;

function warnOnce(err: unknown): void {
  if (!warned) {
    warned = true;
    log.warn(
      'Firebase messaging unavailable — push notifications are disabled. ' +
        'Add ios/GoogleService-Info.plist and android/app/google-services.json to enable them.',
      err instanceof Error ? err.message : err,
    );
  }
}

/** The messaging module + instance, or null when Firebase is not configured on this build. */
function resolveMessaging(): { mod: MessagingModule; messaging: Messaging } | null {
  if (cachedModule && cached) {
    return { mod: cachedModule, messaging: cached };
  }
  try {
    // Required lazily so a missing native Firebase app cannot break module evaluation.
    const mod = require('@react-native-firebase/messaging') as MessagingModule;
    const app = require('@react-native-firebase/app').default as {
      apps: unknown[];
    };
    if (!app.apps || app.apps.length === 0) {
      warnOnce(new Error('no Firebase app is initialised'));
      return null;
    }
    cachedModule = mod;
    cached = mod.getMessaging();
    return { mod, messaging: cached };
  } catch (err) {
    warnOnce(err);
    return null;
  }
}

/** The messaging instance, or null when Firebase is not configured on this build. */
export function getMessaging(): Messaging | null {
  return resolveMessaging()?.messaging ?? null;
}

export function isPushAvailable(): boolean {
  return getMessaging() !== null;
}

/** Ask for permission, then return the FCM token (null when unavailable or denied). */
export async function requestPushPermissionAndToken(): Promise<string | null> {
  const fb = resolveMessaging();
  if (!fb) {
    return null;
  }
  try {
    const status = await fb.mod.requestPermission(fb.messaging);
    // 1 = AUTHORIZED, 2 = PROVISIONAL
    if (status !== 1 && status !== 2) {
      log.info('push permission not granted:', status);
      return null;
    }
    if (Platform.OS === 'ios') {
      await fb.mod.registerDeviceForRemoteMessages(fb.messaging);
    }
    const token = await fb.mod.getToken(fb.messaging);
    return token || null;
  } catch (err) {
    warnOnce(err);
    return null;
  }
}

export function onTokenRefresh(handler: (token: string) => void): () => void {
  const fb = resolveMessaging();
  if (!fb) {
    return () => undefined;
  }
  try {
    return fb.mod.onTokenRefresh(fb.messaging, handler);
  } catch (err) {
    warnOnce(err);
    return () => undefined;
  }
}

export function onForegroundMessage(handler: (message: RemoteMessage) => void): () => void {
  const fb = resolveMessaging();
  if (!fb) {
    return () => undefined;
  }
  try {
    return fb.mod.onMessage(fb.messaging, async message => handler(message));
  } catch (err) {
    warnOnce(err);
    return () => undefined;
  }
}

/** Fires when a notification tap brought the app from background to foreground. */
export function onNotificationOpened(handler: (message: RemoteMessage) => void): () => void {
  const fb = resolveMessaging();
  if (!fb) {
    return () => undefined;
  }
  try {
    return fb.mod.onNotificationOpenedApp(fb.messaging, message => {
      if (message) {
        handler(message);
      }
    });
  } catch (err) {
    warnOnce(err);
    return () => undefined;
  }
}

/** The notification that cold-started the app, if any. */
export async function getInitialNotification(): Promise<RemoteMessage | null> {
  const fb = resolveMessaging();
  if (!fb) {
    return null;
  }
  try {
    return (await fb.mod.getInitialNotification(fb.messaging)) ?? null;
  } catch (err) {
    warnOnce(err);
    return null;
  }
}

/**
 * Display a heads-up notification while the app is foregrounded, via notifee.
 *
 * Needed because neither platform draws a notification for a message that arrives while the app
 * is in the foreground — iOS suppresses it and Android hands it straight to `onMessage`. The
 * channel is created by channels.ts (Android 8+ drops notifications with an unknown channel).
 *
 * `data` is carried through unchanged so a tap can be routed by deepLinks.ts.
 */
export async function displayForegroundNotification(message: RemoteMessage): Promise<void> {
  try {
    const notifee = require('@notifee/react-native').default as typeof import('@notifee/react-native').default;

    await ensureDefaultChannel();

    await notifee.displayNotification({
      title: message.notification?.title ?? 'Firon Performance',
      body: message.notification?.body ?? '',
      data: message.data,
      android: {
        channelId: DEFAULT_CHANNEL_ID,
        // Flat white silhouette; a launcher icon renders as a grey blob in the status bar.
        smallIcon: 'ic_notification',
        color: '#c7ff3f',
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
  } catch (err) {
    warnOnce(err);
  }
}

export type { RemoteMessage, Messaging };
