/**
 * Every user-visible label, image and video in this app comes from the CMS.
 *
 * - fetches GET /api/content?format=map&platform=mobile&locale=en on boot
 * - caches the map in AsyncStorage so a cold/offline launch still reads right
 * - patches the in-memory map on `content:updated` / `content:bulk-updated` /
 *   `content:deleted` so edits land live, with no app restart (CONTRACT §6)
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
import { api, resolveMediaUrl } from '@firon/shared';
import type {
  ContentBulkUpdatedPayload,
  ContentDeletedPayload,
  ContentMap,
  ContentUpdatedPayload,
} from '@firon/shared';
import { LOCALE, PLATFORM, STORAGE_KEYS } from '../config';
import log from '../log';
import socketManager from '../realtime/socket';
import defaultContent from './defaults';

export type TVars = Record<string, string | number>;

interface ContentContextValue {
  /** Resolve a copy key, interpolating {vars}. Falls back to the compiled defaults. */
  t: (key: string, vars?: TVars) => string;
  /** Absolute URL for an image/video key, or null. */
  media: (key: string) => string | null;
  /** Raw map, mostly for debugging. */
  map: ContentMap;
  ready: boolean;
  /** true when we are serving the AsyncStorage/compiled copy because the fetch failed. */
  offline: boolean;
  refresh: () => Promise<void>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

/** Replace every {token} that has a matching var. Unknown tokens are dropped. */
export function interpolate(template: string, vars?: TVars): string {
  if (!template.includes('{')) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = vars?.[name];
    return value === undefined || value === null ? '' : String(value);
  });
}

function entryToString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [map, setMap] = useState<ContentMap>({});
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = useCallback(async (next: ContentMap) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.content, JSON.stringify(next));
    } catch (err) {
      log.warn('could not cache content', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      // `GET /api/content` is public (CONTRACT §13) — this must work with no session, and
      // the fallback below is the error UI, so the shared popup stays out of the way.
      const fresh = await api.content.map(
        { platform: PLATFORM, locale: LOCALE },
        { showAlert: false },
      );
      if (!mounted.current) {
        return;
      }
      if (fresh && typeof fresh === 'object' && Object.keys(fresh).length > 0) {
        setMap(fresh);
        setOffline(false);
        void persist(fresh);
      }
    } catch (err) {
      log.warn('content fetch failed, using cached/compiled defaults', err);
      if (mounted.current) {
        setOffline(true);
      }
    } finally {
      if (mounted.current) {
        setReady(true);
      }
    }
  }, [persist]);

  /* boot: cached copy first (instant, offline-safe), then the network */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.content);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached) as ContentMap;
          setMap(parsed);
          setReady(true);
        }
      } catch (err) {
        log.warn('could not read cached content', err);
      }
      if (!cancelled) {
        await refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /* live patches straight off the socket */
  useEffect(() => {
    const applyOne = (evt: ContentUpdatedPayload) => {
      if (!evt?.key) {
        return;
      }
      if (evt.locale && evt.locale !== LOCALE) {
        return;
      }
      setMap(prev => {
        const next: ContentMap = {
          ...prev,
          [evt.key]: { type: evt.type, value: evt.value, url: evt.url ?? null },
        };
        void persist(next);
        return next;
      });
    };

    const offUpdated = socketManager.on('content:updated', payload => {
      log.info('content:updated', (payload as ContentUpdatedPayload)?.key);
      applyOne(payload as ContentUpdatedPayload);
    });

    const offBulk = socketManager.on('content:bulk-updated', payload => {
      const evt = payload as ContentBulkUpdatedPayload;
      if (!evt?.items?.length) {
        return;
      }
      log.info('content:bulk-updated', evt.count ?? evt.items.length);
      setMap(prev => {
        const next: ContentMap = { ...prev };
        evt.items.forEach(item => {
          if (!item?.key || (item.locale && item.locale !== LOCALE)) {
            return;
          }
          next[item.key] = { type: item.type, value: item.value, url: item.url ?? null };
        });
        void persist(next);
        return next;
      });
    });

    const offDeleted = socketManager.on('content:deleted', payload => {
      const evt = payload as ContentDeletedPayload;
      if (!evt?.key || (evt.locale && evt.locale !== LOCALE)) {
        return;
      }
      log.info('content:deleted', evt.key);
      setMap(prev => {
        const next = { ...prev };
        delete next[evt.key];
        void persist(next);
        return next;
      });
    });

    /* announce our interest once connected (and on every reconnect) */
    const offStatus = socketManager.onStatus(connected => {
      if (connected) {
        socketManager.emit('content:subscribe', { locale: LOCALE, platform: 'mobile' });
      }
    });

    return () => {
      offUpdated();
      offBulk();
      offDeleted();
      offStatus();
    };
  }, [persist]);

  const t = useCallback(
    (key: string, vars?: TVars): string => {
      const fromCms = entryToString(map[key]?.value);
      const template = fromCms ?? defaultContent[key] ?? key;
      return interpolate(template, vars);
    },
    [map],
  );

  const media = useCallback(
    (key: string): string | null => {
      const entry = map[key];
      if (!entry) {
        return null;
      }
      const raw = entry.url ?? entryToString(entry.value);
      if (!raw) {
        return null;
      }
      return resolveMediaUrl(raw);
    },
    [map],
  );

  const value = useMemo<ContentContextValue>(
    () => ({ t, media, map, ready, offline, refresh }),
    [t, media, map, ready, offline, refresh],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error('useContent must be used inside <ContentProvider>');
  }
  return ctx;
}

/** Convenience: just the translator. */
export function useT(): (key: string, vars?: TVars) => string {
  return useContent().t;
}
