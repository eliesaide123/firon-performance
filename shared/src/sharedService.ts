/**
 * Firon Performance — sharedService.ts
 * =====================================
 * The ONE place any HTTP call leaves the CMS or the mobile app.
 *
 *   Every endpoint goes through `clientProxy`.
 *   Every failure is normalised to an `FPError` inside `clientProxy`.
 *   Every non-silent failure raises an alert popup (rendered by `FP_Alert`) from here.
 *
 * Screens therefore never build URLs, never attach tokens, never unwrap the response envelope,
 * never parse a validation payload and never show their own error dialog. They call
 * `api.auth.login(...)` (see `endpoints.ts`) and either get typed data back or catch an `FPError`
 * whose popup the user has already seen.
 *
 * Implemented on `fetch` / `XMLHttpRequest` — both available in React Native and the browser — so
 * this file is genuinely shared with no platform shims.
 */

import { fpAlert } from './alertBus';
import { getSharedServiceConfig, resolveMediaUrl, type FPAuthTokens } from './config';
import {
  codeForStatus,
  DEFAULT_ERROR_MESSAGES,
  extractFieldErrors,
  FP_ERROR_CODES,
  FPError,
  isFPError,
  type FPFieldErrors,
} from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  pages?: number;
  [key: string]: unknown;
}

/** The backend envelope from CONTRACT §5. */
interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}
interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

export interface ClientProxyOptions<TBody = unknown> {
  /** Path relative to the configured `baseUrl`, e.g. `/auth/login`. */
  path: string;
  method?: HttpMethod;
  body?: TBody;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  /** Attach the bearer token. Default true. */
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;

  /**
   * Show the FP_Alert popup on failure. Default true.
   * Set false when the screen renders the error itself (e.g. inline login validation).
   */
  showAlert?: boolean;
  /** Override the popup title. */
  alertTitle?: string;
  /** Codes that should never pop an alert even when `showAlert` is true. */
  suppressAlertForCodes?: string[];
  /** Show a success popup with this message when the call succeeds. */
  successMessage?: string;

  /** Multipart upload. When set, `body` is ignored. */
  formData?: FormDataLike;
  /** Progress 0..100. Forces the XHR transport, which is the only one that reports progress. */
  onUploadProgress?: (percent: number) => void;

  /** Retry count for transport failures and 5xx. Default 0 for writes, 1 for GET. */
  retries?: number;
  /** Skip the automatic 401 → refresh → retry dance (used by the refresh call itself). */
  skipRefresh?: boolean;
  /** Return `{ data, meta }` instead of just `data` — for paginated lists. */
  withMeta?: boolean;
}

/** Structural type so this file needs neither DOM nor RN lib types for FormData. */
export interface FormDataLike {
  append(name: string, value: unknown, fileName?: string): void;
}

/**
 * `fetch` and `XMLHttpRequest.send` are typed differently by the DOM lib and by React Native's
 * generated types (`BodyInit` vs `BodyInit_`, no `XMLHttpRequestBodyInit` at all). Deriving the
 * body types from the ambient signatures keeps this one file valid in both environments.
 */
type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;
type FetchBody = FetchInit extends { body?: infer B } ? B : never;
type XhrBody = Parameters<XMLHttpRequest['send']>[0];

export interface ClientProxyResult<T> {
  data: T;
  meta?: ApiMeta;
}

