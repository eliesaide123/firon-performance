/*
 * Token storage for the CMS.
 *
 * The shared `clientProxy` owns the HTTP layer; it only needs somewhere to read
 * and write tokens, which is this module (injected at boot in bootstrap.js).
 *
 * "Remember me" chooses the backing store: localStorage (persists across
 * sessions) vs sessionStorage (this tab only). Reads check both so a reload
 * finds whichever was used.
 */
const ACCESS = 'firon.accessToken';
const REFRESH = 'firon.refreshToken';
const REMEMBER = 'firon.remember';

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

function readBoth(key) {
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeOne(key, value, persistent) {
  try {
    const store = persistent ? window.localStorage : window.sessionStorage;
    const other = persistent ? window.sessionStorage : window.localStorage;
    other.removeItem(key);
    if (value == null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — nothing persists, app still works */
  }
}

export const tokenStore = {
  get: (name) => readBoth(name === 'accessToken' ? ACCESS : REFRESH),
  get accessToken() { return readBoth(ACCESS); },
  get refreshToken() { return readBoth(REFRESH); },
  get remember() { return readBoth(REMEMBER) === '1'; },

  setTokens({ accessToken, refreshToken }, remember = tokenStore.remember) {
    const persistent = Boolean(remember);
    if (accessToken !== undefined) writeOne(ACCESS, accessToken ?? null, persistent);
    if (refreshToken !== undefined) writeOne(REFRESH, refreshToken ?? null, persistent);
    writeOne(REMEMBER, persistent ? '1' : '0', persistent);
    notify();
  },

  clear() {
    [ACCESS, REFRESH, REMEMBER].forEach((k) => {
      try {
        window.localStorage.removeItem(k);
        window.sessionStorage.removeItem(k);
      } catch { /* ignore */ }
    });
    notify();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export default tokenStore;
