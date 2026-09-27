/*
 * CONTENT EDITOR — the heart of the CMS.
 *
 * Every label, image and video the mobile app renders is a `Content` doc, and
 * this page is where they are edited:
 *   · left   — group tree (GET /content/groups, whatever groups exist) plus
 *              platform / locale / screen / type filters and a search over key,
 *              label and value
 *   · middle — editable grid whose control matches the type (text, richtext,
 *              number, boolean, colour, JSON, and FP_MediaPicker for image/video)
 *   · right  — FP_PhonePreview rendering the selected screen with the CURRENT
 *              values, unsaved edits included
 *
 * Edits accumulate as drafts; the sticky bar saves them all through
 * PATCH /content/bulk, and a single row can be saved with PUT /content/:id.
 * `content:updated` from another admin flashes the affected row in place.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eye, EyeOff, Plus, RefreshCw, RotateCcw, Save, Sparkles, Trash2, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FP_SOCKET_EVENTS, api } from '@firon/shared';
import { CONTENT_GROUPS, CONTENT_TYPES, LOCALES, PLATFORMS } from '../lib/constants.js';
import { fmtAgo, valuePreview } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import useDebounced from '../hooks/useDebounced.js';
import { useSocketEvent } from '../context/SocketContext.jsx';
import {
  FP_Badge, FP_Button, FP_Card, FP_ConfirmDialog, FP_EmptyState, FP_ErrorState,
  FP_IconButton, FP_PhonePreview, FP_PREVIEW_SCREENS, FP_Screen, FP_SearchInput,
  FP_Select, FP_SkeletonRows, FP_Table, useToast,
} from '../components/index.ts';
import ContentCreateModal from './content/ContentCreateModal.jsx';
import ContentValueEditor from './content/ContentValueEditor.jsx';

/** The MediaAsset a content row points at, whichever shape it arrives in. */
function assetOf(item) {
  if (item.media && typeof item.media === 'object') return item.media;
  if (item.url) return { id: item.mediaId ?? undefined, url: item.url, kind: item.type, title: null };
  return null;
}

