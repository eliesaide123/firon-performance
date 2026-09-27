/*
 * Auth state for the CMS (CONTRACT §3).
 *
 * The login form NEVER asks for a role — the server returns `user.role` and we
 * route on it. Only `admin` and `trainer` may use this portal; anything else is
 * rejected with the staff-only message and no tokens are kept.
 *
 * Every call goes through `api.*` (the shared clientProxy), so there is no
 * try/catch here just to show an error: the proxy already raised FP_Alert. We
 * only catch where we must still make a local decision (hydrate, logout).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, isFPError } from '@firon/shared';
import tokenStore from '../lib/tokenStore.js';
import log from '../lib/log.js';
import { STAFF_ROLES } from '../lib/constants.js';
import { setUnauthenticatedHandler } from '../bootstrap.js';

const AuthCtx = createContext(null);

export const STAFF_ONLY_MESSAGE = 'This portal is for staff only';

export function FP_AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);
  /** Seed for the topbar bell, handed to us by GET /auth/me. */
  const [initialUnread, setInitialUnread] = useState(0);

  /* A refresh failure inside the proxy must clear React state too, not just storage. */
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null);
      setLoading(false);
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  /* hydrate on boot from GET /auth/me */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokenStore.accessToken && !tokenStore.refreshToken) {
        if (alive) setLoading(false);
        return;
      }
      try {
        // A dead session on boot is expected, not an incident — keep it quiet.
        const me = await api.auth.me({ showAlert: false });
        const profile = me?.user ?? me;
        if (!alive) return;
        if (!STAFF_ROLES.includes(profile?.role)) {
          tokenStore.clear();
          setUser(null);
          setBootError(STAFF_ONLY_MESSAGE);
        } else {
          setUser(profile);
          setInitialUnread(Number(me?.unreadNotifications) || 0);
        }
      } catch (err) {
        const code = isFPError(err) ? err.code : 'UNKNOWN';
        log.warn('session hydrate failed:', code, err?.message);
        if (!alive) return;
        if (isFPError(err) && (err.status === 401 || err.code === 'UNAUTHORIZED')) tokenStore.clear();
        else setBootError(err?.message ?? 'Could not restore your session');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (identifier, password, remember = true) => {
    // No role is sent — CONTRACT §3.1. The login screen renders field errors
    // inline, so the proxy's popup stays suppressed for those codes.
    const data = await api.auth.login({ identifier, password, remember });
    const profile = data?.user;
    if (!profile) {
      const err = new Error('Login response did not include a user');
      err.code = 'BAD_RESPONSE';
      throw err;
    }

    if (!STAFF_ROLES.includes(profile.role)) {
      tokenStore.clear();
      const err = new Error(STAFF_ONLY_MESSAGE);
      err.code = 'STAFF_ONLY';
      err.role = profile.role;
      throw err;
    }

    tokenStore.setTokens(
      { accessToken: data.accessToken, refreshToken: data.refreshToken },
      remember,
    );
    setUser(profile);
    log.info('signed in as', profile.email, profile.role);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    // Already silent in endpoints.ts; a failure must not block the local sign-out.
    try { await api.auth.logout(); }
    catch (err) { log.warn('logout endpoint failed, clearing locally:', err?.code); }
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await api.auth.me();
    const profile = me?.user ?? me;
    setUser(profile);
    return profile;
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    bootError,
    initialUnread,
    clearBootError: () => setBootError(null),
    login,
    logout,
    refreshMe,
    isAdmin: user?.role === 'admin',
    isTrainer: user?.role === 'trainer',
    isAuthenticated: Boolean(user),
  }), [user, loading, bootError, initialUnread, login, logout, refreshMe]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <FP_AuthProvider>');
  return ctx;
}

export default FP_AuthProvider;
