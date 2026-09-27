import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@firon/shared';
import { useAuth } from '../context/AuthContext.jsx';
import useClickOutside from '../hooks/useClickOutside.js';
import { fmtAgo } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import FP_Button from './FP_Button';
import FP_IconButton from './FP_IconButton';

/**
 * Unread badge from GET /notifications/unread-count, kept current by the
 * `notification:new` / `notification:count` socket events (both invalidate the
 * notification keys in SocketContext.EVENT_MAP). The initial value comes free
 * from GET /auth/me so the badge is correct on first paint.
 */
export default function FP_NotificationsBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const { initialUnread } = useAuth();
  useClickOutside(wrapRef, () => setOpen(false), open);

  const countQuery = useQuery({
    queryKey: qk.notificationCount,
    queryFn: () => api.notifications.unreadCount(),
    initialData: { unread: initialUnread ?? 0 },
    refetchOnWindowFocus: true,
  });

  const listQuery = useQuery({
    queryKey: qk.notificationList({ preview: true }),
    queryFn: () => api.notifications.list({ limit: 8 }),
    enabled: open,
  });

  const unread = Number(countQuery.data?.unread ?? 0);
  const items = listQuery.data?.data ?? [];

  const markAllRead = async () => {
    await api.notifications.markAllRead({ successMessage: 'All notifications marked read' });
    queryClient.invalidateQueries({ queryKey: qk.notifications });
  };

  const markRead = async (id: string) => {
    await api.notifications.markRead(id);
    queryClient.invalidateQueries({ queryKey: qk.notifications });
  };

  return (
    <div className="bell" ref={wrapRef}>
      <FP_IconButton
        icon={Bell}
        label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        active={open}
        onPress={() => setOpen((o) => !o)}
      />
      {unread > 0 ? <span className="bell__count">{unread > 99 ? '99+' : unread}</span> : null}

      {open ? (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover__head">
            <span className="grow">Notifications{unread ? ` · ${unread} unread` : ''}</span>
            <FP_Button variant="ghost" size="sm" icon={CheckCheck} onPress={markAllRead}>Read all</FP_Button>
          </div>
          <div className="popover__list">
            {listQuery.isLoading ? <div className="popover__item muted">Loading…</div> : null}
            {!listQuery.isLoading && !items.length ? (
              <div className="popover__item muted">You&apos;re all caught up</div>
            ) : null}
            {items.map((n) => (
              <div
                key={n.id}
                className={`popover__item ${n.read ? '' : 'popover__item--unread'}`}
                role="button"
                tabIndex={0}
                onClick={() => !n.read && markRead(n.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !n.read) markRead(n.id); }}
              >
                <div className="grow">
                  <div className="strong">{n.title}</div>
                  <div className="muted tiny">{n.body}</div>
                  <div className="muted tiny mt2">{fmtAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="popover__foot">
            <Link to="/notifications" className="small" onClick={() => setOpen(false)}>
              Open notifications →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