export default function Content() {
  const queryClient = useQueryClient();
  const toast = useToast();

  /* ------------------------------- filters ------------------------------- */
  const [group, setGroup] = useState('');
  const [platform, setPlatform] = useState('');
  const [locale, setLocale] = useState('en');
  const [screen, setScreen] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const dSearch = useDebounced(search, 220);

  /* ------------------------------- editing ------------------------------- */
  const [drafts, setDrafts] = useState({});          // id -> value
  const [draftAssets, setDraftAssets] = useState({}); // id -> MediaAsset picked now
  const [savingRow, setSavingRow] = useState(null);
  const [flashed, setFlashed] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [previewScreen, setPreviewScreen] = useState('login');
  const flashTimers = useRef([]);

  useEffect(() => () => flashTimers.current.forEach(clearTimeout), []);

  /* -------------------------------- queries ------------------------------ */
  const groupsQuery = useQuery({
    queryKey: qk.contentGroups,
    queryFn: () => api.content.groups(),
  });

  const listParams = useMemo(() => ({
    locale: locale || undefined,
    group: group || undefined,
    platform: platform || undefined,
    screen: screen || undefined,
    limit: 1000,
  }), [locale, group, platform, screen]);

  const listQuery = useQuery({
    queryKey: qk.contentList(listParams),
    queryFn: () => api.content.list(listParams),
  });

  /* Every key for the locale, so the phone preview ignores the filters. */
  const allQuery = useQuery({
    queryKey: qk.contentList({ locale, all: true }),
    queryFn: () => api.content.list({ locale, limit: 2000 }),
  });

  const groups = groupsQuery.data ?? [];
  const items = listQuery.data?.data ?? [];
  const allItems = allQuery.data?.data ?? [];

  /* Group names come from the API — a new group (e.g. `guest`) appears on its own. */
  const groupNames = useMemo(() => {
    const fromApi = groups.map((g) => g.group).filter(Boolean);
    return fromApi.length ? fromApi : CONTENT_GROUPS;
  }, [groups]);

  const screens = useMemo(() => {
    const set = new Set();
    (allItems.length ? allItems : items).forEach((i) => { if (i.screen) set.add(i.screen); });
    return [...set].sort();
  }, [allItems, items]);

  /* --------------------------- derived rows ------------------------------ */
  const rows = useMemo(() => {
    const term = dSearch.trim().toLowerCase();
    return items
      .filter((i) => (type ? i.type === type : true))
      .filter((i) => {
        if (!term) return true;
        const raw = typeof i.value === 'object' ? JSON.stringify(i.value) : (i.value ?? '');
        return `${i.key} ${i.label ?? ''} ${raw}`.toLowerCase().includes(term);
      })
      .map((i) => ({ ...i, asset: draftAssets[i.id] ?? assetOf(i) }));
  }, [items, type, dSearch, draftAssets]);

  /** key -> item with the draft value applied; feeds the phone preview. */
  const previewByKey = useMemo(() => {
    const base = allItems.length ? allItems : items;
    const map = {};
    base.forEach((i) => {
      const asset = draftAssets[i.id] ?? assetOf(i);
      map[i.key] = {
        ...i,
        asset,
        url: asset?.url ?? i.url,
        mediaTitle: asset?.title ?? null,
        value: Object.prototype.hasOwnProperty.call(drafts, i.id) ? drafts[i.id] : i.value,
      };
    });
    return map;
  }, [allItems, items, drafts, draftAssets]);

  const dirtyIds = Object.keys(drafts);
  const dirtyCount = dirtyIds.length;

  /* ------------------------------ mutations ------------------------------ */
  const invalidateContent = () => queryClient.invalidateQueries({ queryKey: qk.content });

  const setDraft = useCallback((id, value) => {
    setDrafts((d) => ({ ...d, [id]: value }));
  }, []);

  const clearDraft = useCallback((id) => {
    setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    setDraftAssets((a) => { const n = { ...a }; delete n[id]; return n; });
  }, []);

  const bulkSave = useMutation({
    mutationFn: () => {
      const byId = new Map([...allItems, ...items].map((i) => [i.id, i]));
      const payload = dirtyIds
        .map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          const entry = { key: item.key, value: drafts[id] };
          const asset = draftAssets[id];
          if (asset?.id) entry.mediaId = asset.id;
          return entry;
        })
        .filter(Boolean);
      return api.content.bulk({ items: payload });
    },
    onSuccess: (result) => {
      const n = result?.updated ?? dirtyCount;
      toast.success(`${n} content ${n === 1 ? 'key' : 'keys'} saved`, {
        sub: 'Phones pick this up over the socket',
      });
      setDrafts({});
      setDraftAssets({});
      invalidateContent();
    },
  });

  const saveRow = async (item) => {
    setSavingRow(item.id);
    try {
      const body = { value: drafts[item.id] };
      const asset = draftAssets[item.id];
      if (asset === null) body.mediaId = null;
      else if (asset?.id) body.mediaId = asset.id;
      await api.content.update(item.id, body);
      clearDraft(item.id);
      toast.success(`Saved ${item.key}`);
      invalidateContent();
    } finally {
      setSavingRow(null);
    }
  };

  const createKey = useMutation({
    mutationFn: (body) => api.content.create(body),
    onSuccess: () => { setCreateOpen(false); invalidateContent(); },
  });

  const removeKey = useMutation({
    mutationFn: (item) => api.content.remove(item.id, { successMessage: 'Content key deleted' }),
    onSuccess: (_d, item) => { setDeleting(null); clearDraft(item.id); invalidateContent(); },
    onError: () => setDeleting(null),
  });

  const seedDefaults = useMutation({
    mutationFn: () => api.content.seedDefaults(),
    onSuccess: (data) => {
      toast.success(
        data?.created != null
          ? `Re-seeded ${data.created} missing default${data.created === 1 ? '' : 's'}`
          : 'Missing defaults re-seeded',
        { sub: data?.skipped != null ? `${data.skipped} existing keys left untouched` : undefined },
      );
      invalidateContent();
    },
  });

  /* --------------------- realtime: flash changed rows -------------------- */
  const flash = useCallback((keys) => {
    const pool = [...allItems, ...items];
    const ids = keys.map((k) => pool.find((i) => i.key === k)?.id).filter(Boolean);
    if (!ids.length) return;
    setFlashed((f) => {
      const n = { ...f };
      ids.forEach((id) => { n[id] = Date.now(); });
      return n;
    });
    const timer = setTimeout(() => {
      setFlashed((f) => {
        const n = { ...f };
        ids.forEach((id) => delete n[id]);
        return n;
      });
    }, 2400);
    flashTimers.current.push(timer);
  }, [allItems, items]);

  useSocketEvent(FP_SOCKET_EVENTS.CONTENT_UPDATED, (payload) => {
    if (payload?.key) flash([payload.key]);
  });
  useSocketEvent(FP_SOCKET_EVENTS.CONTENT_BULK_UPDATED, (payload) => {
    const keys = (payload?.items ?? []).map((i) => i.key).filter(Boolean);
    if (keys.length) flash(keys);
  });

  /* ------------------------------- columns ------------------------------- */
  const columns = [
    {
      key: 'key',
      header: 'Key',
      width: 220,
      sortValue: (r) => r.key,
      render: (r) => (
        <div>
          <div className="key-cell">{r.key}</div>
          <div className="small">{r.label || <span className="muted">no label</span>}</div>
          {r.description ? <div className="tiny muted truncate desc-cell">{r.description}</div> : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: 82,
      render: (r) => (
        <div className="col type-col">
          <span className="type-pill">{r.type}</span>
          {r.isPublished === false ? <FP_Badge tone="warn">draft</FP_Badge> : null}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      sortable: false,
      render: (r) => {
        const dirty = Object.prototype.hasOwnProperty.call(drafts, r.id);
        const value = dirty ? drafts[r.id] : r.value;
        return (
          <div className={`content-cell ${dirty ? 'content-cell--dirty' : ''}`}>
            <ContentValueEditor
              item={r}
              value={value}
              onChange={(v) => setDraft(r.id, v)}
              onPickAsset={(asset) => {
                setDraftAssets((a) => ({ ...a, [r.id]: asset }));
                setDraft(r.id, asset ? (asset.url ?? asset.id) : '');
              }}
            />
          </div>
        );
      },
    },
    {
      key: 'screen',
      header: 'Screen',
      width: 92,
      render: (r) => <span className="small muted">{r.screen || '—'}</span>,
    },
    {
      key: 'updatedAt',
      header: 'Last updated',
      width: 140,
      sortValue: (r) => r.updatedAt,
      render: (r) => (
        <div className="tiny muted">
          <div>{fmtAgo(r.updatedAt)}</div>
          <div className="truncate who-cell">
            {typeof r.updatedBy === 'object' ? (r.updatedBy?.name ?? '—') : (r.updatedBy ? 'admin' : '—')}
          </div>
          {r.version ? <div>v{r.version}</div> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 86,
      sortable: false,
      render: (r) => {
        const dirty = Object.prototype.hasOwnProperty.call(drafts, r.id);
        return (
          <div className="row row--end">
            {dirty ? (
              <>
                <FP_IconButton
                  small
                  icon={Save}
                  label={`Save ${r.key}`}
                  disabled={savingRow === r.id}
                  onPress={() => saveRow(r)}
                />
                <FP_IconButton small icon={X} label={`Discard changes to ${r.key}`} onPress={() => clearDraft(r.id)} />
              </>
            ) : (
              <FP_IconButton small icon={Trash2} label={`Delete ${r.key}`} onPress={() => setDeleting(r)} />
            )}
          </div>
        );
      },
    },
  ];

  const countFor = (g) => groups.find((x) => x.group === g)?.count ?? '';
  const totalCount = groups.reduce((s, g) => s + (Number(g.count) || 0), 0);

  return (
    <FP_Screen
      title="Content editor"
      subtitle="Every string, image and video the mobile app renders. Nothing is hardcoded in the app."
      actions={(
        <>
          <FP_Button
            variant="secondary"
            icon={showPreview ? EyeOff : Eye}
            onPress={() => setShowPreview((s) => !s)}
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </FP_Button>
          <FP_Button
            variant="secondary"
            icon={Sparkles}
            loading={seedDefaults.isPending}
            onPress={() => seedDefaults.mutate()}
          >
            Re-seed missing defaults
          </FP_Button>
          <FP_Button
            variant="secondary"
            icon={RefreshCw}
            loading={listQuery.isFetching}
            onPress={() => listQuery.refetch()}
          >
            Refresh
          </FP_Button>
          <FP_Button icon={Plus} onPress={() => setCreateOpen(true)}>New key</FP_Button>
        </>
      )}
    >
      <div className={showPreview ? 'content-layout content-layout--preview' : 'content-layout'}>
        {/* ----------------------------- group tree ----------------------- */}
        <FP_Card className="grouptree">
          <div className="card__title">Groups</div>
          {groupsQuery.isLoading ? <div className="mt3"><FP_SkeletonRows rows={6} /></div> : null}
          {groupsQuery.isError ? (
            <div className="mt3"><FP_ErrorState error={groupsQuery.error} onRetry={groupsQuery.refetch} /></div>
          ) : null}
          <div className="mt2 col grouptree__list">
            <button
              type="button"
              className={`grouptree__item ${group === '' ? 'is-active' : ''}`}
              onClick={() => setGroup('')}
            >
              All groups
              <span className="grouptree__count">{totalCount || ''}</span>
            </button>
            {groupNames.map((g) => (
              <button
                key={g}
                type="button"
                className={`grouptree__item ${group === g ? 'is-active' : ''}`}
                onClick={() => setGroup(g)}
              >
                {g}
                <span className="grouptree__count">{countFor(g)}</span>
              </button>
            ))}
          </div>
        </FP_Card>

        {/* ------------------------------- grid --------------------------- */}
        <div>
          <div className="toolbar">
            <div className="toolbar__grow">
              <FP_SearchInput value={search} onChange={setSearch} placeholder="Search key, label or value…" />
            </div>
            <FP_Select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              options={PLATFORMS}
              placeholder="All platforms"
              aria-label="Filter by platform"
            />
            <FP_Select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              options={LOCALES}
              aria-label="Locale"
            />
            <FP_Select
              value={screen}
              onChange={(e) => setScreen(e.target.value)}
              options={screens}
              placeholder="All screens"
              aria-label="Filter by screen"
            />
            <FP_Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={CONTENT_TYPES}
              placeholder="All types"
              aria-label="Filter by type"
            />
            {platform || screen || type || search || group ? (
              <FP_Button
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                onPress={() => {
                  setPlatform(''); setScreen(''); setType(''); setSearch(''); setGroup('');
                }}
              >
                Clear
              </FP_Button>
            ) : null}
          </div>

          {listQuery.isError ? (
            <FP_ErrorState error={listQuery.error} onRetry={listQuery.refetch} title="Could not load content" />
          ) : null}

          <FP_Card flush>
            <FP_Table
              columns={columns}
              rows={rows}
              loading={listQuery.isLoading}
              pageSize={25}
              initialSort={{ key: 'key', dir: 'asc' }}
              rowClassName={(r) => (flashed[r.id] ? 'row-flash' : undefined)}
              empty={(
                <FP_EmptyState
                  title="No content keys match"
                  message="Adjust the filters, or re-seed the defaults if the database is empty."
                  action={(
                    <FP_Button variant="secondary" icon={Sparkles} onPress={() => seedDefaults.mutate()}>
                      Re-seed defaults
                    </FP_Button>
                  )}
                />
              )}
            />
          </FP_Card>

          {dirtyCount > 0 ? (
            <div className="dirtybar" role="status">
              <span className="strong grow">
                {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
              </span>
              <FP_Button
                variant="ghost"
                icon={RotateCcw}
                onPress={() => { setDrafts({}); setDraftAssets({}); }}
              >
                Discard all
              </FP_Button>
              <FP_Button icon={Save} loading={bulkSave.isPending} onPress={() => bulkSave.mutate()}>
                Save all changes
              </FP_Button>
            </div>
          ) : null}
        </div>

        {/* ----------------------------- preview -------------------------- */}
        {showPreview ? (
          <div>
            <FP_Select
              label="Preview screen"
              value={previewScreen}
              onChange={(e) => setPreviewScreen(e.target.value)}
              options={FP_PREVIEW_SCREENS.map((s) => ({ value: s.value, label: s.label }))}
            />
            <div className="mt3">
              {allQuery.isLoading
                ? <FP_SkeletonRows rows={10} height={18} />
                : <FP_PhonePreview screen={previewScreen} byKey={previewByKey} dirtyCount={dirtyCount} />}
            </div>
          </div>
        ) : null}
      </div>

      <ContentCreateModal
        key={createOpen ? 'open' : 'closed'}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        saving={createKey.isPending}
        groups={groupNames}
        defaults={{ group: group || 'common', locale, platform: platform || 'mobile', screen }}
        onCreate={(body) => createKey.mutate(body)}
      />

      <FP_ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => removeKey.mutate(deleting)}
        title="Delete content key"
        confirmLabel="Delete key"
        message={deleting
          ? `${deleting.key} will be removed (current value: ${valuePreview(deleting.value, 60) || 'empty'}). The mobile app will fall back to its bundled default for this key.`
          : ''}
      />
    </FP_Screen>
  );
}
