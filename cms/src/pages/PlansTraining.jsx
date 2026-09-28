/*
 * Training-plan builder (CONTRACT §4.9 / §5 `/api/plans/training`).
 *
 * Pick a client, name the program, set the week, then compose days out of the
 * exercise library on the right. Saving writes a `draft`; **Assign** flips it to
 * `active`, archives the client's previous active plan and makes the backend emit
 * `plan:assigned` to `user:<clientId>` plus a push notification — so the plan
 * lands on the client's phone while this page is still open.
 *
 * `prescription` ("4 × 12 · 20kg") is derived from sets/reps/weight exactly the
 * way `planService.prescriptionOf` does, and stays editable for the prescriptions
 * that are not sets×reps at all ("20 min steady").
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, CalendarPlus, Dumbbell, FilePlus2, Save, Send, Trash2, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@firon/shared';
import { DAY_LABELS } from '../lib/constants.js';
import { fmtAgo } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import useDebounced from '../hooks/useDebounced.js';
import {
  FP_Avatar, FP_Badge, FP_Button, FP_Card, FP_CardHead, FP_ConfirmDialog, FP_EmptyState,
  FP_ErrorState, FP_IconButton, FP_Pressable, FP_Screen, FP_SearchInput, FP_Select,
  FP_SkeletonRows, FP_Textarea, FP_Textbox, useToast,
} from '../components/index.ts';

let uidCounter = 0;
const uid = () => { uidCounter += 1; return `r${uidCounter}`; };

/** Mirrors backend planService.prescriptionOf so the UI shows what will be stored. */
function derivePrescription(ex) {
  const parts = [];
  const sets = Number(ex.sets) || 0;
  const reps = Number(ex.reps) || 0;
  const weight = Number(ex.weightKg) || 0;
  if (sets && reps) parts.push(`${sets} × ${reps}`);
  else if (sets) parts.push(`${sets} sets`);
  else if (reps) parts.push(`${reps} reps`);
  if (weight) parts.push(`${weight}kg`);
  return parts.join(' · ');
}

const blankPlan = () => ({ name: '', weekNumber: '', notes: '', days: [] });

const dayFrom = (day) => ({
  uid: uid(),
  dayIndex: day.dayIndex ?? 0,
  title: day.title ?? '',
  durationMin: day.durationMin ?? '',
  status: day.status ?? 'todo',
  exercises: (day.exercises ?? []).map((ex) => ({
    uid: uid(),
    exerciseId: ex.exerciseId ?? null,
    name: ex.name ?? '',
    sets: ex.sets ?? '',
    reps: ex.reps ?? '',
    weightKg: ex.weightKg ?? '',
    notes: ex.notes ?? '',
    prescription: ex.prescription ?? '',
    done: Boolean(ex.done),
  })),
});

const formFrom = (plan) => ({
  name: plan.name ?? '',
  weekNumber: plan.weekNumber ?? '',
  notes: plan.notes ?? '',
  days: (plan.days ?? []).map(dayFrom),
});

