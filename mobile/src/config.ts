import { Platform } from 'react-native';

/**
 * Single place to point the app at a backend.
 *
 * Defaults follow docs/CONTRACT.md §1:
 *   iOS simulator    -> http://localhost:4000
 *   Android emulator -> http://10.0.2.2:4000
 *
 * Override `HOST_OVERRIDE` (e.g. 'http://192.168.1.20:4000') when running on a
 * physical device on the same LAN.
 */
const HOST_OVERRIDE: string | null = null;

const defaultHost = Platform.select({
  ios: 'http://localhost:4000',
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

export const SERVER_URL = HOST_OVERRIDE ?? defaultHost;
export const API_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

export const LOCALE = 'en';
export const PLATFORM = 'mobile';

export const STORAGE_KEYS = {
  accessToken: '@firon/accessToken',
  refreshToken: '@firon/refreshToken',
  remember: '@firon/remember',
  user: '@firon/user',
  content: '@firon/content',
  identifier: '@firon/lastIdentifier',
} as const;
