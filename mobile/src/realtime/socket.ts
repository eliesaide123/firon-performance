/**
 * Socket.IO singleton (CONTRACT §6).
 *
 * One connection for the whole app, authenticated with the access token.
 * Handlers are registered against this manager (not the raw socket) so they
 * survive reconnects and provider re-renders.
 */
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import log from '../log';

export type SocketHandler = (payload: unknown) => void;
type StatusListener = (connected: boolean) => void;

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 15000;

class SocketManager {
  private socket: Socket | null = null;
  private token: string | null = null;
  private handlers = new Map<string, Set<SocketHandler>>();
  private statusListeners = new Set<StatusListener>();
  private wantConnected = false;

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Register (or replace) the token and open the connection. */
  connect(token: string): void {
    this.wantConnected = true;
    if (this.socket && this.token === token) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }
    this.teardown();
    this.token = token;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: RECONNECT_BASE_MS,
      reconnectionDelayMax: RECONNECT_MAX_MS,
      randomizationFactor: 0.5,
      timeout: 15000,
    });

    socket.on('connect', () => {
      log.info('socket connected', socket.id);
      this.notifyStatus(true);
    });
    socket.on('disconnect', reason => {
      log.info('socket disconnected:', reason);
      this.notifyStatus(false);
    });
    socket.on('connect_error', err => {
      log.warn('socket connect_error:', err.message);
      this.notifyStatus(false);
    });

    // Re-attach every registered handler to the new socket.
    this.handlers.forEach((set, event) => {
      set.forEach(h => socket.on(event, h));
    });

    this.socket = socket;
  }

  /** Close but keep handlers, so a later connect() re-attaches them. */
  pause(): void {
    this.wantConnected = false;
    this.socket?.disconnect();
    this.notifyStatus(false);
  }

  resume(): void {
    if (this.token) {
      this.wantConnected = true;
      this.socket?.connect();
    }
  }

  get shouldBeConnected(): boolean {
    return this.wantConnected;
  }

  /** Full teardown — used on logout. */
  teardown(): void {
    this.wantConnected = false;
    if (this.socket) {
      this.handlers.forEach((set, event) => set.forEach(h => this.socket?.off(event, h)));
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.notifyStatus(false);
  }

  on(event: string, handler: SocketHandler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    this.socket?.on(event, handler);
    return () => {
      set?.delete(handler);
      this.socket?.off(event, handler);
    };
  }

  emit(event: string, payload?: unknown): void {
    this.socket?.emit(event, payload);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(connected: boolean): void {
    this.statusListeners.forEach(l => l(connected));
  }
}

export const socketManager = new SocketManager();
export default socketManager;
