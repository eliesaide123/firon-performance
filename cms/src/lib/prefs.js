/*
 * CMS-local editor preferences (NOT app content — that lives in Mongo).
 *
 * Which locale and platform the content editor and the phone preview open on is
 * a per-operator choice, so it is kept in localStorage rather than on the server.
 * Settings.jsx is the UI; Content.jsx seeds its filters from here.
 */
const KEY = 'firon.cms.prefs';

export const DEFAULT_PREFS = { locale: 'en', platform: 'mobile' };

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const listeners = new Set();

export const prefs = {
  get all() { return read(); },
  get locale() { return read().locale; },
  get platform() { return read().platform; },

  set(patch) {
    const next = { ...read(), ...patch };
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    listeners.forEach((fn) => fn(next));
    return next;
  },

  reset() { return prefs.set(DEFAULT_PREFS); },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export default prefs;
