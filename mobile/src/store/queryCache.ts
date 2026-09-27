/**
 * Minimal query cache + invalidation bus. Enough to keep screens in sync when a
 * socket event arrives, without pulling in Redux or React Query (CONTRACT §10).
 */
type Listener = () => void;

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();

export const queryCache = {
  get<T>(key: string): T | undefined {
    return cache.get(key) as T | undefined;
  },
  set<T>(key: string, value: T): void {
    cache.set(key, value);
    listeners.get(key)?.forEach(l => l());
  },
  /** Tell every subscriber of `key` to refetch. */
  invalidate(...keys: string[]): void {
    keys.forEach(key => {
      cache.delete(key);
      listeners.get(key)?.forEach(l => l());
    });
  },
  /** Invalidate every key that starts with `prefix`. */
  invalidatePrefix(prefix: string): void {
    const hits: string[] = [];
    listeners.forEach((_set, key) => {
      if (key.startsWith(prefix)) {
        hits.push(key);
      }
    });
    cache.forEach((_v, key) => {
      if (key.startsWith(prefix) && !hits.includes(key)) {
        hits.push(key);
      }
    });
    this.invalidate(...hits);
  },
  subscribe(key: string, listener: Listener): () => void {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        listeners.delete(key);
      }
    };
  },
  clear(): void {
    cache.clear();
    listeners.forEach(set => set.forEach(l => l()));
  },
};

/** Stable cache keys, so socket handlers and screens agree. */
export const QK = {
  contentMap: 'content:map',
  trainingPlan: 'plan:training:me',
  dietPlan: 'plan:diet:me',
  nutritionToday: 'nutrition:today',
  videos: (category: string) => `videos:${category}`,
  videosAll: 'videos:',
  suggested: 'videos:suggested',
  continueWatching: 'videos:continue',
  categories: 'categories',
  exercises: (q: string) => `exercises:${q}`,
  notifications: 'notifications',
  unreadCount: 'notifications:unread',
  roster: 'clients:roster',
  clientStats: 'clients:stats',
  clientDetail: (id: string) => `clients:${id}`,
  trainingFor: (id: string) => `plan:training:${id}`,
  dietFor: (id: string) => `plan:diet:${id}`,
  myUploads: 'media:mine',
  progress: 'profile:progress',
  trainerProfile: 'trainer:profile',
} as const;

export default queryCache;
