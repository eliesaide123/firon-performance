/**
 * Firon Performance — alert bus.
 *
 * `clientProxy` never imports React. When a call fails it publishes an alert here; the
 * `FP_AlertProvider` in each app (web CMS and React Native) subscribes and renders the popup
 * with `FP_Alert`. One bus, two presentations, zero coupling.
 */

import type { FPError } from './errors';

export type FPAlertVariant = 'error' | 'success' | 'warning' | 'info' | 'confirm';

export interface FPAlertAction {
  label: string;
  /** 'primary' renders the lime CTA, 'ghost'/'danger' match the FP_Button variants. */
  kind?: 'primary' | 'ghost' | 'danger';
  onPress?: () => void | Promise<void>;
  /** Close the alert after `onPress` resolves. Defaults to true. */
  dismiss?: boolean;
}

export interface FPAlertPayload {
  id: string;
  variant: FPAlertVariant;
  title: string;
  message: string;
  /** Small monospaced technical line ("POST /api/auth/login · 422 · VALIDATION_ERROR"). */
  technical?: string;
  actions?: FPAlertAction[];
  /** Auto-dismiss after N ms. Errors and confirms never auto-dismiss. */
  autoDismissMs?: number;
  /** The originating error, so a screen can read `fieldErrors` off the same payload. */
  error?: FPError;
  createdAt: number;
}

export type FPAlertInput = Omit<FPAlertPayload, 'id' | 'createdAt'> & { id?: string };

type Listener = (alert: FPAlertPayload) => void;
type DismissListener = (id: string) => void;

const listeners = new Set<Listener>();
const dismissListeners = new Set<DismissListener>();

let counter = 0;
function nextId(): string {
  counter += 1;
  return `fp-alert-${counter}`;
}

/**
 * Suppresses duplicate popups: the same code+message inside this window is dropped so a screen
 * firing five parallel requests that all 401 shows one alert, not five.
 */
const DEDUPE_WINDOW_MS = 1500;
const recent = new Map<string, number>();

function isDuplicate(key: string, now: number): boolean {
  const last = recent.get(key);
  // Opportunistically prune so the map cannot grow unbounded in a long-lived session.
  if (recent.size > 50) {
    for (const [k, t] of recent) {
      if (now - t > DEDUPE_WINDOW_MS) recent.delete(k);
    }
  }
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  recent.set(key, now);
  return false;
}

/** Subscribe to new alerts. Returns an unsubscribe function. */
export function onAlert(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe to programmatic dismissals. Returns an unsubscribe function. */
export function onAlertDismiss(listener: DismissListener): () => void {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}

/** Publish an alert. Returns the generated id, or null when it was deduped. */
export function publishAlert(input: FPAlertInput): string | null {
  const now = Date.now();
  const dedupeKey = `${input.variant}|${input.title}|${input.message}`;
  if (input.variant !== 'confirm' && isDuplicate(dedupeKey, now)) return null;

  const alert: FPAlertPayload = {
    ...input,
    id: input.id ?? nextId(),
    createdAt: now,
  };

  if (listeners.size === 0) {
    // No provider mounted yet (very early boot, or a background task). Do not swallow it.
    // eslint-disable-next-line no-console
    console.warn(`[FP_Alert] no provider mounted — ${alert.variant}: ${alert.title} — ${alert.message}`);
    return alert.id;
  }

  for (const listener of listeners) listener(alert);
  return alert.id;
}

export function dismissAlert(id: string): void {
  for (const listener of dismissListeners) listener(id);
}

/* ---------- Convenience publishers used across both apps ---------- */

export const fpAlert = {
  error(title: string, message: string, extra?: Partial<FPAlertInput>): string | null {
    return publishAlert({ variant: 'error', title, message, ...extra });
  },
  success(title: string, message = '', extra?: Partial<FPAlertInput>): string | null {
    return publishAlert({ variant: 'success', title, message, autoDismissMs: 2600, ...extra });
  },
  warning(title: string, message = '', extra?: Partial<FPAlertInput>): string | null {
    return publishAlert({ variant: 'warning', title, message, autoDismissMs: 4000, ...extra });
  },
  info(title: string, message = '', extra?: Partial<FPAlertInput>): string | null {
    return publishAlert({ variant: 'info', title, message, autoDismissMs: 3200, ...extra });
  },
  /** Promise-based confirm, so callers can `if (await fpAlert.confirm(...)) { ... }`. */
  confirm(
    title: string,
    message: string,
    opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean },
  ): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      publishAlert({
        variant: 'confirm',
        title,
        message,
        actions: [
          {
            label: opts?.confirmLabel ?? 'Confirm',
            kind: opts?.danger ? 'danger' : 'primary',
            onPress: () => resolve(true),
          },
          {
            label: opts?.cancelLabel ?? 'Cancel',
            kind: 'ghost',
            onPress: () => resolve(false),
          },
        ],
      });
    });
  },
};

/** Test/teardown helper. */
export function resetAlertBus(): void {
  listeners.clear();
  dismissListeners.clear();
  recent.clear();
}
