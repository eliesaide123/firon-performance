/**
 * Client · Notifications — the in-app inbox.
 *
 * `GET /notifications` → unread-tinted rows, tap to mark one read, "Mark all read", pull to
 * refresh, and the `notifications.empty` state. The bell badge on Home is kept in sync through
 * `useNotifications()`, which is also what the `notification:new` socket event feeds.
 *
 * Live updates: the resource is keyed on `QK.notifications`, the exact key `SocketProvider`
 * invalidates for `notification:new` / `notification:read`, so a notification arriving while this
 * screen is open re-fetches and lands at the top with no pull-to-refresh.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@firon/shared';
import type { AppNotification, NotificationType } from '@firon/shared';
import {
  FP_AppHeader,
  FP_Avatar,
  FP_Badge,
  FP_Card,
  FP_EmptyState,
  FP_ErrorState,
  FP_Icon,
  FP_IconButton,
  FP_ListItem,
  FP_Screen,
  FP_Skeleton,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useNotifications } from '../../store/NotificationsProvider';
import useResource from '../../store/useResource';
import { QK } from '../../store/queryCache';
import { useGuestGate } from '../../guest/GuestGateProvider';
import type { RootStackParamList } from '../../navigation/types';
import { navigateDeepLink } from '../../navigation/navigationRef';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../../theme';
import FP_SectionHeader from './components/FP_SectionHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Decorative per-type glyphs — the CMS owns the copy, these are just row icons. */
const TYPE_GLYPH: Record<NotificationType, string> = {
  plan_assigned: '📋',
  plan_updated: '📋',
  session_reminder: '⏰',
  media_approved: '✅',
  media_rejected: '⚠️',
  client_progress: '📈',
  new_client: '🙋',
  content_updated: '✏️',
  message: '💬',
  generic: '🔔',
};
const GLYPH_DOT = '•';

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useContent();
  const { isGuest } = useGuestGate();
  const { setUnread } = useNotifications();

  /* `meta.unread` is the account-wide total; the page itself only carries 30 rows. */
  const [serverUnread, setServerUnread] = useState<number | null>(null);

  const list = useResource<AppNotification[]>(
    QK.notifications,
    async () => {
      const res = await api.notifications.list({ limit: 30 });
      const meta = res.meta as { unread?: number } | undefined;
      setServerUnread(typeof meta?.unread === 'number' ? meta.unread : null);
      return res.data;
    },
    { enabled: !isGuest },
  );

  const items = list.data ?? [];
  const pageUnread = items.filter(n => !n.read).length;
  const unreadCount = serverUnread ?? pageUnread;

  /* keep the bell badge in step with the server total this screen just read */
  useEffect(() => {
    if (!isGuest && list.data) {
      setUnread(unreadCount);
    }
  }, [isGuest, list.data, unreadCount, setUnread]);

  const markRead = useCallback(
    async (notification: AppNotification) => {
      if (isGuest || notification.read) {
        return;
      }
      list.setData(prev =>
        (prev ?? []).map(n => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      const { unread } = await api.notifications.markRead(notification.id);
      setServerUnread(unread);
      setUnread(unread);
    },
    [isGuest, list, setUnread],
  );

  const markAllRead = useCallback(async () => {
    if (isGuest || unreadCount === 0) {
      return;
    }
    list.setData(prev => (prev ?? []).map(n => ({ ...n, read: true })));
    const { unread } = await api.notifications.markAllRead();
    setServerUnread(unread);
    setUnread(unread);
  }, [isGuest, unreadCount, list, setUnread]);

  /** Tap = mark read + go where the notification points (same deep-link grammar as the banner). */
  const openRow = useCallback(
    (notification: AppNotification) => {
      void markRead(notification);
      const target = notification.deepLink ?? '';
      // A notification whose deep link IS this screen has nowhere else to go.
      if (target && !/notifications$/.test(target)) {
        navigateDeepLink(target);
      }
    },
    [markRead],
  );

  const unreadLabel =
    unreadCount === 0
      ? t('notifications.all_read')
      : unreadCount === 1
        ? t('notifications.unread_one')
        : t('notifications.unread_many', { n: unreadCount });

  const header = (
    <FP_AppHeader
      left={
        <FP_IconButton
          accessibilityLabel={t('common.cta_back')}
          guestAllowed
          onPress={() => navigation.goBack()}
        >
          <FP_Icon name="chevron-left" size={20} color={FP_COLORS.text} />
        </FP_IconButton>
      }
      title={t('notifications.title')}
      large
    />
  );

  return (
    <FP_Screen onRefresh={isGuest ? undefined : list.refresh} refreshing={list.loading}>
      {header}

      <FP_SectionHeader
        small
        title={unreadLabel}
        actionLabel={unreadCount > 0 ? t('notifications.mark_all') : undefined}
        onPressAction={unreadCount > 0 ? () => void markAllRead() : undefined}
        style={styles.gapTop}
      />

      {!isGuest && list.initialLoading ? (
        <View style={styles.block}>
          <FP_Skeleton height={64} />
          <FP_Skeleton height={64} style={styles.gapTop} />
          <FP_Skeleton height={64} style={styles.gapTop} />
        </View>
      ) : !isGuest && list.error && items.length === 0 ? (
        <FP_ErrorState
          title={t('common.error_generic')}
          message={list.error.message}
          retryLabel={t('common.retry')}
          onRetry={list.refresh}
          style={styles.block}
        />
      ) : items.length === 0 ? (
        <FP_EmptyState
          title={t('notifications.empty')}
          icon={<FP_Icon name="bell" size={28} color={FP_COLORS.muted} />}
          style={styles.block}
        />
      ) : (
        <FP_Card style={styles.block}>
          {items.map((n, i) => (
            <FP_ListItem
              key={n.id}
              last={i === items.length - 1}
              style={n.read ? undefined : styles.unread}
              left={<FP_Avatar glyph={n.icon || TYPE_GLYPH[n.type] || TYPE_GLYPH.generic} size={38} />}
              title={n.title}
              subtitle={n.body}
              titleAdornment={
                n.read ? undefined : <FP_Badge label={GLYPH_DOT} tone="ok" style={styles.dot} />
              }
              right={<Text style={FP_TYPE.tiny}>{formatWhen(n.createdAt)}</Text>}
              onPress={() => openRow(n)}
            />
          ))}
        </FP_Card>
      )}
    </FP_Screen>
  );
};

/** Short relative-ish stamp: today shows the clock, anything older shows the date. */
function formatWhen(iso: string): string {
  const at = new Date(iso);
  const sameDay = at.toDateString() === new Date().toDateString();
  return sameDay
    ? at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString();
}

const styles = StyleSheet.create({
  gapTop: { marginTop: FP_SPACING.sm },
  block: { marginTop: FP_SPACING.lg },
  unread: { backgroundColor: FP_COLORS.accentSoft },
  dot: { paddingHorizontal: 5, paddingVertical: 0 },
});

export default NotificationsScreen;
