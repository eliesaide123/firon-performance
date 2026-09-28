/*
 * Exercise library CRUD (CONTRACT §4.8 / §5 `/api/exercises`).
 *
 * This is the vocabulary the training-plan builder draws from and the demo clip
 * the client sees next to each movement, so the demo reference goes through
 * FP_MediaPicker (via FP_MediaRefField) — only approved assets can ship.
 *
 * Trainers and admins may both write here (route guard: trainer/admin).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@firon/shared';
import { EQUIPMENT, MUSCLE_GROUPS } from '../lib/constants.js';
import { fmtAgo } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import useDebounced from '../hooks/useDebounced.js';
import {
  FP_Badge, FP_Button, FP_Card, FP_ConfirmDialog, FP_EmptyState, FP_ErrorState,
  FP_IconButton, FP_MediaRefField, FP_MediaThumb, FP_Modal, FP_Screen,
  FP_SearchInput, FP_Select, FP_Switch, FP_Table, FP_Textarea, FP_Textbox, useToast,
} from '../components/index.ts';

const EMPTY = {
  name: '', slug: '', description: '', muscleGroup: '', equipment: '', type: '',
  demoMediaId: null, demoDurationLabel: '', cuesText: '', isActive: true,
};

/** The wire shape keeps `cues` as an array; the editor keeps one cue per line. */
const toForm = (ex) => (ex?.id ? {
  ...EMPTY,
  ...ex,
  cuesText: (ex.cues ?? []).join('\n'),
} : { ...EMPTY, ...(ex ?? {}) });

function ExerciseForm({ open, onClose, onSave, saving, initial }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [demoAsset, setDemoAsset] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(toForm(initial));
    setDemoAsset(initial?.demoMediaId
      ? { id: initial.demoMediaId, url: initial.demoUrl, thumbnailUrl: initial.demoThumbnailUrl, kind: 'video', title: initial.name }
      : null);
    setError(null);
  }, [initial, open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = () => {
    if (!form.name.trim()) { setError('An exercise needs a name'); return; }
    const cues = form.cuesText.split('\n').map((c) => c.trim()).filter(Boolean);
    onSave({
      name: form.name.trim(),
      slug: (form.slug || '').trim() || undefined,
      description: (form.description || '').trim() || undefined,
      muscleGroup: form.muscleGroup || undefined,
      equipment: form.equipment || undefined,
      type: (form.type || '').trim() || undefined,
      demoMediaId: form.demoMediaId ?? null,
      demoDurationLabel: (form.demoDurationLabel || '').trim() || undefined,
      cues,
      isActive: Boolean(form.isActive),
    });
  };

  return (
    <FP_Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? `Edit ${initial.name}` : 'New exercise'}
      size="md"
      footer={(
        <>
          <FP_Button variant="secondary" onPress={onClose}>Cancel</FP_Button>
          <FP_Button loading={saving} onPress={submit}>
            {initial?.id ? 'Save exercise' : 'Create exercise'}
          </FP_Button>
        </>
      )}
    >
      <div className="grid grid--form">
        <FP_Textbox label="Name" value={form.name} onChange={set('name')} autoFocus placeholder="Back Squat" />
        <FP_Textbox
          label="Slug"
          value={form.slug ?? ''}
          onChange={set('slug')}
          placeholder="back-squat"
          hint="Left blank, the server slugifies the name"
        />
        <FP_Select
          label="Muscle group"
          value={form.muscleGroup ?? ''}
          onChange={set('muscleGroup')}
          options={MUSCLE_GROUPS}
          placeholder="Unspecified"
        />
        <FP_Select
          label="Equipment"
          value={form.equipment ?? ''}
          onChange={set('equipment')}
          options={EQUIPMENT}
          placeholder="Unspecified"
        />
        <FP_Textbox
          label="Type"
          value={form.type ?? ''}
          onChange={set('type')}
          placeholder="Compound · barbell"
          hint="Free text — shown under the name in the app"
        />
        <FP_Textbox
          label="Demo duration label"
          value={form.demoDurationLabel ?? ''}
          onChange={set('demoDurationLabel')}
          placeholder="0:18"
        />
      </div>

      <div className="mt3">
        <FP_Textarea label="Description" rows={2} value={form.description ?? ''} onChange={set('description')} />
      </div>

      <div className="mt3">
        <FP_Textarea
          label="Coaching cues"
          rows={4}
          value={form.cuesText}
          onChange={set('cuesText')}
          placeholder={'Brace hard\nKnees track over toes\nHit depth under control'}
          hint="One cue per line — the app renders them as a bullet list"
        />
      </div>

      <div className="mt3 field">
        <div className="field__label">Demo clip</div>
        <FP_MediaRefField
          kind="video"
          value={form.demoMediaId}
          asset={demoAsset}
          onChange={(asset) => {
            setDemoAsset(asset);
            setForm((f) => ({ ...f, demoMediaId: asset?.id ?? null }));
          }}
          placeholder="No demo linked"
        />
      </div>

      <div className="mt3">
        <FP_Switch
          checked={Boolean(form.isActive)}
          onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          label={form.isActive ? 'Active — selectable in the plan builder' : 'Inactive — hidden from the builder'}
        />
      </div>

      {error ? <div className="errorbox mt3" role="alert">{error}</div> : null}
    </FP_Modal>
  );
}

