/**
 * One-time wiring of `@firon/shared` (CONTRACT §11.2).
 *
 * Imported at the very top of `index.js`, before `AppRegistry.registerComponent`, so no module
 * can make an API call before the proxy knows its base URL and token accessors.
 */
import { Platform } from 'react-native';
import { configureSharedService } from '@firon/shared';
import tokenStore from './auth/tokenStore';
import { API_URL, SOCKET_URL } from './config';
import log from './log';

let configured = false;

export function bootstrapSharedService(): void {
  if (configured) {
    return;
  }
  configured = true;

  configureSharedService({
    baseUrl: API_URL,
    socketUrl: SOCKET_URL,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    getAccessToken: () => tokenStore.getAccess(),
    getRefreshToken: () => tokenStore.getRefresh(),
    onTokensRefreshed: tokens => tokenStore.set(tokens),
    onUnauthenticated: error => {
      log.warn('session unrecoverable:', error.code, error.message);
      void tokenStore.clear().then(() => tokenStore.emitForcedLogout());
    },
    debug: __DEV__,
  });

  log.info('shared service configured →', API_URL);
}

bootstrapSharedService();
