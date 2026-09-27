/*
 * One Socket.IO connection for the whole CMS (CONTRACT §6).
 *
 * Responsibilities
 *  1. Connect with `auth: { token: accessToken }` and keep the token fresh on
 *     reconnect (a stale access token yields `connect_error: UNAUTHORIZED`,
 *     which we answer with a single refresh + retry).
 *  2. Expose the live connection status for the topbar dot (FP_StatusDot).
 *  3. Invalidate the matching React Query keys for every server event, so the
 *     UI updates without a reload (see EVENT_MAP / the README table).
 *  4. Surface a small FP_Toast per incoming event so realtime is visibly working.
 *  5. Provide `useSocketEvent(event, handler)` for page-level reactions
 *     (e.g. flashing a content row another admin just changed).
 *
 * This is the ONLY file in the CMS that imports socket.io-client.
 */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { FP_SOCKET_EVENTS, api } from '@firon/shared';
import { SOCKET_URL } from '../bootstrap.js';
import tokenStore from '../lib/tokenStore.js';
import log from '../lib/log.js';
import qk from '../lib/queryKeys.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from '../components/FP_ToastProvider';

const E = FP_SOCKET_EVENTS;

/**
 * Server event -> React Query keys to invalidate + how to describe it in a toast.
 * `keys` are key ROOTS: invalidating ['content'] refreshes every ['content', ...] query.
 */
export const EVENT_MAP = {
  [E.CONTENT_UPDATED]: { keys: [qk.content], toast: (p) => `Content updated · ${p?.key ?? ''}` },
  [E.CONTENT_BULK_UPDATED]: { keys: [qk.content], toast: (p) => `${p?.count ?? p?.items?.length ?? 0} content keys updated` },
  [E.CONTENT_DELETED]: { keys: [qk.content], toast: (p) => `Content deleted · ${p?.key ?? ''}` },

  [E.CATEGORY_CHANGED]: { keys: [qk.categories, qk.videos], toast: (p) => `Category ${p?.action ?? 'changed'} · ${p?.category?.name ?? ''}` },

  [E.VIDEO_CREATED]: { keys: [qk.videos, qk.dashboard], toast: (p) => `Video created · ${p?.video?.title ?? ''}` },
  [E.VIDEO_UPDATED]: { keys: [qk.videos, qk.dashboard], toast: (p) => `Video updated · ${p?.video?.title ?? ''}` },
  [E.VIDEO_DELETED]: { keys: [qk.videos, qk.dashboard], toast: () => 'Video deleted' },

  [E.MEDIA_PENDING]: { keys: [qk.media, qk.dashboard], toast: (p) => `New upload awaiting review · ${p?.title ?? ''}` },
  [E.MEDIA_STATUS]: { keys: [qk.media, qk.dashboard], toast: (p) => `Media ${p?.status ?? 'updated'} · ${p?.title ?? ''}` },

  [E.PLAN_ASSIGNED]: { keys: [qk.plans, qk.clients, qk.dashboard], toast: (p) => `${p?.kind === 'diet' ? 'Diet' : 'Training'} plan assigned` },
  [E.PLAN_UPDATED]: { keys: [qk.plans, qk.clients], toast: (p) => `${p?.kind === 'diet' ? 'Diet' : 'Training'} plan updated` },
  [E.PLAN_PROGRESS]: { keys: [qk.plans, qk.clients], toast: (p) => `Client progress · ${p?.adherencePct ?? 0}% adherence` },

  [E.ROSTER_UPDATED]: { keys: [qk.clients], toast: () => 'Client roster updated' },
  [E.SESSION_COMPLETED]: { keys: [qk.clients, qk.dashboard], toast: (p) => `Session completed · ${p?.clientName ?? 'client'}` },
  [E.CLIENT_LOG]: { keys: [qk.clients], toast: (p) => `Client logged a ${p?.kind ?? 'entry'}` },
  [E.PRESENCE_UPDATE]: { keys: [qk.clients], toast: null },

  [E.NOTIFICATION_NEW]: { keys: [qk.notifications], toast: (p) => p?.notification?.title ?? 'New notification' },
  [E.NOTIFICATION_COUNT]: { keys: [qk.notificationCount], toast: null },
  [E.NOTIFICATION_READ]: { keys: [qk.notifications], toast: null },

  [E.DASHBOARD_TICK]: { keys: [qk.dashboard], toast: null },
};