export default function Exercises() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const dSearch = useDebounced(search, 250);

  const params = useMemo(() => ({
    q: dSearch || undefined,
    muscleGroup: muscleGroup || undefined,
    equipment: equipment || undefined,
    includeInactive: 'true',
    page,
    limit: 25,
  }), [dSearch, muscleGroup, equipment, page]);

  const listQuery = useQuery({
    queryKey: qk.exerciseList(params),
    queryFn: () => api.exercises.list(params),
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? null;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.exercises });

  const save = useMutation({
    mutationFn: (body) => (body.id ? api.exercises.update(body.id, body) : api.exercises.create(body)),
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  /* DELETE is a soft delete server-side: plans reference exercises by id, so the
     row is deactivated rather than removed. Say so instead of claiming a delete. */
  const remove = useMutation({
    mutationFn: (ex) => api.exercises.remove(ex.id),
    onSuccess: (res, ex) => {
      setDeleting(null);
      toast.success(`${ex.name} retired`, {
        sub: res?.deactivated ? 'Deactivated — hidden from the builder, existing plans untouched' : 'Removed',
      });
      invalidate();
    },
    onError: () => setDeleting(null),
  });

  const toggleActive = useMutation({
    mutationFn: (ex) => api.exercises.update(ex.id, { isActive: !ex.isActive }),
    onSuccess: invalidate,
  });

  const columns = [
    {
      key: 'name',
      header: 'Exercise',
      render: (ex) => (
        <div className="row">
          <FP_MediaThumb
            asset={ex.demoUrl ? { url: ex.demoThumbnailUrl ?? ex.demoUrl, kind: ex.demoThumbnailUrl ? 'image' : 'video' } : { kind: 'video' }}
            className="mediaref__thumb"
          />
          <div style={{ minWidth: 0 }}>
            <div className="strong truncate">{ex.name}</div>
            <div className="tiny muted truncate desc-cell">{ex.type || ex.description || '—'}</div>
          </div>
        </div>
      ),
    },
    { key: 'muscleGroup', header: 'Muscle group', width: 130, render: (ex) => ex.muscleGroup || '—' },
    { key: 'equipment', header: 'Equipment', width: 120, render: (ex) => ex.equipment || '—' },
    {
      key: 'cues',
      header: 'Cues',
      width: 80,
      align: 'right',
      sortValue: (ex) => (ex.cues ?? []).length,
      render: (ex) => <span className="mono">{(ex.cues ?? []).length}</span>,
    },
    {
      key: 'demoMediaId',
      header: 'Demo',
      width: 90,
      sortable: false,
      render: (ex) => (ex.demoUrl
        ? <FP_Badge tone={ex.demoStatus === 'approved' ? 'ok' : 'warn'}>{ex.demoStatus ?? 'linked'}</FP_Badge>
        : <span className="tiny muted">none</span>),
    },
    {
      key: 'isActive',
      header: 'Active',
      width: 110,
      render: (ex) => (
        <FP_Switch
          checked={Boolean(ex.isActive)}
          onChange={() => toggleActive.mutate(ex)}
          label={ex.isActive ? 'live' : 'hidden'}
        />
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      width: 110,
      sortValue: (ex) => ex.updatedAt,
      render: (ex) => <span className="tiny muted">{fmtAgo(ex.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 84,
      sortable: false,
      render: (ex) => (
        <div className="row row--end">
          <FP_IconButton small icon={Pencil} label={`Edit ${ex.name}`} onPress={() => setEditing(ex)} />
          <FP_IconButton small icon={Trash2} label={`Retire ${ex.name}`} onPress={() => setDeleting(ex)} />
        </div>
      ),
    },
  ];

  return (
    <FP_Screen
      title="Exercises"
      subtitle="The movement library behind every training plan · demos come from approved media"
      actions={<FP_Button icon={Plus} onPress={() => setEditing({ ...EMPTY })}>New exercise</FP_Button>}
    >
      <div className="toolbar">
        <div className="toolbar__grow">
          <FP_SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search name, muscle group, equipment, type…"
          />
        </div>
        <FP_Select
          value={muscleGroup}
          onChange={(e) => { setMuscleGroup(e.target.value); setPage(1); }}
          options={MUSCLE_GROUPS}
          placeholder="All muscle groups"
          aria-label="Filter by muscle group"
        />
        <FP_Select
          value={equipment}
          onChange={(e) => { setEquipment(e.target.value); setPage(1); }}
          options={EQUIPMENT}
          placeholder="All equipment"
          aria-label="Filter by equipment"
        />
        <FP_Badge tone="muted">{meta?.total ?? rows.length} total</FP_Badge>
      </div>

      {listQuery.isError ? (
        <FP_ErrorState error={listQuery.error} onRetry={listQuery.refetch} title="Could not load exercises" />
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
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={(
            <FP_EmptyState
              icon={Dumbbell}
              title="No exercises found"
              message={search || muscleGroup || equipment
                ? 'Nothing matches these filters.'
                : 'Add the first exercise — the plan builder draws from this list.'}
              action={<FP_Button icon={Plus} onPress={() => setEditing({ ...EMPTY })}>New exercise</FP_Button>}
            />
          )}
        />
      </FP_Card>

      <ExerciseForm
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
        title="Retire exercise"
        confirmLabel="Retire exercise"
        danger
        message={`"${deleting?.name ?? 'This exercise'}" is deactivated: it disappears from the plan builder, and plans that already use it keep their own copy of the name and prescription.`}
      />
    </FP_Screen>
  );
}
