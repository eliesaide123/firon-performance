import { useCallback, useEffect, useRef, useState } from 'react';
import { FPError, isFPError } from '@firon/shared';
import queryCache from './queryCache';

/**
 * `clientProxy` already throws `FPError`, so this only has to wrap the rare non-API
 * rejection (a bug inside a fetcher) so `error` is always the one shape the UI knows.
 */
function asFPError(err: unknown): FPError {
  if (isFPError(err)) {
    return err;
  }
  return new FPError({
    code: 'UNKNOWN',
    message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
    status: 0,
  });
}

export interface Resource<T> {
  data: T | undefined;
  loading: boolean;
  /** true only for the very first load, so lists can show skeletons once. */
  initialLoading: boolean;
  error: FPError | null;
  refresh: () => Promise<void>;
  /** Optimistic local write; also seeds the cache. */
  setData: (next: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Fetch-on-mount + cache + re-fetch when the key is invalidated.
 * `enabled:false` keeps the hook inert (e.g. before a client is selected).
 */
export function useResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean } = {},
): Resource<T> {
  const enabled = options.enabled !== false;
  const [data, setDataState] = useState<T | undefined>(() => queryCache.get<T>(key));
  const [loading, setLoading] = useState(enabled && queryCache.get<T>(key) === undefined);
  const [didLoadOnce, setDidLoadOnce] = useState(queryCache.get<T>(key) !== undefined);
  const [error, setError] = useState<FPError | null>(null);
  const fetcherRef = useRef(fetcher);
  const mounted = useRef(true);

  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    try {
      const next = await fetcherRef.current();
      if (!mounted.current) {
        return;
      }
      queryCache.set(key, next);
      setDataState(next);
      setError(null);
    } catch (err) {
      if (mounted.current) {
        setError(asFPError(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setDidLoadOnce(true);
      }
    }
  }, [enabled, key]);

  /* initial load + reload when the cache entry is dropped */
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const cached = queryCache.get<T>(key);
    if (cached !== undefined) {
      setDataState(cached);
      setDidLoadOnce(true);
    } else {
      void load();
    }
    return queryCache.subscribe(key, () => {
      const now = queryCache.get<T>(key);
      if (now === undefined) {
        void load();
      } else {
        setDataState(now);
      }
    });
  }, [enabled, key, load]);

  const setData = useCallback(
    (next: T | ((prev: T | undefined) => T)) => {
      setDataState(prev => {
        const resolved =
          typeof next === 'function' ? (next as (p: T | undefined) => T)(prev) : next;
        queryCache.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return {
    data,
    loading,
    initialLoading: loading && !didLoadOnce,
    error,
    refresh: load,
    setData,
  };
}

export default useResource;
