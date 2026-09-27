/**
 * Notification permission, per platform (CONTRACT §7).
 *
 * iOS  — `messaging.requestPermission()` triggers the UNUserNotificationCenter prompt and returns
 *        an AuthorizationStatus. Handled inside firebase.ts because it needs the messaging
 *        instance.
 * Android 13+ (API 33) — the tray itself is gated behind the POST_NOTIFICATIONS runtime
 *        permission. `messaging.requestPermission()` does NOT ask for it, so without the call
 *        below an Android 13 device gets an FCM token, receives pushes, and shows nothing.
 *        On API 32 and below the permission is granted at install time.
 *
 * Nothing here ever throws or blocks: a denial just means push stays off.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import log from '../log';

/** True when notifications may be posted (or when the question does not apply). */
export async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  // Platform.Version is a number on Android.
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (!Number.isFinite(api) || api < 33) {
    return true;
  }
  try {
    const permission = 'android.permission.POST_NOTIFICATIONS' as Parameters<
      typeof PermissionsAndroid.request
    >[0];
    const already = await PermissionsAndroid.check(permission);
    if (already) {
      return true;
    }
    const result = await PermissionsAndroid.request(permission);
    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    if (!granted) {
      log.info('POST_NOTIFICATIONS not granted:', result);
    }
    return granted;
  } catch (err) {
    log.warn('POST_NOTIFICATIONS request failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

export default requestAndroidNotificationPermission;
