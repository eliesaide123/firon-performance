/*
 * Category CRUD (CONTRACT §4.5 / §5 `/api/categories`).
 *
 * Categories drive the video chips in the mobile Videos tab and the exercise
 * library grouping, so order matters: the app renders them exactly in the
 * `order` the CMS stores. The reorder control rewrites the whole visible list
 * 1..n so there are never two chips fighting for the same slot.
 *
 * Live: every write emits `category:changed`, which SocketContext maps to the
 * ['categories'] + ['videos'] key roots — so a second admin's edit lands here
 * without a reload.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@firon/shared';
import { fmtAgo } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import {
  FP_Badge, FP_Button, FP_Card, FP_ConfirmDialog, FP_EmptyState, FP_ErrorState,
  FP_IconButton, FP_Modal, FP_Screen, FP_Segmented, FP_Select, FP_Switch,
  FP_Table, FP_Textbox, useToast,
} from '../components/index.ts';

const KINDS = [
  { value: 'video', label: 'Video' },
  { value: 'exercise', label: 'Exercise' },
];

/** Lucide-ish icon names the mobile app already knows how to render. */
const ICONS = ['flame', 'dumbbell', 'target', 'activity', 'heart', 'timer', 'zap', 'move', 'salad'];

const EMPTY = { name: '', slug: '', order: 0, icon: '', kind: 'video', isActive: true };

const slugify = (s) => String(s).trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

function CategoryForm({ open, onClose, onSave, saving, initial }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const [error, setError] = useState(null);

  useEffect(() => { setForm(initial ?? EMPTY); setError(null); }, [initial, open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = () => {
    if (!form.name.trim()) { setError('A category needs a name'); return; }
    onSave({
      ...form,
      name: form.name.trim(),
      slug: (form.slug || '').trim() || slugify(form.name),
      icon: (form.icon || '').trim() || undefined,
      order: Number(form.order) || 0,
    });
  };

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? `Edit ${initial.name}` : 'New category'}
      footer={(
        <>
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
          <FP_Button loading={saving} onPress={submit}>
            {initial?.id ? 'Save category' : 'Create category'}
          </FP_Button>
        </>
      )}
    >
      <div className="grid grid--form">
        <FP_Textbox label="Name" value={form.name} onChange={set('name')} autoFocus placeholder="HIIT" />
        <FP_Textbox
          label="Slug"
          value={form.slug ?? ''}
          onChange={set('slug')}
          placeholder={slugify(form.name) || 'hiit'}
          hint="Left blank, the server slugifies the name"
        />
        <FP_Textbox label="Order" type="number" value={form.order ?? 0} onChange={set('order')} hint="Low numbers show first" />
        <FP_Select
          label="Kind"
          value={form.kind ?? 'video'}
          onChange={set('kind')}
          options={KINDS}
        />
        <FP_Select
          label="Icon"
          value={form.icon ?? ''}
          onChange={set('icon')}
          options={ICONS}
          placeholder="No icon"
        />
      </div>

      <div className="mt3">
        <FP_Switch
          checked={Boolean(form.isActive)}
          onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          label={form.isActive ? 'Active — visible in the app' : 'Inactive — hidden from clients'}
        />
      </div>

      {error ? <div className="errorbox mt3" role="alert">{error}</div> : null}
    </FP_Modal>
  );
}