const SocketCtx = createContext(null);

export function FP_SocketProvider({ children }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [status, setStatus] = useState('idle'); // idle | connecting | connected | disconnected | error
  const [socketId, setSocketId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  const socketRef = useRef(null);
  const handlersRef = useRef(new Map()); // event -> Set<handler>
  const refreshedOnceRef = useRef(false);

  /** Page-level subscription, used through the useSocketEvent hook below. */
  const subscribe = useCallback((event, handler) => {
    const map = handlersRef.current;
    if (!map.has(event)) map.set(event, new Set());
    map.get(event).add(handler);
    return () => {
      map.get(event)?.delete(handler);
      if (map.get(event)?.size === 0) map.delete(event);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setStatus('idle');
      return undefined;
    }

    setStatus('connecting');
    const socket = io(SOCKET_URL, {
      auth: { token: tokenStore.accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 6000,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      refreshedOnceRef.current = false;
      setStatus('connected');
      setSocketId(socket.id);
      log.info('socket connected', socket.id);
    });

    socket.on(E.CONNECTED, (payload) => {
      setRooms(payload?.rooms ?? []);
      log.info('socket rooms', payload?.rooms);
    });

    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      log.warn('socket disconnected:', reason);
    });

    socket.io.on('reconnect_attempt', () => {
      // Always present the freshest token to the handshake.
      socket.auth = { token: tokenStore.accessToken };
      setStatus('connecting');
    });

    socket.on('connect_error', async (err) => {
      setStatus('error');
      const message = err?.message ?? 'connect_error';
      log.warn('socket connect_error:', message);
      if (/unauthor/i.test(message) && !refreshedOnceRef.current && tokenStore.refreshToken) {
        refreshedOnceRef.current = true;
        try {
          const tokens = await api.auth.refresh({ refreshToken: tokenStore.refreshToken });
          tokenStore.setTokens(tokens);
          socket.auth = { token: tokens.accessToken };
          socket.connect();
        } catch (refreshErr) {
          log.error('socket token refresh failed', refreshErr?.message);
        }
      }
    });

    /* One catch-all listener: invalidate queries, toast, fan out to subscribers. */
    socket.onAny((event, payload) => {
      if (event === E.CONNECTED) return;
      const entry = EVENT_MAP[event];
      setLastEvent({ event, payload, at: Date.now() });

      if (entry?.keys?.length) {
        entry.keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      } else if (!entry) {
        log.debug('unmapped socket event', event, payload);
      }

      if (entry?.toast) {
        const text = entry.toast(payload);
        if (text) toast.event(text, { sub: event });
      }

      handlersRef.current.get(event)?.forEach((fn) => {
        try { fn(payload, event); } catch (e) { log.error('socket handler threw for', event, e); }
      });
    });

    return () => {
      socket.offAny();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, queryClient, toast]);

  const emit = useCallback((event, payload, ack) => {
    if (!socketRef.current?.connected) {
      log.warn('emit while disconnected:', event);
      return false;
    }
    socketRef.current.emit(event, payload, ack);
    return true;
  }, []);

  const value = useMemo(() => ({
    status,
    connected: status === 'connected',
    socketId,
    rooms,
    lastEvent,
    subscribe,
    emit,
  }), [status, socketId, rooms, lastEvent, subscribe, emit]);

  return <SocketCtx.Provider value={value}>{children}</SocketCtx.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketCtx);
  if (!ctx) throw new Error('useSocket must be used inside <FP_SocketProvider>');
  return ctx;
}

/** Run `handler` whenever `event` arrives from the server. */
export function useSocketEvent(event, handler) {
  const { subscribe } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!event) return undefined;
    return subscribe(event, (...args) => ref.current?.(...args));
  }, [event, subscribe]);
}

export default FP_SocketProvider;
