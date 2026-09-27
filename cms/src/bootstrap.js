/*
 * CMS boot wiring (CONTRACT §11.2).
 *
 * Imported FIRST by main.jsx so `configureSharedService()` has run before any
 * `api.*` call can happen. After this module no file in the CMS touches axios,
 * fetch or XMLHttpRequest — every request goes through the shared clientProxy.
 */
import { configureSharedService } from '@firon/shared';
import tokenStore from './lib/tokenStore.js';
import { installCssVariables } from './lib/cssVariables.js';
import log from './lib/log.js';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

/** Set by AuthContext so a dead session can clear React state, not just storage. */
let unauthenticatedHandler = null;
export function setUnauthenticatedHandler(fn) { unauthenticatedHandler = fn; }

installCssVariables();

configureSharedService({
  baseUrl: API_URL,
  socketUrl: SOCKET_URL,
  platform: 'web',
  getAccessToken: () => tokenStore.accessToken,
  getRefreshToken: () => tokenStore.refreshToken,
  onTokensRefreshed: (tokens) => {
    tokenStore.setTokens(tokens);
    log.info('access token refreshed');
  },
  onUnauthenticated: (error) => {
    log.warn('session unrecoverable:', error?.code, error?.message);
    tokenStore.clear();
    if (unauthenticatedHandler) unauthenticatedHandler(error);
    else if (window.location.pathname !== '/login') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}`);
    }
  },
  defaultHeaders: { 'X-FP-Client': 'cms' },
  onError: (error) => log.warn('api error', error.code, error.status, error.request?.path),
  debug: import.meta.env.DEV,
});

log.info('shared service configured', API_URL);