export default function Categories() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const params = { kind, includeInactive: 'true' };

  const listQuery = useQuery({
    queryKey: qk.categoryList(params),
    queryFn: () => api.categories.list(params),
  });

  const rows = useMemo(
    () => [...(listQuery.data ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [listQuery.data],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.categories });

  const save = useMutation({
    mutationFn: (body) => (body.id ? api.categories.update(body.id, body) : api.categories.create(body)),
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (row) => api.categories.remove(row.id),
    onSuccess: (res, row) => {
      setDeleting(null);
      if (res?.deactivated) {
        toast.success(`${row.name} deactivated`, { sub: `${res.videosUsing} video(s) still reference it` });
      } else {
        toast.success(`${row.name} deleted`);
      }
      invalidate();
    },
    onError: () => setDeleting(null),
  });

  const toggleActive = useMutation({
    mutationFn: (row) => api.categories.update(row.id, { isActive: !row.isActive }),
    onSuccess: invalidate,
  });

  /* Reorder: rewrite the visible list 1..n and PUT only what actually moved. */
  const reorder = useMutation({
    mutationFn: async ({ index, dir }) => {
      const next = [...rows];
      const target = index + dir;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      const changed = next
        .map((row, i) => ({ row, order: i + 1 }))
        .filter(({ row, order }) => (row.order ?? 0) !== order);
      await Promise.all(changed.map(({ row, order }) => api.categories.update(row.id, { order })));
    },
    onSuccess: invalidate,
  });

  const columns = [
    {
      key: 'order',
      header: 'Order',
      width: 108,
      sortable: false,
      render: (row) => {
        const index = rows.findIndex((r) => r.id === row.id);
        return (
          <div className="row row--end">
            <span className="mono">{row.order ?? 0}</span>
            <FP_IconButton
              small
              icon={ArrowUp}
              label={`Move ${row.name} up`}
              disabled={index <= 0 || reorder.isPending}
              onPress={() => reorder.mutate({ index, dir: -1 })}
            />
            <FP_IconButton
              small
              icon={ArrowDown}
              label={`Move ${row.name} down`}
              disabled={index < 0 || index >= rows.length - 1 || reorder.isPending}
              onPress={() => reorder.mutate({ index, dir: 1 })}
            />
          </div>
        );
      },
    },
    {
      key: 'name',
      header: 'Category',
      render: (row) => (
        <div>
          <div className="strong">{row.name}</div>
          <div className="tiny muted">{row.icon ? `icon: ${row.icon}` : 'no icon'}</div>
        </div>
      ),
    },
    { key: 'slug', header: 'Slug', width: 160, render: (row) => <span className="key-cell">{row.slug}</span> },
    {
      key: 'kind',
      header: 'Kind',
      width: 100,
      render: (row) => <FP_Badge tone={row.kind === 'exercise' ? 'pt' : 'muted'}>{row.kind}</FP_Badge>,
    },
    {
      key: 'isActive',
      header: 'Active',
      width: 110,
      render: (row) => (
        <FP_Switch
          checked={Boolean(row.isActive)}
          onChange={() => toggleActive.mutate(row)}
          label={row.isActive ? 'live' : 'hidden'}
        />
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      width: 110,
      sortValue: (row) => row.updatedAt,
      render: (row) => <span className="tiny muted">{fmtAgo(row.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 84,
      sortable: false,
      render: (row) => (
        <div className="row row--end">
          <FP_IconButton small icon={Pencil} label={`Edit ${row.name}`} onPress={() => setEditing(row)} />
          <FP_IconButton small icon={Trash2} label={`Delete ${row.name}`} onPress={() => setDeleting(row)} />
        </div>
      ),
    },
  ];

  return (
    <FP_Screen
      title="Categories"
      subtitle="The chips the mobile Videos tab renders, in exactly this order"
      actions={<FP_Button icon={Plus} onPress={() => setEditing({ ...EMPTY, order: rows.length + 1 })}>New category</FP_Button>}
    >
      <div className="toolbar">
        <FP_Segmented
          value={kind}
          onChange={setKind}
          options={[{ value: 'all', label: 'All' }, ...KINDS]}
          aria-label="Filter by kind"
        />
        <div className="toolbar__grow" />
        <FP_Badge tone="muted">{rows.length} total</FP_Badge>
        <FP_Badge tone="ok">{rows.filter((r) => r.isActive).length} active</FP_Badge>
      </div>

      {listQuery.isError ? (
        <FP_ErrorState error={listQuery.error} onRetry={listQuery.refetch} title="Could not load categories" />
      ) : null}

      <FP_Card flush>
        <FP_Table
          columns={columns}
          rows={rows}
          loading={listQuery.isLoading}
          initialSort={{ key: 'order', dir: 'asc' }}
          empty={(
            <FP_EmptyState
              icon={ListOrdered}
              title="No categories yet"
              message="Add the first category — it becomes a chip in the app's video library."
              action={<FP_Button icon={Plus} onPress={() => setEditing({ ...EMPTY, order: 1 })}>New category</FP_Button>}
            />
          )}
        />
      </FP_Card>

      <CategoryForm
        open={Boolean(editing)}
        initial={editing}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(body) => save.mutate({ ...body, id: editing?.id })}
      />

      <FP_ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        title="Delete category"
        confirmLabel="Delete category"
        danger
        message={`"${deleting?.name ?? 'This category'}" will be removed. If videos still reference it, it is deactivated instead so nothing breaks.`}
      />
    </FP_Screen>
  );
}
