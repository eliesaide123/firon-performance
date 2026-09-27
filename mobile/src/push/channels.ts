/**
 * Android notification channels (CONTRACT §7).
 *
 * Why this file exists at all: from Android 8 a notification with no matching channel is dropped
 * SILENTLY — no error, no tray entry. The channel therefore has to exist before the first push
 * lands, which means creating it at startup rather than lazily on first display.
 *
 * `DEFAULT_CHANNEL_ID` is a three-way contract and all three MUST agree:
 *   1. here (created via notifee, used when JS displays the notification itself)
 *   2. android/app/src/main/res/values/strings.xml -> default_notification_channel_id
 *      (used by firebase-messaging natively when the app is KILLED and no JS runs)
 *   3. backend/src/services/pushService.js -> DEFAULT_CHANNEL_ID (sent as android.notification.channelId)
 */
import { Platform } from 'react-native';
import log from '../log';

export const DEFAULT_CHANNEL_ID = 'firon-default';
export const DEFAULT_CHANNEL_NAME = 'Firon Performance';

let created: Promise<void> | null = null;

/**
 * Idempotent: notifee's createChannel updates in place if the id already exists, and we memoise
 * so repeated calls (startup, then every foreground display) cost nothing.
 * A no-op on iOS, which has no channels. Never throws.
 */
export function ensureDefaultChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  if (!created) {
    created = (async () => {
      try {
        const notifee = require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
        const { AndroidImportance } = require('@notifee/react-native') as typeof import('@notifee/react-native');
        await notifee.createChannel({
          id: DEFAULT_CHANNEL_ID,
          name: DEFAULT_CHANNEL_NAME,
          // HIGH is what makes it a heads-up (banner) notification rather than a silent tray row.
          importance: AndroidImportance.HIGH,
          vibration: true,
        });
        log.info('notification channel ready:', DEFAULT_CHANNEL_ID);
      } catch (err) {
        // A missing native module must not take the app down — push simply stays off.
        created = null;
        log.warn('could not create notification channel:', err instanceof Error ? err.message : err);
      }
    })();
  }
  return created;
}

export default ensureDefaultChannel;
