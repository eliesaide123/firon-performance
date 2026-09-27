/*
 * Notifications — the admin side of CONTRACT §6/§7.
 *
 *  1. The admin's own inbox (GET /api/notifications), which every `notify()` call reaches:
 *     content published, media awaiting review, and anything aimed at this account.
 *  2. A "send a test notification" form (POST /api/notifications/test) that picks a target user
 *     and reports exactly what happened — how many of that user's sockets were live, whether FCM
 *     is configured, and the `deepLink` the mobile app will navigate to on a tap.
 *
 * Live without a reload: `notification:new` / `notification:count` / `notification:read` all
 * invalidate the ['notifications'] key root in SocketContext.EVENT_MAP, which covers this page's
 * list and count queries as well as the topbar bell. `useSocketEvent` is used on top of that only
 * to flash the row that just arrived.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, CheckCheck, Radio, Send, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { FP_SOCKET_EVENTS, api } from '@firon/shared';
import { fmtAgo } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket, useSocketEvent } from '../context/SocketContext.jsx';
import {
  FP_Badge, FP_Button, FP_Card, FP_CardHead, FP_EmptyState, FP_ErrorState, FP_IconButton,
  FP_KeyValueRow, FP_Screen, FP_Segmented, FP_Select, FP_StatCard, FP_Table, FP_Textarea,
  FP_Textbox, useToast,
} from '../components/index.ts';

/**
 * Notification.type enum — mirrors `NotificationType` in @firon/shared/types.ts and the
 * Notification model's TYPES. (A runtime `FP_NOTIFICATION_TYPES` in @firon/shared would remove
 * this copy; reported upstream.)
 */
const TYPES = [
  'generic', 'message', 'plan_assigned', 'plan_updated', 'session_reminder',
  'media_approved', 'media_rejected', 'client_progress', 'new_client', 'content_updated',
];

const TYPE_TONE = {
  media_rejected: 'danger',
  media_approved: 'ok',
  new_client: 'ok',
  plan_assigned: 'pt',
  plan_updated: 'pt',
  client_progress: 'warn',
};

/**
 * Deep links the mobile app can actually navigate (the grammar in
 * mobile/src/navigation/navigationRef.ts). Anything else is ignored by the app on tap.
 */
const DEEP_LINKS = [
  { value: 'firon://notifications', label: 'Notifications (inbox)' },
  { value: 'firon://home', label: 'Home' },
  { value: 'firon://train', label: 'Train — training plan' },
  { value: 'firon://nutrition', label: 'Nutrition — diet plan' },
  { value: 'firon://videos', label: 'Video library' },
  { value: 'firon://profile', label: 'Profile' },
  { value: 'firon://clients', label: 'PT · clients (trainers)' },
  { value: 'firon://plans', label: 'PT · plans (trainers)' },
  { value: 'firon://uploads', label: 'PT · uploads (trainers)' },
];

