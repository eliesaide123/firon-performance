/**
 * AsyncStorage-backed token store.
 *
 * `@firon/shared`'s clientProxy owns the HTTP layer but is platform-agnostic, so it reads and
 * writes tokens through the accessors this module exposes (wired up in `src/bootstrap.ts`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FPAuthTokens } from '@firon/shared';
import { STORAGE_KEYS } from '../config';

type Listener = () => void;

/** In-memory mirror so the proxy's token accessor normally resolves without touching storage. */
let accessToken: string | null = null;
let refreshToken: string | null = null;
const forcedLogoutListeners = new Set<Listener>();

/**
 * The initial AsyncStorage read, kicked off at module load and memoised.
 *
 * This closes a race that would otherwise silently log people out: on every cold start (and on
 * every Metro reload in dev) the in-memory mirror begins as `null`. If any authenticated request
 * fires in the window before the read completes, it goes out with no Authorization header, 401s,
 * fails to refresh — and the session gets torn down even though perfectly good tokens were sitting
 * in storage the whole time. Awaiting this promise in the accessors makes that window unreachable.
 */
let hydration: Promise<void> | null = null;

function hydrate(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      const [storedAccess, storedRefresh] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.accessToken),
        AsyncStorage.getItem(STORAGE_KEYS.refreshToken),
      ]);
      // A concurrent set()/clear() that already ran wins — never clobber newer state.
      if (accessToken === null) accessToken = storedAccess ?? null;
      if (refreshToken === null) refreshToken = storedRefresh ?? null;
    })();
  }
  return hydration;
}

// Start reading immediately, so the promise is usually already settled by first use.
void hydrate();

export const tokenStore = {
  /**
   * Async on purpose — `configureSharedService` accepts a promise, and awaiting hydration here is
   * what guarantees a boot-window request still carries its token.
   */
  getAccess: async (): Promise<string | null> => {
    await hydrate();
    return accessToken;
  },
  getRefresh: async (): Promise<string | null> => {
    await hydrate();
    return refreshToken;
  },

  /** Synchronous peek, for callers that already know hydration has finished (e.g. the socket). */
  peekAccess: (): string | null => accessToken,
  peekRefresh: (): string | null => refreshToken,

  /** Resolves once the initial storage read has completed. */
  hydrated: (): Promise<void> => hydrate(),

  async set(tokens: FPAuthTokens): Promise<void> {
    hydration = Promise.resolve(); // these are newer than anything in storage
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    // AsyncStorage 3.x removed the multi* helpers — individual calls, run together.
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken),
      AsyncStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken),
    ]);
  },

  async load(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    await hydrate();
    return { accessToken, refreshToken };
  },

  async clear(): Promise<void> {
    hydration = Promise.resolve(); // a subsequent hydrate() must not resurrect what we just cleared
    accessToken = null;
    refreshToken = null;
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.accessToken),
      AsyncStorage.removeItem(STORAGE_KEYS.refreshToken),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
    ]);
  },

  /** The AuthProvider subscribes so `onUnauthenticated` drops the session and shows login. */
  onForcedLogout(listener: Listener): () => void {
    forcedLogoutListeners.add(listener);
    return () => {
      forcedLogoutListeners.delete(listener);
    };
  },

  emitForcedLogout(): void {
    forcedLogoutListeners.forEach(listener => listener());
  },
};

export default tokenStore;
