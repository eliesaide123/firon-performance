/**
 * Session state. Tokens live in AsyncStorage; the role on the user object is the
 * only thing that decides which portal mounts (CONTRACT §3).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, isFPError } from '@firon/shared';
import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  User,
  UserRole,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@firon/shared';
import tokenStore from './tokenStore';
import { STORAGE_KEYS } from '../config';
import log from '../log';
import { unregisterPushToken } from '../push/tokenRegistration';

export type BootState = 'booting' | 'ready';

/** The shapes the auth screens pass in — aliases of the shared request DTOs. */
export type LoginPayload = LoginRequest;
export type RegisterPayload = RegisterRequest;
export type VerifyOtpPayload = VerifyOtpRequest;

interface AuthContextValue {
  boot: BootState;
  user: User | null;
  /**
   * The unread count `GET /auth/me` bundles with the user, so the notification badge is correct
   * on the very first paint without a second round trip. `null` until /auth/me has answered.
   */
  unreadNotifications: number | null;
  role: UserRole | null;
  signedIn: boolean;
  rememberedIdentifier: string;
  remember: boolean;

  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  verifyOtp: (payload: {
    userId?: string;
    destination?: string;
    code: string;
    purpose: 'verify' | 'reset';
  }) => Promise<VerifyOtpResponse>;
  forgotPassword: (payload: { identifier: string; channel: 'email' | 'sms' }) => Promise<string>;
  resetPassword: (payload: { resetToken: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<User | null>;
  /** Locally patch the cached user (after saving details, editing a profile…). */
  patchUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [boot, setBoot] = useState<BootState>('booting');
  const [user, setUser] = useState<User | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number | null>(null);
  const [remember, setRemember] = useState(true);
  const [rememberedIdentifier, setRememberedIdentifier] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applySession = useCallback(async (next: User, tokens?: { accessToken: string; refreshToken: string }) => {
    if (tokens) {
      await tokenStore.set(tokens);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
    if (mounted.current) {
      setUser(next);
    }
  }, []);

  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    if (mounted.current) {
      setUser(null);
      setUnreadNotifications(null);
    }
  }, []);

  /* a refresh that fails hard drops us back to the login screen */
  useEffect(() => tokenStore.onForcedLogout(() => {
    log.warn('forced logout: refresh failed');
    void clearSession();
  }), [clearSession]);

  /* cold start: restore tokens, then re-derive the role from /auth/me */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ accessToken }, cachedUser, rememberFlag, lastId] = await Promise.all([
          tokenStore.load(),
          AsyncStorage.getItem(STORAGE_KEYS.user),
          AsyncStorage.getItem(STORAGE_KEYS.remember),
          AsyncStorage.getItem(STORAGE_KEYS.identifier),
        ]);

        if (cancelled) {
          return;
        }
        if (rememberFlag !== null) {
          setRemember(rememberFlag === '1');
        }
        if (lastId) {
          setRememberedIdentifier(lastId);
        }

        // Show the cached user instantly so the right portal paints without a flash…
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser) as User);
          } catch {
            /* ignore a corrupt cache */
          }
        }

        // …then trust the server for the authoritative role.
        if (accessToken) {
          try {
            // The boot screen handles this failure itself, so no popup.
            const { user: fresh, unreadNotifications: unread } = await api.auth.me({ showAlert: false });
            if (!cancelled && fresh) {
              await applySession(fresh);
              setUnreadNotifications(typeof unread === 'number' ? unread : null);
            }
          } catch (err) {
            const status = isFPError(err) ? err.status : 0;
            log.warn('cold-start /auth/me failed', isFPError(err) ? err.code : 'UNKNOWN', String(err));
            // The proxy already tried a refresh on a 401; if we are still unauthorised the
            // session is dead. Network errors keep the cache.
            if (status === 401 || status === 403) {
              await clearSession();
            }
          }
        }
      } finally {
        if (!cancelled) {
          setBoot('ready');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (payload: LoginPayload): Promise<User> => {
      const res = await api.auth.login(payload);
      const rememberMe = payload.remember !== false;
      setRemember(rememberMe);
      await AsyncStorage.setItem(STORAGE_KEYS.remember, rememberMe ? '1' : '0');
      if (rememberMe) {
        await AsyncStorage.setItem(STORAGE_KEYS.identifier, payload.identifier);
        setRememberedIdentifier(payload.identifier);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.identifier);
        setRememberedIdentifier('');
      }
      await applySession(res.user, {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      return res.user;
    },
    [applySession],
  );

  const register = useCallback(
    (payload: RegisterPayload): Promise<RegisterResponse> => api.auth.register(payload),
    [],
  );

  const verifyOtp = useCallback(
    async (payload: {
      userId?: string;
      destination?: string;
      code: string;
      purpose: 'verify' | 'reset';
    }): Promise<VerifyOtpResponse> => {
      const res = await api.auth.verifyOtp(payload);
      if (res.accessToken && res.refreshToken && res.user) {
        await applySession(res.user, {
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
      }
      return res;
    },
    [applySession],
  );

  const forgotPassword = useCallback(
    async (payload: { identifier: string; channel: 'email' | 'sms' }): Promise<string> => {
      const res = await api.auth.forgotPassword(payload);
      return res.destination ?? payload.identifier;
    },
    [],
  );

  const resetPassword = useCallback(
    async (payload: { resetToken: string; password: string }): Promise<void> => {
      await api.auth.resetPassword(payload);
    },
    [],
  );

  const logout = useCallback(async () => {
    // Unregister the FCM token FIRST, while we still hold a valid access token. Do it before
    // anything clears the session, or a shared device keeps receiving the previous user's pushes
    // until a send happens to fail and the backend prunes the token lazily.
    try {
      await unregisterPushToken();
    } catch (err) {
      log.warn('failed to unregister the push token (continuing with logout)', err);
    }

    try {
      await api.auth.logout();
    } catch (err) {
      log.warn('logout call failed (clearing locally anyway)', err);
    }
    await clearSession();
  }, [clearSession]);

  const refreshMe = useCallback(async (): Promise<User | null> => {
    try {
      const { user: fresh, unreadNotifications: unread } = await api.auth.me({ showAlert: false });
      if (fresh) {
        await applySession(fresh);
        setUnreadNotifications(typeof unread === 'number' ? unread : null);
      }
      return fresh ?? null;
    } catch (err) {
      log.warn('refreshMe failed', err);
      return null;
    }
  }, [applySession]);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) {
        return prev;
      }
      const next: User = {
        ...prev,
        ...patch,
        clientProfile: patch.clientProfile
          ? { ...prev.clientProfile, ...patch.clientProfile }
          : prev.clientProfile,
        trainerProfile: patch.trainerProfile
          ? { ...prev.trainerProfile, ...patch.trainerProfile }
          : prev.trainerProfile,
      };
      void AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      boot,
      user,
      unreadNotifications,
      role: user?.role ?? null,
      signedIn: Boolean(user),
      rememberedIdentifier,
      remember,
      login,
      register,
      verifyOtp,
      forgotPassword,
      resetPassword,
      logout,
      refreshMe,
      patchUser,
    }),
    [
      boot,
      user,
      unreadNotifications,
      rememberedIdentifier,
      remember,
      login,
      register,
      verifyOtp,
      forgotPassword,
      resetPassword,
      logout,
      refreshMe,
      patchUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

/** The coach's first name, used by all the `{coach}` interpolations. */
export function useCoachName(): string {
  const { user } = useAuth();
  // `clientProfile.trainerId` is the raw id; the server joins the trainer in as `user.trainer`
  // when it is populated (shared `User`), so that is what carries a name.
  const name = user?.trainer?.name;
  if (name) {
    return name.split(' ')[0] ?? name;
  }
  return 'Sara';
}