const EMPTY_FORM = {
  userId: '',
  title: 'Test notification',
  body: 'If you can read this, sockets and push are wired up.',
  type: 'generic',
  deepLink: 'firon://notifications',
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { connected } = useSocket();

  const [filter, setFilter] = useState('');          // '' | 'unread'
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState(null);
  const [flashed, setFlashed] = useState({});

  const params = { page, limit: 25, unread: filter === 'unread' ? true : undefined };

  const listQuery = useQuery({
    queryKey: qk.notificationList(params),
    queryFn: () => api.notifications.list(params),
  });

  const countQuery = useQuery({
    queryKey: qk.notificationCount,
    queryFn: () => api.notifications.unreadCount(),
  });

  /* Target picker — everyone, so an admin can aim at a client, a trainer or themselves. */
  const usersQuery = useQuery({
    queryKey: qk.userList({ limit: 200, forTest: true }),
    queryFn: () => api.users.list({ limit: 200 }),
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? null;
  const unread = Number(countQuery.data?.unread ?? meta?.unread ?? 0);

  const userOptions = useMemo(() => {
    const all = usersQuery.data?.data ?? [];
    return [
      ...(user ? [{ value: user.id, label: `${user.name} (me · admin)` }] : []),
      ...all
        .filter((u) => u.id !== user?.id)
        .map((u) => ({ value: u.id, label: `${u.name} · ${u.role} · ${u.email}` })),
    ];
  }, [usersQuery.data, user]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.notifications });
  }, [queryClient]);

  /* --------------------------- live arrivals ---------------------------- */
  const flash = useCallback((id) => {
    if (!id) return;
    setFlashed((f) => ({ ...f, [id]: true }));
    setTimeout(() => setFlashed((f) => { const next = { ...f }; delete next[id]; return next; }), 2400);
  }, []);

  useSocketEvent(FP_SOCKET_EVENTS.NOTIFICATION_NEW, (payload) => {
    flash(payload?.notification?.id);
  });

  /* ------------------------------ mutations ------------------------------ */
  const sendTest = useMutation({
    mutationFn: (body) => api.notifications.sendTest(body, { showAlert: true }),
    onSuccess: (res) => {
      setResult(res);
      const reached = Number(res?.socketsReached ?? 0);
      toast.success(
        reached > 0
          ? `Delivered to ${reached} live socket${reached === 1 ? '' : 's'}`
          : 'Saved — no live socket, it will arrive via push / on next open',
        { sub: res?.target?.name },
      );
      invalidate();
    },
  });

  const markRead = useMutation({
    mutationFn: (row) => api.notifications.markRead(row.id),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.notifications.markAllRead({ successMessage: 'All notifications marked read' }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (row) => api.notifications.remove(row.id, { successMessage: 'Notification deleted' }),
    onSuccess: invalidate,
  });

  const submit = () => {
    sendTest.mutate({
      userId: form.userId || user?.id,
      title: form.title.trim() || 'Test notification',
      body: form.body.trim(),
      type: form.type,
      // `deepLink` rides inside `data` — notificationService.notify() reads data.deepLink,
      // and the /test validator only accepts the fields below.
      data: { test: true, deepLink: form.deepLink },
    });
  };

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));

  /* ------------------------------- columns ------------------------------- */
  const columns = [
    {
      key: 'title',
      header: 'Notification',
      sortValue: (r) => r.title,
      render: (r) => (
        <div className="col" style={{ gap: 2 }}>
          <span className={r.read ? 'truncate' : 'truncate strong'}>{r.title}</span>
          <span className="muted tiny">{r.body}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: 150,
      sortValue: (r) => r.type,
      render: (r) => <FP_Badge tone={TYPE_TONE[r.type] ?? 'muted'}>{r.type}</FP_Badge>,
    },
    {
      key: 'deepLink',
      header: 'Deep link',
      width: 190,
      render: (r) => (r.deepLink
        ? <span className="muted tiny truncate" title={r.deepLink}>{r.deepLink}</span>
        : <span className="muted tiny">—</span>),
    },
    {
      key: 'read',
      header: 'State',
      width: 110,
      align: 'center',
      sortValue: (r) => (r.read ? 1 : 0),
      render: (r) => (r.read
        ? <FP_Badge tone="muted">read</FP_Badge>
        : <FP_Badge tone="ok">unread</FP_Badge>),
    },
    {
      key: 'createdAt',
      header: 'When',
      width: 130,
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="muted tiny">{fmtAgo(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 92,
      align: 'right',
      render: (r) => (
        <div className="row row--end">
          {r.read ? null : (
            <FP_IconButton
              icon={CheckCheck}
              label="Mark read"
              onPress={() => markRead.mutate(r)}
            />
          )}
          <FP_IconButton icon={Trash2} label="Delete" onPress={() => remove.mutate(r)} />
        </div>
      ),
    },
  ];

  return (
    <FP_Screen
      title="Notifications"
      subtitle={connected
        ? 'Your inbox, live over notification:new — no reload needed'
        : 'Socket offline — this list will not update until it reconnects'}
      actions={(
        <FP_Button
          variant="secondary"
          icon={CheckCheck}
          disabled={unread === 0}
          loading={markAllRead.isPending}
          onPress={() => markAllRead.mutate()}
        >
          Mark all read
        </FP_Button>
      )}
    >
      <div className="grid grid--stats">
        <FP_StatCard label="Unread" value={unread} icon={BellRing} tone={unread ? 'warn' : undefined} />
        <FP_StatCard label="In your inbox" value={meta?.total ?? rows.length} icon={Bell} />
        <FP_StatCard
          label="Realtime channel"
          value={connected ? 'Live' : 'Offline'}
          icon={Radio}
          hint="notification:new · notification:count"
          tone={connected ? undefined : 'warn'}
        />
      </div>

      <div className="grid grid--2 mt4">
        <FP_Card>
          <FP_CardHead
            title="Send a test notification"
            sub="One call, both channels: a socket event to every live device plus an FCM push."
          />
          <div className="col mt3">
            <FP_Select
              label="Target user"
              value={form.userId}
              onChange={set('userId')}
              options={userOptions}
              placeholder={usersQuery.isLoading ? 'Loading users…' : 'Myself'}
            />
            <FP_Textbox label="Title" value={form.title} onChange={set('title')} maxLength={160} />
            <FP_Textarea label="Body" value={form.body} onChange={set('body')} rows={3} maxLength={500} />
            <div className="grid grid--form">
              <FP_Select
                label="Type"
                value={form.type}
                onChange={set('type')}
                options={TYPES}
              />
              <FP_Select
                label="Deep link (where a tap lands)"
                value={form.deepLink}
                onChange={set('deepLink')}
                options={DEEP_LINKS}
              />
            </div>
            <div className="row between mt2">
              <span className="muted tiny">
                The target sees it instantly if the app is open, and as a push if it is not.
              </span>
              <FP_Button icon={Send} loading={sendTest.isPending} onPress={submit}>Send</FP_Button>
            </div>
          </div>
        </FP_Card>

        <FP_Card>
          <FP_CardHead title="Last send" sub="What the server did with it" />
          {result ? (
            <div className="mt3">
              <FP_KeyValueRow label="Delivered to" value={`${result.target?.name ?? '—'} · ${result.target?.role ?? ''}`} />
              <FP_KeyValueRow label="Live sockets reached" value={String(result.socketsReached ?? 0)} />
              <FP_KeyValueRow label="Socket event" value={result.socketEmitted ? 'notification:new emitted' : 'not emitted'} />
              <FP_KeyValueRow label="FCM push" value={result.pushEnabled ? 'enabled' : 'not configured (socket only)'} />
              <FP_KeyValueRow label="Deep link" value={result.notification?.deepLink ?? '—'} />
              <FP_KeyValueRow label="Notification id" value={result.notification?.id ?? '—'} />
            </div>
          ) : (
            <FP_EmptyState
              icon={Send}
              title="Nothing sent yet"
              message="Pick a user and send one — the result lands here, and in their app instantly."
            />
          )}
        </FP_Card>
      </div>

      <div className="toolbar mt4">
        <FP_Segmented
          value={filter}
          onChange={(v) => { setFilter(v); setPage(1); }}
          options={[
            { value: '', label: 'All' },
            { value: 'unread', label: unread ? `Unread (${unread})` : 'Unread' },
          ]}
        />
      </div>

      {listQuery.isError ? (
        <FP_ErrorState
          error={listQuery.error}
          onRetry={listQuery.refetch}
          title="Could not load notifications"
        />
      ) : null}

      <FP_Card flush>
        <FP_Table
          columns={columns}
          rows={rows}
          loading={listQuery.isLoading}
          serverPaged={Boolean(meta?.pages)}
          page={meta?.page ?? page}
          pages={meta?.pages ?? 1}
          total={meta?.total ?? rows.length}
          limit={meta?.limit}
          onPageChange={setPage}
          rowClassName={(r) => (flashed[r.id] ? 'row-flash' : undefined)}
          empty={(
            <FP_EmptyState
              icon={Bell}
              title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
              message="Publish a content key, approve an upload, or send yourself a test above."
            />
          )}
        />
      </FP_Card>
    </FP_Screen>
  );
}
