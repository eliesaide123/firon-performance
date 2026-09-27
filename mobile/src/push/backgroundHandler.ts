/**
 * Background / killed-app push handling (CONTRACT §7).
 *
 * Registered from `index.js` BEFORE `AppRegistry.registerComponent`. That ordering is not a style
 * choice: when a push wakes a KILLED app, React Native spins up a headless JS context and expects
 * the handler to already be registered by the time the module graph finishes evaluating. Register
 * it from a component and the first background push of each cold start is lost.
 *
 * Must stay free of React imports for the same reason — there is no renderer in that context.
 *
 * What actually draws the tray entry:
 *   * a push with a `notification` block  -> the OS draws it natively, before JS is even asked.
 *     The handler below then runs for bookkeeping only.
 *   * a data-only push                    -> nothing is drawn; the handler is the only chance to
 *     display something, which is why the notifee channel is ensured here too.
 *
 * messaging v26 is modular-only: `setBackgroundMessageHandler(getMessaging(), handler)`.
 */
import log from '../log';
import { ensureDefaultChannel } from './channels';

type MessagingModule = typeof import('@react-native-firebase/messaging');
type RemoteMessage = import('@react-native-firebase/messaging').RemoteMessage;

/**
 * notifee insists on a background event handler being registered at the top level; without it it
 * logs "no background event handler has been set" and background presses of notifee-displayed
 * notifications are dropped. Registered unconditionally — it does not need Firebase.
 */
function registerNotifeeBackgroundHandler(): void {
  try {
    const notifee = require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      // The tap itself is routed by src/push/deepLinks.ts once the app is in the foreground
      // (firebase-messaging's getInitialNotification / onNotificationOpenedApp), so there is
      // nothing to navigate to from here — this only keeps notifee happy and traceable.
      log.info('notifee background event', type, detail.notification?.id ?? '');
    });
  } catch (err) {
    log.warn('notifee background events unavailable:', err instanceof Error ? err.message : err);
  }
}

export function registerBackgroundMessageHandler(): void {
  registerNotifeeBackgroundHandler();

  try {
    const messaging = require('@react-native-firebase/messaging') as MessagingModule;
    const app = require('@react-native-firebase/app').default as { apps: unknown[] };

    if (!app.apps || app.apps.length === 0) {
      log.warn(
        'Firebase not configured — skipping setBackgroundMessageHandler. ' +
          'Add ios/GoogleService-Info.plist and android/app/google-services.json to enable push.',
      );
      return;
    }

    messaging.setBackgroundMessageHandler(
      messaging.getMessaging(),
      async (remoteMessage: RemoteMessage) => {
        // Cheap and idempotent; guarantees the channel exists even if this headless context is
        // the first JS to ever run on this install.
        await ensureDefaultChannel();
        const deepLink = remoteMessage.data && remoteMessage.data.deepLink;
        log.info(
          'background push:',
          remoteMessage.notification?.title ?? '(data-only)',
          typeof deepLink === 'string' ? `-> ${deepLink}` : '',
        );
      },
    );
  } catch (err) {
    log.warn('setBackgroundMessageHandler unavailable:', err instanceof Error ? err.message : err);
  }
}

export default registerBackgroundMessageHandler;
