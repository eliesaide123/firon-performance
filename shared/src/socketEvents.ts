/**
 * Firon Performance — Socket.IO event names and payload types (docs/CONTRACT.md §6).
 * Shared so the CMS and the mobile app cannot drift from the server, and so neither one
 * hand-types an event string.
 */

import type {
  AppNotification,
  Category,
  ContentType,
  DietPlan,
  MediaStatus,
  DashboardStats,
  TrainingPlan,
  Video,
} from './types';

export const FP_SOCKET_EVENTS = {
  /* connection */
  CONNECTED: 'connected',
  /* CMS content */
  CONTENT_UPDATED: 'content:updated',
  CONTENT_BULK_UPDATED: 'content:bulk-updated',
  CONTENT_DELETED: 'content:deleted',
  /* catalogue */
  CATEGORY_CHANGED: 'category:changed',
  VIDEO_CREATED: 'video:created',
  VIDEO_UPDATED: 'video:updated',
  VIDEO_DELETED: 'video:deleted',
  /* media moderation */
  MEDIA_STATUS: 'media:status',
  MEDIA_PENDING: 'media:pending',
  /* plans */
  PLAN_ASSIGNED: 'plan:assigned',
  PLAN_UPDATED: 'plan:updated',
  PLAN_PROGRESS: 'plan:progress',
  SESSION_COMPLETED: 'session:completed',
  CLIENT_LOG: 'client:log',
  ROSTER_UPDATED: 'roster:updated',
  /* notifications */
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_COUNT: 'notification:count',
  NOTIFICATION_READ: 'notification:read',
  /* presence + dashboard */
  PRESENCE_UPDATE: 'presence:update',
  DASHBOARD_TICK: 'dashboard:tick',
} as const;

/** Events the client sends to the server. */
export const FP_SOCKET_EMITS = {
  CONTENT_SUBSCRIBE: 'content:subscribe',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_READ_ALL: 'notification:read-all',
  PROGRESS_VIDEO: 'progress:video',
  PING_PRESENCE: 'ping:presence',
} as const;

export interface ConnectedPayload {
  userId: string;
  role: string;
  rooms: string[];
}

export interface ContentUpdatedPayload {
  key: string;
  type: ContentType;
  value: unknown;
  url?: string | null;
  locale: string;
  platform: string;
}

export interface ContentBulkUpdatedPayload {
  items: ContentUpdatedPayload[];
  count: number;
}

export interface ContentDeletedPayload {
  key: string;
  locale: string;
}

export interface CategoryChangedPayload {
  action: 'created' | 'updated' | 'deleted';
  category: Category;
}

export interface MediaStatusPayload {
  id: string;
  status: MediaStatus;
  title: string;
  reason?: string;
}

export interface MediaPendingPayload {
  id: string;
  title: string;
  uploadedBy: string;
}

export interface PlanAssignedPayload {
  kind: 'training' | 'diet';
  plan: TrainingPlan | DietPlan;
}

export interface PlanProgressPayload {
  clientId: string;
  planId: string;
  dayIndex: number;
  doneCount: number;
  total: number;
  adherencePct: number;
}

export interface SessionCompletedPayload {
  clientId: string;
  clientName: string;
  title: string;
  durationMin: number;
}

export interface ClientLogPayload {
  clientId: string;
  kind: 'exercise' | 'meal';
  payload: Record<string, unknown>;
}

export interface NotificationNewPayload {
  notification: AppNotification;
}

export interface NotificationCountPayload {
  unread: number;
}

export interface PresenceUpdatePayload {
  userId: string;
  online: boolean;
}

export interface DashboardTickPayload {
  stats: DashboardStats;
}

/** Maps every server→client event to its payload, for a typed `useSocketEvent`. */
export interface FPServerEvents {
  'connected': ConnectedPayload;
  'content:updated': ContentUpdatedPayload;
  'content:bulk-updated': ContentBulkUpdatedPayload;
  'content:deleted': ContentDeletedPayload;
  'category:changed': CategoryChangedPayload;
  'video:created': { video: Video };
  'video:updated': { video: Video };
  'video:deleted': { id: string };
  'media:status': MediaStatusPayload;
  'media:pending': MediaPendingPayload;
  'plan:assigned': PlanAssignedPayload;
  'plan:updated': PlanAssignedPayload;
  'plan:progress': PlanProgressPayload;
  'session:completed': SessionCompletedPayload;
  'client:log': ClientLogPayload;
  'roster:updated': { trainerId: string };
  'notification:new': NotificationNewPayload;
  'notification:count': NotificationCountPayload;
  'notification:read': { id: string; unread: number };
  'presence:update': PresenceUpdatePayload;
  'dashboard:tick': DashboardTickPayload;
}

export type FPServerEventName = keyof FPServerEvents;