/* ------------------------------------------------------------------ *
 * URL + header helpers
 * ------------------------------------------------------------------ */

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const { baseUrl } = getSharedServiceConfig();
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${clean}${buildQueryString(query)}`;
}

async function buildHeaders(opts: ClientProxyOptions<unknown>): Promise<Record<string, string>> {
  const cfg = getSharedServiceConfig();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-FP-Platform': cfg.platform,
    ...cfg.defaultHeaders,
    ...opts.headers,
  };

  // Let fetch/XHR set the multipart boundary itself — never set Content-Type for FormData.
  if (!opts.formData && opts.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (opts.auth !== false) {
    const token = await cfg.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/* ------------------------------------------------------------------ *
 * Error normalisation — the single funnel
 * ------------------------------------------------------------------ */

function messageForCode(code: string, fallback?: string): string {
  const { errorMessages } = getSharedServiceConfig();
  return errorMessages?.[code] ?? DEFAULT_ERROR_MESSAGES[code] ?? fallback ?? DEFAULT_ERROR_MESSAGES[FP_ERROR_CODES.UNKNOWN]!;
}

function toFPError(
  raw: unknown,
  ctx: { method: HttpMethod; path: string; status?: number; body?: unknown },
): FPError {
  if (isFPError(raw)) return raw;

  const request = { method: ctx.method, path: ctx.path };
  const status = ctx.status ?? 0;

  // 1. A well-formed error envelope from our own backend — trust its code and message.
  const envelope = ctx.body as Partial<ErrorEnvelope> | undefined;
  if (envelope && envelope.success === false && envelope.error) {
    const { code, message, details } = envelope.error;
    const fieldErrors = extractFieldErrors(details);
    return new FPError({
      code: code || codeForStatus(status),
      // Prefer the server's message — it is written for humans and is more specific than ours.
      message: message || messageForCode(code || codeForStatus(status)),
      status,
      details,
      fieldErrors,
      request,
    });
  }

  // 2. A non-2xx response that is not our envelope (proxy error page, gateway timeout, ...).
  if (status > 0) {
    const code = codeForStatus(status);
    return new FPError({ code, message: messageForCode(code), status, details: ctx.body, request });
  }

  // 3. Transport-level failure.
  const err = raw as { name?: string; message?: string };
  if (err?.name === 'AbortError') {
    const aborted = new FPError({
      code: FP_ERROR_CODES.ABORTED,
      message: messageForCode(FP_ERROR_CODES.ABORTED),
      status: 0,
      request,
    });
    aborted.silent = true; // a cancelled request is not a user-facing failure
    return aborted;
  }
  if (err?.name === 'TimeoutError') {
    return new FPError({
      code: FP_ERROR_CODES.TIMEOUT,
      message: messageForCode(FP_ERROR_CODES.TIMEOUT),
      status: 0,
      request,
    });
  }
  return new FPError({
    code: FP_ERROR_CODES.NETWORK,
    message: messageForCode(FP_ERROR_CODES.NETWORK),
    status: 0,
    details: err?.message,
    request,
  });
}

const ALERT_TITLES: Record<string, string> = {
  [FP_ERROR_CODES.NETWORK]: 'No connection',
  [FP_ERROR_CODES.TIMEOUT]: 'Request timed out',
  [FP_ERROR_CODES.UNAUTHORIZED]: 'Session expired',
  [FP_ERROR_CODES.FORBIDDEN]: 'Not allowed',
  [FP_ERROR_CODES.NOT_FOUND]: 'Not found',
  [FP_ERROR_CODES.VALIDATION_ERROR]: 'Check your details',
  [FP_ERROR_CODES.RATE_LIMITED]: 'Slow down',
  [FP_ERROR_CODES.NOT_VERIFIED]: 'Verify your account',
  [FP_ERROR_CODES.PAYLOAD_TOO_LARGE]: 'File too large',
  [FP_ERROR_CODES.SERVER_ERROR]: 'Server error',
};

/**
 * Raises the popup. This is the reason every call goes through the proxy: one implementation of
 * "the user must be told something went wrong", not one per screen.
 */
function raiseAlert(error: FPError, opts: ClientProxyOptions<unknown>): void {
  if (error.silent) return;
  if (opts.showAlert === false) return;
  if (opts.suppressAlertForCodes?.includes(String(error.code))) return;

  const title = opts.alertTitle ?? ALERT_TITLES[String(error.code)] ?? 'Something went wrong';
  const technical = `${error.request?.method ?? ''} ${error.request?.path ?? ''} · ${error.status || 'no response'} · ${error.code}`.trim();

  fpAlert.error(title, error.message, {
    technical,
    error,
    ...(error.retryable ? {} : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Single-flight token refresh
 * ------------------------------------------------------------------ */

/**
 * Why a refresh attempt did not produce new tokens.
 *
 * The distinction matters a great deal: only `rejected` and `no-token` mean the session is
 * genuinely over. A `network` failure must NOT log the user out — otherwise a momentary
 * connectivity blip while an access token happens to be expired silently destroys a valid
 * 30-day session, and the user is dumped back to the login screen for no reason.
 */
type RefreshFailure = 'no-token' | 'rejected' | 'network';

type RefreshOutcome =
  | { ok: true; tokens: FPAuthTokens }
  | { ok: false; reason: RefreshFailure; error?: FPError };

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Refreshes the access token. Concurrent 401s all await the same promise, so five parallel
 * requests hitting an expired token produce exactly one refresh call.
 */
async function refreshTokens(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async (): Promise<RefreshOutcome> => {
    const cfg = getSharedServiceConfig();
    const refreshToken = await cfg.getRefreshToken();
    if (!refreshToken) return { ok: false, reason: 'no-token' };

    try {
      const tokens = await clientProxy<FPAuthTokens>({
        path: '/auth/refresh',
        method: 'POST',
        body: { refreshToken },
        auth: false,
        skipRefresh: true,
        showAlert: false,
        retries: 1, // one retry, so a single dropped packet doesn't look like a dead session
      });
      await cfg.onTokensRefreshed(tokens);
      return { ok: true, tokens };
    } catch (err) {
      const error = isFPError(err) ? err : undefined;
      // status 0 == transport failure (offline, DNS, timeout, aborted): keep the session.
      const reason: RefreshFailure = !error || error.status === 0 ? 'network' : 'rejected';
      return { ok: false, reason, error };
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/* ------------------------------------------------------------------ *
 * Transports
 * ------------------------------------------------------------------ */

interface RawResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

function linkAbort(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) return () => {};
  if (signal.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = (): void => controller.abort();
  signal.addEventListener('abort', onAbort);
  return () => signal.removeEventListener('abort', onAbort);
}

async function fetchTransport(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  opts: ClientProxyOptions<unknown>,
  timeoutMs: number,
): Promise<RawResponse> {
  const controller = new AbortController();
  const unlink = linkAbort(opts.signal, controller);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: opts.formData
        ? (opts.formData as unknown as FetchBody)
        : opts.body !== undefined
          ? (JSON.stringify(opts.body) as FetchBody)
          : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

/** Used only when the caller wants upload progress — `fetch` cannot report it. */
function xhrTransport(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  opts: ClientProxyOptions<unknown>,
  timeoutMs: number,
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type' && opts.formData) continue;
      xhr.setRequestHeader(key, value);
    }

    if (opts.onUploadProgress && xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent): void => {
        if (event.lengthComputable && event.total > 0) {
          opts.onUploadProgress!(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = (): void => {
      let body: unknown;
      if (xhr.responseText) {
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = xhr.responseText;
        }
      }
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, body });
    };
    xhr.onerror = (): void => reject(Object.assign(new Error('Network request failed'), { name: 'TypeError' }));
    xhr.ontimeout = (): void => reject(Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }));
    xhr.onabort = (): void => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

    if (opts.signal) {
      if (opts.signal.aborted) xhr.abort();
      else opts.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(
      opts.formData
        ? (opts.formData as unknown as XhrBody)
        : opts.body !== undefined
          ? (JSON.stringify(opts.body) as XhrBody)
          : null,
    );
  });
}

/* ------------------------------------------------------------------ *
 * clientProxy — the shared function every endpoint goes through
 * ------------------------------------------------------------------ */

/**
 * Executes one API call.
 *
 * On success: unwraps `{ success, data }` and returns `data` (or `{ data, meta }` with
 * `withMeta: true`), optionally popping a success alert.
 *
 * On failure: normalises to `FPError`, handles 401 by refreshing once and retrying, retries
 * transport/5xx failures up to `retries`, raises the `FP_Alert` popup, reports to
 * `config.onError`, and finally throws the `FPError` so callers can still branch on `code` or
 * read `fieldErrors` for inline validation.
 */
export async function clientProxy<TResponse, TBody = unknown>(
  options: ClientProxyOptions<TBody> & { withMeta: true },
): Promise<ClientProxyResult<TResponse>>;
export async function clientProxy<TResponse, TBody = unknown>(
  options: ClientProxyOptions<TBody>,
): Promise<TResponse>;
export async function clientProxy<TResponse, TBody = unknown>(
  options: ClientProxyOptions<TBody>,
): Promise<TResponse | ClientProxyResult<TResponse>> {
  const cfg = getSharedServiceConfig();
  const method = options.method ?? 'GET';
  const opts = options as ClientProxyOptions<unknown>;
  const timeoutMs = options.timeoutMs ?? cfg.timeoutMs;
  const maxRetries = options.retries ?? (method === 'GET' ? 1 : 0);
  const useXhr = Boolean(options.onUploadProgress);

  let attempt = 0;
  let refreshed = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startedAt = Date.now();
    const url = buildUrl(options.path, options.query);
    let raw: RawResponse;

    try {
      const headers = await buildHeaders(opts);
      if (cfg.debug) {
        // eslint-disable-next-line no-console
        console.log(`[clientProxy] → ${method} ${url}`);
      }
      raw = useXhr
        ? await xhrTransport(url, method, headers, opts, timeoutMs)
        : await fetchTransport(url, method, headers, opts, timeoutMs);
    } catch (transportError) {
      const error = toFPError(transportError, { method, path: options.path });
      cfg.onRequest?.({ method, path: options.path, status: 0, ms: Date.now() - startedAt, ok: false });

      if (error.retryable && attempt < maxRetries) {
        attempt += 1;
        await delay(backoffMs(attempt));
        continue;
      }

      cfg.onError?.(error);
      raiseAlert(error, opts);
      throw error;
    }

    cfg.onRequest?.({ method, path: options.path, status: raw.status, ms: Date.now() - startedAt, ok: raw.ok });

    /* ---------- success ---------- */
    if (raw.ok) {
      const envelope = raw.body as Partial<SuccessEnvelope<TResponse>> | undefined;

      // 204 and other empty bodies are legitimate successes.
      if (raw.status === 204 || raw.body === undefined || raw.body === '') {
        if (options.successMessage) fpAlert.success(options.successMessage);
        return (options.withMeta ? { data: undefined as TResponse } : (undefined as TResponse)) as TResponse;
      }

      if (!envelope || typeof envelope !== 'object' || envelope.success !== true || !('data' in envelope)) {
        const error = new FPError({
          code: FP_ERROR_CODES.BAD_RESPONSE,
          message: messageForCode(FP_ERROR_CODES.BAD_RESPONSE),
          status: raw.status,
          details: raw.body,
          request: { method, path: options.path },
        });
        cfg.onError?.(error);
        raiseAlert(error, opts);
        throw error;
      }

      if (options.successMessage) fpAlert.success(options.successMessage);
      return options.withMeta
        ? ({ data: envelope.data as TResponse, meta: envelope.meta } as ClientProxyResult<TResponse>)
        : (envelope.data as TResponse);
    }

    /* ---------- failure ---------- */
    const error = toFPError(null, { method, path: options.path, status: raw.status, body: raw.body });

    // 401 → refresh once, then replay the original request.
    const isAuthFailure = raw.status === 401 && error.code !== FP_ERROR_CODES.NOT_VERIFIED;
    if (isAuthFailure && !options.skipRefresh && !refreshed && options.auth !== false) {
      refreshed = true;
      const outcome = await refreshTokens();
      if (outcome.ok) continue;

      if (outcome.reason === 'network') {
        // We could not reach the refresh endpoint. The session may well still be valid, so do
        // NOT tear it down — surface this as the connectivity problem it actually is and let the
        // caller retry later.
        const netError = new FPError({
          code: FP_ERROR_CODES.NETWORK,
          message: messageForCode(FP_ERROR_CODES.NETWORK),
          status: 0,
          request: { method, path: options.path },
          retryable: true,
        });
        cfg.onError?.(netError);
        raiseAlert(netError, opts);
        throw netError;
      }

      // The server rejected the refresh token (or there was none): the session is genuinely over.
      await cfg.onUnauthenticated(error);
      cfg.onError?.(error);
      raiseAlert(error, opts);
      throw error;
    }

    if (error.retryable && attempt < maxRetries) {
      attempt += 1;
      await delay(backoffMs(attempt));
      continue;
    }

    cfg.onError?.(error);
    raiseAlert(error, opts);
    throw error;
  }
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** (attempt - 1), 2000);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ *
 * Thin verb helpers — sugar over clientProxy, same guarantees
 * ------------------------------------------------------------------ */

type VerbOptions<TBody> = Omit<ClientProxyOptions<TBody>, 'path' | 'method' | 'body'>;

export const http = {
  get<T>(path: string, options?: VerbOptions<never>): Promise<T> {
    return clientProxy<T>({ ...options, path, method: 'GET' });
  },
  getWithMeta<T>(path: string, options?: VerbOptions<never>): Promise<ClientProxyResult<T>> {
    return clientProxy<T>({ ...options, path, method: 'GET', withMeta: true });
  },
  post<T, B = unknown>(path: string, body?: B, options?: VerbOptions<B>): Promise<T> {
    return clientProxy<T, B>({ ...options, path, method: 'POST', body });
  },
  put<T, B = unknown>(path: string, body?: B, options?: VerbOptions<B>): Promise<T> {
    return clientProxy<T, B>({ ...options, path, method: 'PUT', body });
  },
  patch<T, B = unknown>(path: string, body?: B, options?: VerbOptions<B>): Promise<T> {
    return clientProxy<T, B>({ ...options, path, method: 'PATCH', body });
  },
  del<T, B = unknown>(path: string, body?: B, options?: VerbOptions<B>): Promise<T> {
    return clientProxy<T, B>({ ...options, path, method: 'DELETE', body });
  },
  upload<T>(
    path: string,
    formData: FormDataLike,
    options?: VerbOptions<never> & { method?: 'POST' | 'PUT' | 'PATCH' },
  ): Promise<T> {
    return clientProxy<T>({ ...options, path, method: options?.method ?? 'POST', formData });
  },
};

/** Re-exported so consumers need one import for the whole service layer. */
export { fpAlert, resolveMediaUrl, FPError, isFPError, FP_ERROR_CODES };
export type { FPFieldErrors };
