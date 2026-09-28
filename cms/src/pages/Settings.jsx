/*
 * Settings — the operational view of the platform the CMS is talking to.
 *
 *  1. Backend health (`GET /api/health`, CONTRACT §5) polled every 20s. The
 *     shared proxy calls it with `showAlert:false, retries:0`, so a dead backend
 *     surfaces as an inline error state here instead of a popup storm.
 *  2. Realtime status straight from the one SocketContext connection: state,
 *     socket id, the rooms the server joined us to (§6) and the last event seen.
 *  3. Editor defaults — which locale/platform the content editor opens on. A
 *     per-operator choice, so it lives in localStorage (src/lib/prefs.js), not Mongo.
 *  4. "Re-seed missing content defaults" -> `POST /api/content/seed-defaults`,
 *     which re-creates any missing key WITHOUT overwriting edited ones (admin only).
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Activity, Database, Globe, Radio, RefreshCw, Server, ShieldCheck, Sprout,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '@firon/shared';
import { API_URL, SOCKET_URL } from '../bootstrap.js';
import { APP_VERSION, LOCALES, PLATFORMS } from '../lib/constants.js';
import { fmtAgo, fmtUptime } from '../lib/format.js';
import prefs from '../lib/prefs.js';
import qk from '../lib/queryKeys.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import {
  FP_Badge, FP_Button, FP_Card, FP_CardHead, FP_ConfirmDialog, FP_ErrorState,
  FP_KeyValueRow, FP_Screen, FP_Segmented, FP_Select, FP_SkeletonRows,
  FP_StatCard, FP_StatusDot, useToast,
} from '../components/index.ts';

const SOCKET_LABEL = {
  connected: 'Connected — events stream live',
  connecting: 'Connecting…',
  disconnected: 'Disconnected — reconnecting',
  error: 'Handshake failed (see the console)',
  idle: 'Not connected (signed out)',
};

export default function Settings() {
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const { status, socketId, rooms, lastEvent } = useSocket();

  const [editorPrefs, setEditorPrefs] = useState(() => prefs.all);
  const [confirmSeed, setConfirmSeed] = useState(false);

  const healthQuery = useQuery({
    queryKey: qk.health,
    queryFn: () => api.health(),
    refetchInterval: 20_000,
  });
  const health = healthQuery.data ?? null;

  const savePref = (patch) => {
    const next = prefs.set(patch);
    setEditorPrefs(next);
    toast.success('Editor defaults saved', { sub: `${next.platform} · ${next.locale}` });
  };

  const seed = useMutation({
    mutationFn: () => api.content.seedDefaults(),
    onSuccess: (res) => {
      setConfirmSeed(false);
      // The endpoint answers `{ inserted, skipped, keys }`; `created` is the shared type's name.
      const added = res?.inserted ?? res?.created ?? 0;
      toast.success('Content defaults re-seeded', {
        sub: `${added} key(s) re-created · ${res?.skipped ?? 0} already present (edits kept)`,
      });
    },
    onError: () => setConfirmSeed(false),
  });

  return (
    <FP_Screen
      title="Settings"
      subtitle="Backend health, realtime status and the CMS's own defaults"
      actions={(
        <FP_Button
          variant="secondary"
          icon={RefreshCw}
          loading={healthQuery.isFetching}
          onPress={() => healthQuery.refetch()}
        >
          Check now
        </FP_Button>
      )}
    >
      <div className="grid grid--stats">
        <FP_StatCard
          label="Backend"
          value={health?.status === 'ok' ? 'Healthy' : (healthQuery.isError ? 'Unreachable' : (health?.status ?? '—'))}
          icon={Server}
          tone={health?.status === 'ok' ? 'accent' : 'danger'}
          hint={health ? `up ${fmtUptime(health.uptime)}` : undefined}
        />
        <FP_StatCard
          label="Database"
          value={health?.db ?? (healthQuery.isError ? 'unknown' : '—')}
          icon={Database}
          tone={health?.db === 'connected' ? 'accent' : 'warn'}
        />
        <FP_StatCard
          label="Realtime"
          value={status === 'connected' ? 'Live' : status}
          icon={Radio}
          tone={status === 'connected' ? 'accent' : (status === 'error' ? 'danger' : 'warn')}
          hint={rooms?.length ? `${rooms.length} rooms joined` : undefined}
        />
        <FP_StatCard
          label="App version"
          value={health?.version ?? APP_VERSION}
          icon={ShieldCheck}
          hint={`CMS build ${APP_VERSION}`}
        />
      </div>

      <div className="grid grid--2 mt4">
        <FP_Card>
          <FP_CardHead
            title="Backend"
            sub={`${API_URL} · refreshed ${healthQuery.dataUpdatedAt ? fmtAgo(healthQuery.dataUpdatedAt) : 'never'}`}
            actions={health ? <FP_Badge tone={health.status === 'ok' ? 'ok' : 'warn'}>{health.status}</FP_Badge> : null}
          />
          {healthQuery.isLoading ? <FP_SkeletonRows rows={4} height={16} /> : null}
          {healthQuery.isError ? (
            <FP_ErrorState
              error={healthQuery.error}
              onRetry={healthQuery.refetch}
              title="The API is not answering"
            />
          ) : null}
          {health ? (
            <div className="mt3">
              <FP_KeyValueRow label="Status" value={health.status} />
              <FP_KeyValueRow label="Database" value={health.db} />
              <FP_KeyValueRow label="Uptime" value={fmtUptime(health.uptime)} />
              <FP_KeyValueRow label="API version" value={health.version ?? '—'} />
              {health.env ? <FP_KeyValueRow label="Environment" value={health.env} /> : null}
              <FP_KeyValueRow label="API base URL" value={<span className="mono">{API_URL}</span>} />
            </div>
          ) : null}
        </FP_Card>

        <FP_Card>
          <FP_CardHead
            title="Realtime"
            sub={SOCKET_LABEL[status] ?? status}
            actions={<FP_StatusDot status={status} detail={socketId} />}
          />
          <div className="mt3">
            <FP_KeyValueRow label="Socket URL" value={<span className="mono">{SOCKET_URL}</span>} />
            <FP_KeyValueRow label="Socket id" value={<span className="mono">{socketId ?? '—'}</span>} />
            <FP_KeyValueRow
              label="Rooms"
              value={rooms?.length
                ? <span className="mono tiny">{rooms.join(', ')}</span>
                : <span className="muted">none yet</span>}
            />
            <FP_KeyValueRow
              label="Last event"
              value={lastEvent
                ? <span className="mono tiny">{lastEvent.event} · {fmtAgo(lastEvent.at)}</span>
                : <span className="muted">nothing yet</span>}
            />
            <FP_KeyValueRow label="Signed in as" value={`${user?.name ?? '—'} · ${user?.role ?? '—'}`} />
          </div>
        </FP_Card>

        <FP_Card>
          <FP_CardHead
            title="Editor defaults"
            sub="Which locale and platform the content editor and phone preview open on"
            actions={<Globe size={15} className="muted" />}
          />
          <div className="mt3">
            <FP_Select
              label="Default locale"
              value={editorPrefs.locale}
              onChange={(e) => savePref({ locale: e.target.value })}
              options={LOCALES}
            />
          </div>
          <div className="mt3 field">
            <div className="field__label">Default platform</div>
            <FP_Segmented
              value={editorPrefs.platform}
              onChange={(v) => savePref({ platform: v })}
              options={PLATFORMS}
              aria-label="Default platform"
            />
            <div className="field__hint">
              `mobile` is what the app reads; `cms` keys are staff-only copy; `both` is shared.
            </div>
          </div>
          <div className="mt3">
            <FP_Button
              variant="secondary"
              onPress={() => { setEditorPrefs(prefs.reset()); toast.success('Editor defaults reset'); }}
            >
              Reset to mobile · en
            </FP_Button>
          </div>
        </FP_Card>

        <FP_Card>
          <FP_CardHead
            title="Content maintenance"
            sub="Re-create any seeded key that went missing — existing edits are never overwritten"
            actions={<Sprout size={15} className="muted" />}
          />
          <div className="mt3">
            <FP_KeyValueRow label="Endpoint" value={<span className="mono">POST /content/seed-defaults</span>} />
            <FP_KeyValueRow label="Requires" value="admin" />
            <FP_KeyValueRow
              label="Effect"
              value="Adds missing keys only · emits content:updated so every device refreshes"
            />
          </div>
          <div className="mt3">
            <FP_Button
              icon={Sprout}
              loading={seed.isPending}
              disabled={!isAdmin}
              onPress={() => setConfirmSeed(true)}
            >
              Re-seed missing content defaults
            </FP_Button>
            {!isAdmin ? (
              <div className="field__hint">Only an admin may re-seed content.</div>
            ) : null}
          </div>
        </FP_Card>
      </div>

      <FP_Card className="mt4">
        <FP_CardHead title="About" sub="What this portal is wired to" actions={<Activity size={15} className="muted" />} />
        <div className="mt3">
          <FP_KeyValueRow label="CMS version" value={APP_VERSION} />
          <FP_KeyValueRow label="Platform" value="web (React 19 + Vite)" />
          <FP_KeyValueRow label="Transport" value="@firon/shared clientProxy — every call, no direct fetch/axios" />
          <FP_KeyValueRow label="Realtime" value="Socket.IO, one connection, query keys invalidated per event" />
        </div>
      </FP_Card>

      <FP_ConfirmDialog
        open={confirmSeed}
        onClose={() => setConfirmSeed(false)}
        onConfirm={() => seed.mutate()}
        title="Re-seed content defaults"
        confirmLabel="Re-seed now"
        message="Any default key that is missing is re-created. Keys you have already edited are left exactly as they are."
      />
    </FP_Screen>
  );
}
