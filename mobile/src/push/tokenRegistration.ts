/**
 * FCM token lifecycle (CONTRACT §7).
 *
 * Rules this file enforces:
 *
 *   1. A GUEST NEVER REGISTERS A TOKEN. `api.auth.registerFcmToken` is an authed endpoint, and a
 *      token registered against no user would be meaningless anyway — so registration is driven
 *      from the signed-in transition only (see PushProvider).
 *   2. On `onTokenRefresh` the new token is re-POSTed. FCM rotates tokens on reinstall, restore,
 *      and occasionally on its own; a stale token is a device that silently stops getting pushes.
 *   3. On LOGOUT the token is DELETEd. Without this, the next person to log in on a shared device
 *      keeps receiving the previous user's notifications, because the token is still in their
 *      `fcmTokens` array server-side.
 *
 * The last registered token is mirrored into AsyncStorage: logout may happen in a session that
 * never registered anything (cold start -> restored session -> logout), and we still need to know
 * which token to remove.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@firon/shared';
import type { FPPushPlatform } from '@firon/shared';
import log from '../log';
import { requestPushPermissionAndToken, onTokenRefresh as onFcmTokenRefresh } from './firebase';
import { requestAndroidNotificationPermission } from './permissions';
import { ensureDefaultChannel } from './channels';

/** Same `@firon/` namespace as src/config.ts STORAGE_KEYS. */
const TOKEN_KEY = '@firon/fcmToken';

const platform: FPPushPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

let lastRegistered: string | null = null;

async function remember(token: string | null): Promise<void> {
  lastRegistered = token;
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    log.warn('could not persist fcm token:', err instanceof Error ? err.message : err);
  }
}

async function recall(): Promise<string | null> {
  if (lastRegistered) {
    return lastRegistered;
  }
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** POST the token to the backend. Never throws — a failure just means no push this session. */
async function postToken(token: string): Promise<boolean> {
  try {
    await api.auth.registerFcmToken({ token, platform });
    await remember(token);
    log.info('fcm token registered', `${token.slice(0, 12)}…`);
    return true;
  } catch (err) {
    log.warn('registerFcmToken failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * The whole post-login sequence: channel, permission, token, POST.
 * Returns the token, or null if anything was unavailable or denied. NEVER throws and never
 * blocks the UI — callers fire and forget.
 */
export async function registerPushTokenForSession(): Promise<string | null> {
  // The channel must exist before any notification can be shown (Android 8+).
  await ensureDefaultChannel();

  // Android 13+ tray permission. A denial is final for this session but must not stop us: the
  // token is still worth registering, because the user may enable notifications in Settings later.
  const androidAllowed = await requestAndroidNotificationPermission();

  // iOS permission prompt + APNs registration + getToken, all guarded inside firebase.ts.
  const token = await requestPushPermissionAndToken();
  if (!token) {
    log.info('no fcm token (firebase unconfigured, or permission denied) — push stays off');
    return null;
  }
  if (!androidAllowed) {
    log.info('android notifications denied — token registered anyway, tray stays silent');
  }
  await postToken(token);
  return token;
}

/** Subscribe to FCM rotations and re-POST. Returns an unsubscribe. */
export function watchTokenRefresh(): () => void {
  return onFcmTokenRefresh(token => {
    log.info('fcm token rotated — re-registering');
    void postToken(token);
  });
}

/**
 * DELETE the token server-side. Call on logout, BEFORE the session is cleared, so the request
 * still carries an Authorization header.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = await recall();
  if (!token) {
    return;
  }
  try {
    await api.auth.removeFcmToken({ token });
    log.info('fcm token removed server-side');
  } catch (err) {
    // A 401 here is normal if the session already died; the token will be pruned on first
    // failed delivery anyway (pushService prunes registration-token-not-registered).
    log.warn('removeFcmToken failed:', err instanceof Error ? err.message : err);
  } finally {
    await remember(null);
  }
}

export default registerPushTokenForSession;
