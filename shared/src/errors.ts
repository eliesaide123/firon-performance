/**
 * Firon Performance — normalised error model.
 *
 * Everything that can go wrong in a network call (transport failure, timeout, abort,
 * non-2xx response, malformed envelope, token refresh failure) is funnelled into a single
 * `FPError` shape so the UI only ever has to understand one thing.
 */

export const FP_ERROR_CODES = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',
  BAD_RESPONSE: 'BAD_RESPONSE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type FPErrorCode = (typeof FP_ERROR_CODES)[keyof typeof FP_ERROR_CODES] | string;

/**
 * The backend's own `error.code` vocabulary (extracted from `backend/src`). These pass through
 * `clientProxy` untouched, alongside the transport codes above, so a screen can branch on any of
 * them. Listed here so a frontend never has to guess a string.
 */
export const FP_SERVER_ERROR_CODES = {
  // 400
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_ID: 'INVALID_ID',
  INVALID_OTP: 'INVALID_OTP',
  NOT_A_CLIENT: 'NOT_A_CLIENT',
  NO_DESTINATION: 'NO_DESTINATION',
  NO_FILE: 'NO_FILE',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_NOT_FOUND: 'OTP_NOT_FOUND',
  TRAINER_INACTIVE: 'TRAINER_INACTIVE',
  // 401
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NO_TOKEN: 'NO_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  // 403
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  CLIENT_ONLY: 'CLIENT_ONLY',
  DAY_LOCKED: 'DAY_LOCKED',
  MEDIA_NOT_APPROVED: 'MEDIA_NOT_APPROVED',
  // 404
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  DAY_NOT_FOUND: 'DAY_NOT_FOUND',
  EXERCISE_NOT_FOUND: 'EXERCISE_NOT_FOUND',
  LOG_NOT_FOUND: 'LOG_NOT_FOUND',
  MEAL_NOT_FOUND: 'MEAL_NOT_FOUND',
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  TRAINER_NOT_FOUND: 'TRAINER_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  // 409
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_PHONE: 'DUPLICATE_PHONE',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  PHONE_IN_USE: 'PHONE_IN_USE',
  // 429
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
} as const;

/** Field-level messages, keyed by form field name — drives inline input errors. */
export type FPFieldErrors = Record<string, string>;

export interface FPErrorShape {
  /** Machine-readable code. Server codes pass through untouched. */
  code: FPErrorCode;
  /** Human-readable, safe to show in an alert. */
  message: string;
  /** HTTP status, or 0 for transport-level failures. */
  status: number;
  /** Raw `error.details` from the server envelope, when present. */
  details?: unknown;
  /** Extracted from a 422 so forms can highlight the offending inputs. */
  fieldErrors?: FPFieldErrors;
  /** The request that failed, for logs and the alert's technical detail row. */
  request?: { method: string; path: string };
  /** Set when the caller asked for the popup to be suppressed. */
  silent?: boolean;
  /** True when retrying the same call could plausibly succeed. */
  retryable?: boolean;
}

/**
 * The single error class thrown by `clientProxy`. Extends `Error` so it behaves normally in
 * try/catch, `instanceof` and React Query, while carrying the structured payload above.
 */
export class FPError extends Error implements FPErrorShape {
  readonly code: FPErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly fieldErrors?: FPFieldErrors;
  readonly request?: { method: string; path: string };
  silent?: boolean;
  readonly retryable: boolean;
  readonly isFPError = true as const;

  constructor(shape: FPErrorShape) {
    super(shape.message);
    this.name = 'FPError';
    this.code = shape.code;
    this.status = shape.status;
    this.details = shape.details;
    this.fieldErrors = shape.fieldErrors;
    this.request = shape.request;
    this.silent = shape.silent;
    this.retryable = shape.retryable ?? isRetryableStatus(shape.status);
    // Keep the prototype chain intact when targeting ES5-ish runtimes.
    Object.setPrototypeOf(this, FPError.prototype);
  }

  toJSON(): FPErrorShape {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
      fieldErrors: this.fieldErrors,
      request: this.request,
      silent: this.silent,
      retryable: this.retryable,
    };
  }
}

export function isFPError(value: unknown): value is FPError {
  return value instanceof FPError || (typeof value === 'object' && value !== null && (value as { isFPError?: boolean }).isFPError === true);
}

