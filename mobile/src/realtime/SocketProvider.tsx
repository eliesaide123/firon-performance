/**
 * Owns the single Socket.IO connection and wires every client-facing event in
 * CONTRACT §6 to the query cache / toast / notification badge.
 *
 * App-state aware: disconnect on background, reconnect on foreground.
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
import { AppState, AppStateStatus } from 'react-native';
import tokenStore from '../auth/tokenStore';
import { useAuth } from '../auth/AuthProvider';
import { useContent } from '../cms/ContentProvider';
import log from '../log';
import queryCache, { QK } from '../store/queryCache';
import { useNotificationsBadge } from '../store/NotificationsProvider';
import { useToast } from '../components/FP_ToastProvider';
import type { AppNotification, MediaStatus } from '@firon/shared';
import socketManager, { SocketHandler } from './socket';

interface SocketContextValue {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
}

const SocketContext = createContext<SocketContextValue>({
  connected: false,
  emit: () => undefined,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signedIn, role, user } = useAuth();
  const { toast } = useToast();
  const { setUnread, refreshUnread, showBanner } = useNotificationsBadge();
  const { t } = useContent();
  const [connected, setConnected] = useState(false);

  /* Handlers read the latest callbacks through a ref so subscriptions are set up once. */
  const cb = useRef({ toast, setUnread, refreshUnread, showBanner, t });
  cb.current = { toast, setUnread, refreshUnread, showBanner, t };

  /* ---- connect / disconnect with the session ---- */
  useEffect(() => {
    if (!signedIn) {
      socketManager.teardown();
      setConnected(false);
      return;
    }
    const token = tokenStore.peekAccess();
    if (token) {
      socketManager.connect(token);
    }
    return () => {
      /* keep the connection across re-renders; only a sign-out tears it down */
    };
  }, [signedIn, user?.id]);

  useEffect(() => socketManager.onStatus(setConnected), []);

  /* ---- background / foreground ---- */
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        if (signedIn) {
          const token = tokenStore.peekAccess();
          if (token) {
            socketManager.connect(token);
          }
          socketManager.resume();
        }
      } else if (state === 'background' || state === 'inactive') {
        socketManager.pause();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [signedIn]);

  /* ---- event wiring (CONTRACT §6) ---- */
  useEffect(() => {
    if (!signedIn) {
      return;
    }
    const offs: (() => void)[] = [];
    const on = (event: string, handler: SocketHandler) => offs.push(socketManager.on(event, handler));

    on('connected', payload => log.info('socket ready', payload));

    /* ---- plans ---- */
    on('plan:assigned', payload => {
      const evt = payload as { kind?: 'training' | 'diet' };
      queryCache.invalidate(QK.trainingPlan, QK.dietPlan, QK.nutritionToday);
      cb.current.toast(
        evt?.kind === 'diet'
          ? cb.current.t('pt.builder.toast_diet_assigned', { first: '' }).trim()
          : cb.current.t('pt.builder.toast_train_assigned', { first: '' }).trim(),
      );
    });

    on('plan:updated', payload => {
      const evt = payload as { kind?: 'training' | 'diet'; plan?: { clientId?: string } };
      queryCache.invalidate(QK.trainingPlan, QK.dietPlan, QK.nutritionToday);
      if (evt?.plan?.clientId) {
        queryCache.invalidate(
          QK.clientDetail(evt.plan.clientId),
          QK.trainingFor(evt.plan.clientId),
          QK.dietFor(evt.plan.clientId),
        );
      }
      queryCache.invalidate(QK.roster);
    });

    /* ---- library ---- */
    const refreshLibrary = () => {
      queryCache.invalidatePrefix('videos:');
      queryCache.invalidate(QK.suggested, QK.continueWatching, QK.categories);
    };
    on('video:created', refreshLibrary);
    on('video:updated', refreshLibrary);
    on('video:deleted', refreshLibrary);
    on('category:changed', refreshLibrary);

    /* ---- uploads ---- */
    on('media:status', payload => {
      const evt = payload as { status?: MediaStatus; title?: string; reason?: string };
      queryCache.invalidate(QK.myUploads);
      if (evt?.title && evt.status) {
        const label =
          evt.status === 'approved'
            ? cb.current.t('pt.uploads.badge_approved')
            : evt.status === 'rejected'
            ? cb.current.t('pt.uploads.badge_rejected')
            : cb.current.t('pt.uploads.badge_pending');
        cb.current.toast(`${evt.title} · ${label}`);
      }
    });

    /* ---- notifications ---- */
    on('notification:new', payload => {
      const evt = payload as { notification?: AppNotification };
      queryCache.invalidate(QK.notifications);
      void cb.current.refreshUnread();
      if (evt?.notification) {
        cb.current.showBanner(evt.notification);
      }
    });
    on('notification:count', payload => {
      const evt = payload as { unread?: number };
      if (typeof evt?.unread === 'number') {
        cb.current.setUnread(evt.unread);
      }
    });
    on('notification:read', payload => {
      const evt = payload as { unread?: number };
      queryCache.invalidate(QK.notifications);
      if (typeof evt?.unread === 'number') {
        cb.current.setUnread(evt.unread);
      }
    });

    /* ---- trainer roster ---- */
    const refreshRoster = () => {
      queryCache.invalidate(QK.roster, QK.clientStats);
    };
    on('plan:progress', payload => {
      const evt = payload as { clientId?: string };
      refreshRoster();
      if (evt?.clientId) {
        queryCache.invalidate(QK.clientDetail(evt.clientId));
      }
    });
    on('session:completed', payload => {
      const evt = payload as { clientName?: string; title?: string };
      refreshRoster();
      if (evt?.clientName && role === 'trainer') {
        cb.current.toast(`${evt.clientName} · ${evt.title ?? ''}`.trim());
      }
    });
    on('client:log', payload => {
      const evt = payload as { clientId?: string };
      refreshRoster();
      if (evt?.clientId) {
        queryCache.invalidate(QK.clientDetail(evt.clientId));
      }
    });
    on('roster:updated', refreshRoster);
    on('presence:update', refreshRoster);

    return () => offs.forEach(off => off());
  }, [signedIn, role]);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketManager.emit(event, payload);
  }, []);

  const value = useMemo<SocketContextValue>(() => ({ connected, emit }), [connected, emit]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

/** Subscribe to a single socket event for the lifetime of a component. */
export function useSocketEvent(event: string, handler: SocketHandler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => socketManager.on(event, payload => ref.current(payload)), [event]);
}

export default SocketProvider;