export default function PlansTraining() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clientId, setClientId] = useState(searchParams.get('clientId') ?? '');
  const [planId, setPlanId] = useState(null);
  const [form, setForm] = useState(blankPlan);
  const [activeDayUid, setActiveDayUid] = useState(null);
  const [error, setError] = useState(null);
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [search, setSearch] = useState('');
  const dSearch = useDebounced(search, 250);
  const loadedFor = useRef(null);

  /* ------------------------------- queries ------------------------------- */
  const rosterQuery = useQuery({ queryKey: qk.clientList({ forBuilder: true }), queryFn: () => api.clients.roster({ limit: 200 }) });
  const roster = rosterQuery.data ?? [];
  const client = roster.find((c) => c.id === clientId) ?? null;

  const plansQuery = useQuery({
    queryKey: qk.trainingPlans(clientId),
    queryFn: () => api.plans.listTraining({ clientId, status: 'all' }),
    enabled: Boolean(clientId),
  });
  const plans = plansQuery.data ?? [];

  const libraryQuery = useQuery({
    queryKey: qk.exerciseList({ q: dSearch || undefined, forBuilder: true }),
    queryFn: () => api.exercises.list({ q: dSearch || undefined, limit: 100 }),
  });
  const library = libraryQuery.data?.data ?? [];

  /* Load the client's active plan (or the newest) the first time they are picked. */
  useEffect(() => {
    const loaded = plansQuery.data;
    if (!clientId || !loaded) return;
    if (loadedFor.current === clientId) return;
    loadedFor.current = clientId;
    const preferred = loaded.find((p) => p.status === 'active') ?? loaded[0] ?? null;
    if (preferred) { setPlanId(preferred.id); setForm(formFrom(preferred)); }
    else { setPlanId(null); setForm(blankPlan()); }
    setActiveDayUid(null);
    setError(null);
  }, [clientId, plansQuery.data]);

  const currentPlan = plans.find((p) => p.id === planId) ?? null;
  const activeDay = form.days.find((d) => d.uid === activeDayUid)
    ?? form.days[form.days.length - 1]
    ?? null;

  /* ------------------------------- helpers ------------------------------- */
  const pickClient = (id) => {
    setClientId(id);
    loadedFor.current = null;
    const next = new URLSearchParams(searchParams);
    if (id) next.set('clientId', id); else next.delete('clientId');
    setSearchParams(next, { replace: true });
  };

  const startNewPlan = () => {
    setPlanId(null);
    setForm({ ...blankPlan(), name: client ? `${client.goal ?? 'Training'} block` : '' });
    setActiveDayUid(null);
    setError(null);
  };

  const loadPlan = (id) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) { startNewPlan(); return; }
    setPlanId(plan.id);
    setForm(formFrom(plan));
    setActiveDayUid(null);
    setError(null);
  };

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const patchDay = (dayUid, patch) => setForm((f) => ({
    ...f,
    days: f.days.map((d) => (d.uid === dayUid ? { ...d, ...patch } : d)),
  }));

  const addDay = () => {
    if (form.days.length >= 7) { setError('A plan covers at most 7 days'); return; }
    const used = new Set(form.days.map((d) => d.dayIndex));
    const dayIndex = DAY_LABELS.findIndex((_, i) => !used.has(i));
    const day = {
      uid: uid(),
      dayIndex: dayIndex === -1 ? 0 : dayIndex,
      title: '',
      durationMin: 45,
      status: 'todo',
      exercises: [],
    };
    setForm((f) => ({ ...f, days: [...f.days, day] }));
    setActiveDayUid(day.uid);
    setError(null);
  };

  const removeDay = (dayUid) => setForm((f) => ({ ...f, days: f.days.filter((d) => d.uid !== dayUid) }));

  const addExercise = (exercise) => {
    const target = activeDay ?? null;
    if (!target) { setError('Add a day first, then pick exercises for it'); return; }
    const row = {
      uid: uid(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 4,
      reps: 10,
      weightKg: '',
      notes: '',
      prescription: '4 × 10',
      done: false,
    };
    patchDay(target.uid, { exercises: [...target.exercises, row] });
    setActiveDayUid(target.uid);
    setError(null);
  };

  const patchExercise = (dayUid, exUid, patch) => setForm((f) => ({
    ...f,
    days: f.days.map((d) => (d.uid !== dayUid ? d : {
      ...d,
      exercises: d.exercises.map((ex) => {
        if (ex.uid !== exUid) return ex;
        const next = { ...ex, ...patch };
        // Keep the derived prescription in step unless the coach typed their own.
        if (!('prescription' in patch)) {
          const wasDerived = !ex.prescription || ex.prescription === derivePrescription(ex);
          if (wasDerived) next.prescription = derivePrescription(next);
        }
        return next;
      }),
    })),
  }));

  const removeExercise = (dayUid, exUid) => setForm((f) => ({
    ...f,
    days: f.days.map((d) => (d.uid !== dayUid ? d : { ...d, exercises: d.exercises.filter((ex) => ex.uid !== exUid) })),
  }));

  const moveExercise = (dayUid, index, dir) => setForm((f) => ({
    ...f,
    days: f.days.map((d) => {
      if (d.uid !== dayUid) return d;
      const list = [...d.exercises];
      const target = index + dir;
      if (target < 0 || target >= list.length) return d;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...d, exercises: list };
    }),
  }));

  /* -------------------------------- payload ------------------------------ */
  const buildBody = () => ({
    clientId,
    name: form.name.trim(),
    weekNumber: form.weekNumber === '' ? undefined : Number(form.weekNumber),
    notes: form.notes.trim() || undefined,
    days: form.days.map((d) => ({
      dayIndex: Number(d.dayIndex),
      dayLabel: DAY_LABELS[Number(d.dayIndex)] ?? 'Mon',
      title: d.title.trim(),
      durationMin: d.durationMin === '' ? undefined : Number(d.durationMin),
      status: d.status,
      exercises: d.exercises.map((ex, i) => ({
        exerciseId: ex.exerciseId ?? null,
        name: ex.name.trim(),
        prescription: (ex.prescription || '').trim() || undefined,
        sets: ex.sets === '' ? undefined : Number(ex.sets),
        reps: ex.reps === '' ? undefined : Number(ex.reps),
        weightKg: ex.weightKg === '' ? undefined : Number(ex.weightKg),
        notes: ex.notes.trim() || undefined,
        done: Boolean(ex.done),
        order: i,
      })),
    })),
  });

  const validate = () => {
    if (!clientId) return 'Pick a client first';
    if (!form.name.trim()) return 'The program needs a name';
    if (!form.days.length) return 'Add at least one training day';
    if (form.days.some((d) => !d.title.trim())) return 'Every day needs a title';
    if (form.days.some((d) => d.exercises.some((ex) => !ex.name.trim()))) return 'Every exercise needs a name';
    const indexes = form.days.map((d) => Number(d.dayIndex));
    if (new Set(indexes).size !== indexes.length) return 'Two days share the same weekday — pick different days';
    return null;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.plans });
    queryClient.invalidateQueries({ queryKey: qk.clients });
  };

  const save = useMutation({
    mutationFn: (body) => (planId ? api.plans.updateTraining(planId, body) : api.plans.createTraining(body)),
    onSuccess: (plan) => {
      setPlanId(plan.id);
      setForm(formFrom(plan));
      loadedFor.current = clientId;
      toast.success(planId ? 'Plan saved' : 'Draft created', { sub: `${plan.name} · ${plan.days?.length ?? 0} days` });
      invalidate();
    },
  });

  const assign = useMutation({
    mutationFn: (id) => api.plans.assignTraining(id),
    onSuccess: (plan) => {
      setConfirmAssign(false);
      setForm(formFrom(plan));
      toast.success('Plan assigned', { sub: `${client?.name ?? 'The client'} got it on their phone (plan:assigned)` });
      invalidate();
    },
    onError: () => setConfirmAssign(false),
  });

  const remove = useMutation({
    mutationFn: (id) => api.plans.removeTraining(id, { successMessage: 'Plan deleted' }),
    onSuccess: () => { setPlanId(null); setForm(blankPlan()); loadedFor.current = null; invalidate(); },
  });

  const onSave = async () => {
    const problem = validate();
    if (problem) { setError(problem); return null; }
    setError(null);
    return save.mutateAsync(buildBody());
  };

  const onAssign = async () => {
    const problem = validate();
    if (problem) { setError(problem); setConfirmAssign(false); return; }
    setError(null);
    const saved = await save.mutateAsync(buildBody());
    const id = saved?.id ?? planId;
    if (id) assign.mutate(id);
  };

  const totalExercises = form.days.reduce((n, d) => n + d.exercises.length, 0);

  /* --------------------------------- render ------------------------------ */
  return (
    <FP_Screen
      title="Training plan builder"
      subtitle="Compose the week, then assign — the client's phone updates live over plan:assigned"
      actions={(
        <>
          <FP_Button variant="secondary" icon={FilePlus2} disabled={!clientId} onPress={startNewPlan}>New plan</FP_Button>
          <FP_Button icon={Save} loading={save.isPending} disabled={!clientId} onPress={onSave}>
            {planId ? 'Save plan' : 'Save draft'}
          </FP_Button>
          <FP_Button
            icon={Send}
            loading={assign.isPending}
            disabled={!clientId || !form.days.length}
            onPress={() => setConfirmAssign(true)}
          >
            Assign to client
          </FP_Button>
        </>
      )}
    >
      {rosterQuery.isError ? (
        <FP_ErrorState error={rosterQuery.error} onRetry={rosterQuery.refetch} title="Could not load the roster" />
      ) : null}

      <FP_Card>
        <div className="toolbar mb0">
          <div style={{ minWidth: 240 }}>
            <FP_Select
              label="Client"
              value={clientId}
              onChange={(e) => pickClient(e.target.value)}
              options={roster.map((c) => ({ value: c.id, label: `${c.name} · ${c.planLabel}` }))}
              placeholder={rosterQuery.isLoading ? 'Loading roster…' : 'Pick a client'}
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <FP_Select
              label="Plan"
              value={planId ?? ''}
              onChange={(e) => (e.target.value ? loadPlan(e.target.value) : startNewPlan())}
              options={plans.map((p) => ({
                value: p.id,
                label: `${p.name} · ${p.status} · ${fmtAgo(p.updatedAt)}`,
              }))}
              placeholder="New plan (unsaved)"
              disabled={!clientId}
            />
          </div>
          {client ? (
            <div className="row grow">
              <FP_Avatar name={client.name} src={client.avatarUrl} size="md" />
              <div>
                <div className="strong">{client.name}</div>
                <div className="tiny muted">{client.planLabel} · {client.adherencePct}% adherence</div>
              </div>
            </div>
          ) : null}
          {currentPlan ? (
            <div className="row">
              <FP_Badge tone={currentPlan.status === 'active' ? 'ok' : 'muted'}>{currentPlan.status}</FP_Badge>
              {currentPlan.assignedAt ? <FP_Badge tone="pt">assigned {fmtAgo(currentPlan.assignedAt)}</FP_Badge> : null}
              <FP_IconButton
                small
                icon={Trash2}
                label="Delete this plan"
                onPress={() => remove.mutate(currentPlan.id)}
              />
            </div>
          ) : null}
        </div>
      </FP_Card>

      {!clientId ? (
        <div className="mt4">
          <FP_EmptyState
            icon={Dumbbell}
            title="Pick a client to start building"
            message="Every plan belongs to one client. Choose them above and the builder opens with their current program."
          />
        </div>
      ) : (
        <div className="builder mt4">
          <div className="col">
            <FP_Card>
              <FP_CardHead
                title="Program"
                sub={`${form.days.length} day(s) · ${totalExercises} exercise(s)`}
              />
              <div className="grid grid--form mt3">
                <FP_Textbox label="Program name" value={form.name} onChange={setField('name')} placeholder="Fat Loss" />
                <FP_Textbox
                  label="Week number"
                  type="number"
                  min={0}
                  value={form.weekNumber}
                  onChange={setField('weekNumber')}
                  hint="Shown in the app as 'Fat Loss · Wk 4'"
                />
              </div>
              <div className="mt3">
                <FP_Textarea label="Coach notes" rows={2} value={form.notes} onChange={setField('notes')} />
              </div>
            </FP_Card>

            {plansQuery.isLoading ? <FP_Card><FP_SkeletonRows rows={5} height={18} /></FP_Card> : null}

            {form.days.length ? form.days.map((day, dayPos) => (
              <FP_Card key={day.uid}>
                <div className="day-card__head">
                  <div style={{ width: 110 }}>
                    <FP_Select
                      value={String(day.dayIndex)}
                      onChange={(e) => patchDay(day.uid, { dayIndex: Number(e.target.value) })}
                      options={DAY_LABELS.map((label, i) => ({ value: String(i), label }))}
                      aria-label="Weekday"
                    />
                  </div>
                  <div className="grow">
                    <FP_Textbox
                      value={day.title}
                      onChange={(e) => patchDay(day.uid, { title: e.target.value })}
                      placeholder="Full Body HIIT"
                      aria-label={`Title for day ${dayPos + 1}`}
                    />
                  </div>
                  <div style={{ width: 110 }}>
                    <FP_Textbox
                      type="number"
                      min={0}
                      value={day.durationMin}
                      onChange={(e) => patchDay(day.uid, { durationMin: e.target.value })}
                      aria-label="Duration in minutes"
                      placeholder="min"
                    />
                  </div>
                  <FP_Badge tone={activeDay?.uid === day.uid ? 'pt' : 'muted'}>
                    {activeDay?.uid === day.uid ? 'adding here' : `${day.exercises.length} ex`}
                  </FP_Badge>
                  <FP_IconButton
                    small
                    icon={Dumbbell}
                    label={`Add exercises to ${day.title || `day ${dayPos + 1}`}`}
                    active={activeDay?.uid === day.uid}
                    onPress={() => setActiveDayUid(day.uid)}
                  />
                  <FP_IconButton small icon={X} label={`Remove day ${dayPos + 1}`} onPress={() => removeDay(day.uid)} />
                </div>

                <div className="mt3">
                  {day.exercises.length ? day.exercises.map((ex, i) => (
                    <div className="ex-row" key={ex.uid}>
                      <span className="ex-row__name truncate" title={ex.name}>{ex.name}</span>
                      <div style={{ width: 62 }}>
                        <FP_Textbox
                          type="number"
                          min={0}
                          value={ex.sets}
                          onChange={(e) => patchExercise(day.uid, ex.uid, { sets: e.target.value })}
                          aria-label={`Sets for ${ex.name}`}
                          placeholder="sets"
                        />
                      </div>
                      <div style={{ width: 62 }}>
                        <FP_Textbox
                          type="number"
                          min={0}
                          value={ex.reps}
                          onChange={(e) => patchExercise(day.uid, ex.uid, { reps: e.target.value })}
                          aria-label={`Reps for ${ex.name}`}
                          placeholder="reps"
                        />
                      </div>
                      <div style={{ width: 68 }}>
                        <FP_Textbox
                          type="number"
                          min={0}
                          value={ex.weightKg}
                          onChange={(e) => patchExercise(day.uid, ex.uid, { weightKg: e.target.value })}
                          aria-label={`Weight in kg for ${ex.name}`}
                          placeholder="kg"
                        />
                      </div>
                      <div style={{ width: 140 }}>
                        <FP_Textbox
                          value={ex.prescription}
                          onChange={(e) => patchExercise(day.uid, ex.uid, { prescription: e.target.value })}
                          aria-label={`Prescription for ${ex.name}`}
                          placeholder={derivePrescription(ex) || '20 min steady'}
                        />
                      </div>
                      <FP_IconButton
                        small
                        icon={ArrowUp}
                        label={`Move ${ex.name} up`}
                        disabled={i === 0}
                        onPress={() => moveExercise(day.uid, i, -1)}
                      />
                      <FP_IconButton
                        small
                        icon={ArrowDown}
                        label={`Move ${ex.name} down`}
                        disabled={i === day.exercises.length - 1}
                        onPress={() => moveExercise(day.uid, i, 1)}
                      />
                      <FP_IconButton small icon={Trash2} label={`Remove ${ex.name}`} onPress={() => removeExercise(day.uid, ex.uid)} />
                    </div>
                  )) : (
                    <div className="tiny muted">No exercises yet — pick them from the library on the right.</div>
                  )}
                </div>
              </FP_Card>
            )) : (
              <FP_Card>
                <FP_EmptyState
                  icon={CalendarPlus}
                  title="No days yet"
                  message="Add a training day, then fill it from the exercise library."
                  action={<FP_Button icon={CalendarPlus} onPress={addDay}>Add day</FP_Button>}
                />
              </FP_Card>
            )}

            <div className="row">
              <FP_Button variant="secondary" icon={CalendarPlus} onPress={addDay} disabled={form.days.length >= 7}>
                Add day
              </FP_Button>
              {error ? <div className="errorbox grow" role="alert">{error}</div> : null}
            </div>
          </div>

          <div className="builder__side">
            <FP_Card>
              <FP_CardHead
                title="Exercise library"
                sub={activeDay ? `Adding to ${activeDay.title || DAY_LABELS[activeDay.dayIndex]}` : 'Add a day first'}
              />
              <div className="mt3">
                <FP_SearchInput value={search} onChange={setSearch} placeholder="Search exercises…" />
              </div>

              {libraryQuery.isError ? (
                <FP_ErrorState error={libraryQuery.error} onRetry={libraryQuery.refetch} title="Library unavailable" />
              ) : null}
              {libraryQuery.isLoading ? <div className="mt3"><FP_SkeletonRows rows={8} height={16} /></div> : null}

              {!libraryQuery.isLoading && !libraryQuery.isError ? (
                <div className="col mt3" style={{ maxHeight: 460, overflowY: 'auto' }}>
                  {library.length ? library.map((ex) => (
                    <FP_Pressable
                      key={ex.id}
                      className="libitem"
                      label={`Add ${ex.name}`}
                      disabled={!activeDay}
                      onPress={() => addExercise(ex)}
                    >
                      <span className="grow truncate strong">{ex.name}</span>
                      <span className="tiny muted nowrap">{ex.muscleGroup ?? ex.equipment ?? ''}</span>
                    </FP_Pressable>
                  )) : (
                    <FP_EmptyState icon={Dumbbell} title="No exercises match" message="Try another search term." />
                  )}
                </div>
              ) : null}
            </FP_Card>
          </div>
        </div>
      )}

      <FP_ConfirmDialog
        open={confirmAssign}
        onClose={() => setConfirmAssign(false)}
        onConfirm={onAssign}
        title="Assign this plan"
        confirmLabel="Save & assign"
        message={`${client?.name ?? 'The client'} gets this plan immediately: it is saved, activated, any previous active plan is archived, and their phone is notified.`}
      />
    </FP_Screen>
  );
}