function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Default, user-facing copy per code. Overridable via `configureSharedService({ errorMessages })`. */
export const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  [FP_ERROR_CODES.NETWORK]: "Can't reach the server. Check your connection and try again.",
  [FP_ERROR_CODES.TIMEOUT]: 'The server took too long to respond. Please try again.',
  [FP_ERROR_CODES.ABORTED]: 'The request was cancelled.',
  [FP_ERROR_CODES.BAD_RESPONSE]: 'The server sent something we could not read.',
  [FP_ERROR_CODES.UNAUTHORIZED]: 'Your session has expired. Please sign in again.',
  [FP_ERROR_CODES.FORBIDDEN]: "You don't have permission to do that.",
  [FP_ERROR_CODES.NOT_FOUND]: 'We could not find what you were looking for.',
  [FP_ERROR_CODES.CONFLICT]: 'That conflicts with something that already exists.',
  [FP_ERROR_CODES.VALIDATION_ERROR]: 'Please check the highlighted fields and try again.',
  [FP_ERROR_CODES.RATE_LIMITED]: 'Too many attempts. Please wait a moment and try again.',
  [FP_ERROR_CODES.NOT_VERIFIED]: 'Your account is not verified yet. Enter the code we sent you.',
  [FP_ERROR_CODES.PAYLOAD_TOO_LARGE]: 'That file is too large to upload.',
  [FP_ERROR_CODES.SERVER_ERROR]: 'Something went wrong on our side. Please try again.',
  [FP_ERROR_CODES.NOT_CONFIGURED]: 'The app is not configured yet. Please restart it.',
  [FP_ERROR_CODES.UNKNOWN]: 'Something went wrong. Please try again.',
  // Server codes whose default copy is worth spelling out; the server's own `message` still wins.
  INVALID_CREDENTIALS: 'Wrong email/phone or password',
  ACCOUNT_DISABLED: "We're sorry — your account has been deactivated. Please contact your administrator for more information.",
  INVALID_OTP: 'That code is not right. Please check and try again.',
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  OTP_ATTEMPTS_EXCEEDED: 'Too many incorrect codes. Request a new one.',
  EMAIL_IN_USE: 'That email is already registered.',
  PHONE_IN_USE: 'That phone number is already registered.',
  DAY_LOCKED: "That day isn't unlocked yet.",
  MEDIA_NOT_APPROVED: 'This media is still awaiting approval.',
  CLIENT_ONLY: 'This is only available to clients.',
  NO_FILE: 'Choose a file to upload first.',
};

/** Maps an HTTP status to a code when the server did not supply one. */
export function codeForStatus(status: number): FPErrorCode {
  switch (status) {
    case 400:
      return FP_ERROR_CODES.VALIDATION_ERROR;
    case 401:
      return FP_ERROR_CODES.UNAUTHORIZED;
    case 403:
      return FP_ERROR_CODES.FORBIDDEN;
    case 404:
      return FP_ERROR_CODES.NOT_FOUND;
    case 409:
      return FP_ERROR_CODES.CONFLICT;
    case 413:
      return FP_ERROR_CODES.PAYLOAD_TOO_LARGE;
    case 422:
      return FP_ERROR_CODES.VALIDATION_ERROR;
    case 429:
      return FP_ERROR_CODES.RATE_LIMITED;
    default:
      return status >= 500 ? FP_ERROR_CODES.SERVER_ERROR : FP_ERROR_CODES.UNKNOWN;
  }
}

/**
 * Pulls `{ field: message }` out of whatever the backend's validation middleware produced.
 * Tolerates the zod `issues` array, a flat object, and an array of `{ path, message }`.
 */
export function extractFieldErrors(details: unknown): FPFieldErrors | undefined {
  if (!details) return undefined;

  const out: FPFieldErrors = {};

  const push = (path: unknown, message: unknown): void => {
    const key = Array.isArray(path) ? path.filter(p => p !== undefined && p !== null).join('.') : String(path ?? '');
    if (key && typeof message === 'string' && !out[key]) out[key] = message;
  };

  if (Array.isArray(details)) {
    for (const item of details) {
      if (item && typeof item === 'object') {
        const rec = item as { path?: unknown; field?: unknown; message?: unknown };
        push(rec.path ?? rec.field, rec.message);
      }
    }
  } else if (typeof details === 'object') {
    const rec = details as { issues?: unknown; fieldErrors?: unknown; [k: string]: unknown };
    if (Array.isArray(rec.issues)) return extractFieldErrors(rec.issues);
    if (rec.fieldErrors && typeof rec.fieldErrors === 'object') {
      for (const [k, v] of Object.entries(rec.fieldErrors as Record<string, unknown>)) {
        push(k, Array.isArray(v) ? v[0] : v);
      }
    } else {
      for (const [k, v] of Object.entries(rec)) {
        if (typeof v === 'string') push(k, v);
        else if (Array.isArray(v) && typeof v[0] === 'string') push(k, v[0]);
      }
    }
  }

  return Object.keys(out).length ? out : undefined;
}
