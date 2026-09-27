/**
 * Firon Performance — shared service configuration.
 *
 * `sharedService.ts` is platform-agnostic: it knows nothing about AsyncStorage, localStorage,
 * React Native or the DOM. Each app calls `configureSharedService()` once at boot and injects
 * the handful of things that genuinely differ.
 */

import type { FPError } from './errors';

export type FPPlatform = 'web' | 'ios' | 'android';

export interface FPAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SharedServiceConfig {
  /** Absolute API root, including the `/api` prefix. e.g. `http://localhost:4000/api` */
  baseUrl: string;
  /** Absolute Socket.IO origin (no `/api`). e.g. `http://localhost:4000` */
  socketUrl: string;
  platform: FPPlatform;

  /** Token accessors — sync or async (AsyncStorage on mobile, localStorage on web). */
  getAccessToken: () => string | null | Promise<string | null>;
  getRefreshToken: () => string | null | Promise<string | null>;
  /** Persist the rotated pair after a successful refresh. */
  onTokensRefreshed: (tokens: FPAuthTokens) => void | Promise<void>;
  /** Called when the session is unrecoverable: clear tokens and route to login. */
  onUnauthenticated: (error: FPError) => void | Promise<void>;

  /** Per-code copy overrides, merged over DEFAULT_ERROR_MESSAGES. */
  errorMessages?: Record<string, string>;
  /** Default request timeout. */
  timeoutMs?: number;
  /** Extra headers on every request (e.g. `X-App-Version`, `Accept-Language`). */
  defaultHeaders?: Record<string, string>;
  /** Hook for logging/telemetry. Runs for every request outcome. */
  onRequest?: (info: { method: string; path: string; status: number; ms: number; ok: boolean }) => void;
  /** Hook that sees every normalised error, even silent ones. Use for crash reporting. */
  onError?: (error: FPError) => void;
  /** Turns on verbose request logging. */
  debug?: boolean;
}

type InternalConfig = SharedServiceConfig & { timeoutMs: number };

let config: InternalConfig | null = null;

export function configureSharedService(next: SharedServiceConfig): void {
  config = {
    timeoutMs: 20000,
    ...next,
    baseUrl: next.baseUrl.replace(/\/+$/, ''),
    socketUrl: next.socketUrl.replace(/\/+$/, ''),
  };
}

/** Patch a subset of the config after boot (e.g. switching the API host in a dev menu). */
export function updateSharedServiceConfig(patch: Partial<SharedServiceConfig>): void {
  if (!config) throw new Error('[sharedService] configureSharedService() has not been called yet');
  config = {
    ...config,
    ...patch,
    ...(patch.baseUrl ? { baseUrl: patch.baseUrl.replace(/\/+$/, '') } : {}),
    ...(patch.socketUrl ? { socketUrl: patch.socketUrl.replace(/\/+$/, '') } : {}),
  };
}

export function getSharedServiceConfig(): InternalConfig {
  if (!config) {
    throw new Error(
      '[sharedService] configureSharedService() must be called before any API call. ' +
        'Call it once at app boot (mobile: src/bootstrap.ts, cms: src/main.jsx).',
    );
  }
  return config;
}

export function isSharedServiceConfigured(): boolean {
  return config !== null;
}

/** Absolute URL for a stored media path such as `/uploads/squat.mp4`. */
export function resolveMediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^(https?:)?\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('data:')) return pathOrUrl;
  const { socketUrl } = getSharedServiceConfig();
  return `${socketUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/** Test helper. */
export function resetSharedServiceConfig(): void {
  config = null;
}
