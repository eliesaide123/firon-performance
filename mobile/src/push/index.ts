/**
 * Push notifications (CONTRACT §7). Setup walkthrough: docs/FIREBASE.md.
 *
 * Mount `<PushProvider enabled={signedIn} />` inside AuthProvider — that is the whole public
 * surface an app screen needs. Everything else here is for the odd caller that wants a piece of
 * it directly (e.g. a "enable notifications" button in settings).
 */
export { PushProvider, default } from './PushProvider';
export type { PushProviderProps } from './PushProvider';

export { registerBackgroundMessageHandler } from './backgroundHandler';
export { DEFAULT_CHANNEL_ID, DEFAULT_CHANNEL_NAME, ensureDefaultChannel } from './channels';
export { requestAndroidNotificationPermission } from './permissions';
export {
  registerPushTokenForSession,
  unregisterPushToken,
  watchTokenRefresh,
} from './tokenRegistration';
export {
  deepLinkOf,
  handleColdStartNotification,
  routeDeepLink,
  watchNotificationOpens,
  watchNotifeePresses,
} from './deepLinks';
export {
  displayForegroundNotification,
  getInitialNotification,
  getMessaging,
  isPushAvailable,
  onForegroundMessage,
  onNotificationOpened,
  onTokenRefresh,
  requestPushPermissionAndToken,
} from './firebase';
export type { Messaging, RemoteMessage } from './firebase';
