/*
 * Video library CRUD — the source for the mobile Videos tab.
 * Media references go through FP_MediaPicker so only approved assets can ship.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Video as VideoIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@firon/shared';
import { LEVELS } from '../lib/constants.js';
import { fmtAgo, fmtDuration } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import useDebounced from '../hooks/useDebounced.js';
import {
  FP_Badge, FP_Button, FP_Card, FP_ConfirmDialog, FP_EmptyState, FP_ErrorState,
  FP_IconButton, FP_MediaRefField, FP_MediaThumb, FP_Modal, FP_Screen,
  FP_SearchInput, FP_Select, FP_Switch, FP_Table, FP_Textarea, FP_Textbox,
} from '../components/index.ts';

const EMPTY = {
  title: '', description: '', categoryId: '', durationSec: '', durationLabel: '',
  level: '', order: 0, gradientIndex: 0, isPublished: true,
  videoMediaId: null, thumbnailMediaId: null,
};

/** Derive '24:10' from seconds so the mobile list never shows a blank duration. */
const labelFor = (form) =>
  form.durationLabel?.trim() || (form.durationSec ? fmtDuration(form.durationSec) : '');

function VideoForm({ open, onClose, onSave, saving, initial, categories }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const [videoAsset, setVideoAsset] = useState(initial?.videoMedia ?? null);
  const [thumbAsset, setThumbAsset] = useState(initial?.thumbnailMedia ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(initial ?? EMPTY);
    setVideoAsset(initial?.videoMedia ?? null);
    setThumbAsset(initial?.thumbnailMedia ?? null);
    setError(null);
  }, [initial, open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = () => {
    if (!form.title.trim()) { setError('A video needs a title'); return; }
    const category = categories.find((c) => c.id === form.categoryId);
    onSave({
      ...form,
      title: form.title.trim(),
      categoryId: form.categoryId || null,
      category: category?.name ?? undefined,
      durationSec: form.durationSec === '' ? undefined : Number(form.durationSec),
      durationLabel: labelFor(form),
      order: Number(form.order) || 0,
      gradientIndex: Number(form.gradientIndex) || 0,
    });
  };

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? `Edit ${initial.title}` : 'New video'}
      size="md"
      footer={(
        <>
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
          <FP_Button loading={saving} onPress={submit}>{initial?.id ? 'Save video' : 'Create video'}</FP_Button>
        </>
      )}
    >
      <div className="grid grid--form">
        <FP_Textbox label="Title" value={form.title} onChange={set('title')} autoFocus />
        <FP_Select
          label="Category"
          value={form.categoryId ?? ''}
          onChange={set('categoryId')}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="No category"
        />
        <FP_Textbox
          label="Duration (seconds)"
          type="number"
          value={form.durationSec ?? ''}
          onChange={set('durationSec')}
          hint={labelFor(form) ? `Shows as ${labelFor(form)}` : 'Used for the duration pill'}
        />
        <FP_Textbox label="Duration label" value={form.durationLabel ?? ''} onChange={set('durationLabel')} placeholder="24:10" />
        <FP_Select label="Level" value={form.level ?? ''} onChange={set('level')} options={LEVELS} placeholder="Any level" />
        <FP_Textbox label="Order" type="number" value={form.order ?? 0} onChange={set('order')} />
        <FP_Textbox
          label="Gradient index"
          type="number"
          min={0}
          max={7}
          value={form.gradientIndex ?? 0}
          onChange={set('gradientIndex')}
          hint="Fallback visual when there is no thumbnail (0–7)"
        />
      </div>

      <div className="mt3">
        <FP_Textarea label="Description" rows={3} value={form.description ?? ''} onChange={set('description')} />
      </div>

      <div className="grid grid--form mt3">
        <div className="field">
          <div className="field__label">Video file</div>
          <FP_MediaRefField
            kind="video"
            value={form.videoMediaId}
            asset={videoAsset}
            onChange={(asset) => { setVideoAsset(asset); setForm((f) => ({ ...f, videoMediaId: asset?.id ?? null })); }}
            placeholder="No video linked"
          />
        </div>
        <div className="field">
          <div className="field__label">Thumbnail</div>
          <FP_MediaRefField
            kind="image"
            value={form.thumbnailMediaId}
            asset={thumbAsset}
            onChange={(asset) => { setThumbAsset(asset); setForm((f) => ({ ...f, thumbnailMediaId: asset?.id ?? null })); }}
            placeholder="No thumbnail — gradient is used"
          />
        </div>
      </div>

      <div className="mt3">
        <FP_Switch
          checked={Boolean(form.isPublished)}
          onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))}
          label={form.isPublished ? 'Published — visible in the app' : 'Unpublished — hidden from clients'}
        />
      </div>

      {error ? <div className="errorbox mt3" role="alert">{error}</div> : null}
    </FP_Modal>
  );
}

export default function Videos() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const dSearch = useDebounced(search, 250);

  const categoriesQuery = useQuery({
    queryKey: qk.categoryList({ kind: 'video' }),
    queryFn: () => api.categories.list({ kind: 'video' }),
  });
  const categories = categoriesQuery.data ?? [];

  const params = useMemo(() => ({
    q: dSearch || undefined,
    category: categoryId ? (categories.find((c) => c.id === categoryId)?.name ?? undefined) : undefined,
    page,
    limit: 25,
  }), [dSearch, categoryId, categories, page]);

  const listQuery = useQuery({
    queryKey: qk.videoList(params),
    queryFn: () => api.videos.list(params),
  });

  const videos = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? null;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.videos });

  const save = useMutation({
    mutationFn: (body) => (body.id
      ? api.videos.update(body.id, body)
      : api.videos.create(body)),
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (video) => api.videos.remove(video.id, { successMessage: 'Video deleted' }),
    onSuccess: () => { setDeleting(null); invalidate(); },
    onError: () => setDeleting(null),
  });

  const togglePublished = useMutation({
    mutationFn: (video) => api.videos.update(video.id, { isPublished: !video.isPublished }),
    onSuccess: invalidate,
  });

  const columns = [
    {
      key: 'title',
      header: 'Video',
      render: (v) => (
        <div className="row">
          <FP_MediaThumb
            asset={v.thumbnailUrl ? { url: v.thumbnailUrl, kind: 'image' } : { kind: 'video' }}
            gradientIndex={v.gradientIndex}
            className="mediaref__thumb"
          />
          <div style={{ minWidth: 0 }}>
            <div className="strong truncate">{v.title}</div>
            <div className="tiny muted truncate desc-cell">{v.description || '—'}</div>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', width: 120, render: (v) => v.category ?? '—' },
    {
      key: 'durationLabel',
      header: 'Duration',
      width: 90,
      render: (v) => v.durationLabel || (v.durationSec ? fmtDuration(v.durationSec) : '—'),
    },
    { key: 'level', header: 'Level', width: 100, render: (v) => v.level ?? '—' },
    { key: 'order', header: 'Order', width: 70, align: 'right', render: (v) => v.order ?? 0 },
    {
      key: 'isPublished',
      header: 'Published',
      width: 110,
      render: (v) => (
        <FP_Switch
          checked={Boolean(v.isPublished)}
          onChange={() => togglePublished.mutate(v)}
          label={v.isPublished ? 'live' : 'hidden'}
        />
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      width: 110,
      sortValue: (v) => v.updatedAt,
      render: (v) => <span className="tiny muted">{fmtAgo(v.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 84,
      sortable: false,
      render: (v) => (
        <div className="row row--end">
          <FP_IconButton small icon={Pencil} label={`Edit ${v.title}`} onPress={() => setEditing(v)} />
          <FP_IconButton small icon={Trash2} label={`Delete ${v.title}`} onPress={() => setDeleting(v)} />
        </div>
      ),
    },
  ];

  return (
    <FP_Screen
      title="Videos"
      subtitle="The library behind the mobile Videos tab · only approved media can be attached"
      actions={<FP_Button icon={Plus} onPress={() => setEditing({ ...EMPTY })}>New video</FP_Button>}
    >
      <div className="toolbar">
        <div className="toolbar__grow">
          <FP_SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search videos…" />
        </div>
        <FP_Select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="All categories"
          aria-label="Filter by category"
        />
        <FP_Badge tone="muted">{meta?.total ?? videos.length} total</FP_Badge>
      </div>

      {listQuery.isError ? (
        <FP_ErrorState error={listQuery.error} onRetry={listQuery.refetch} title="Could not load videos" />
      ) : null}

      <FP_Card flush>
        <FP_Table
          columns={columns}
          rows={videos}
          loading={listQuery.isLoading}
          serverPaged={Boolean(meta?.pages)}
          page={meta?.page ?? page}
          pages={meta?.pages ?? 1}
          total={meta?.total ?? videos.length}
          limit={meta?.limit}
          onPageChange={setPage}
          initialSort={{ key: 'order', dir: 'asc' }}
          empty={(
            <FP_EmptyState
              icon={VideoIcon}
              title="No videos yet"
              message="Add the first video — clients see published videos whose media is approved."
              action={<FP_Button icon={Plus} onPress={() => setEditing({ ...EMPTY })}>New video</FP_Button>}
            />
          )}
        />
      </FP_Card>

      <VideoForm
        open={Boolean(editing)}
        initial={editing}
        categories={categories}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(body) => save.mutate({ ...body, id: editing?.id })}
      />

      <FP_ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        title="Delete video"
        confirmLabel="Delete video"
        message={`"${deleting?.title ?? 'This video'}" will be removed from the library and from every client's Videos tab.`}
      />
    </FP_Screen>
  );
}
