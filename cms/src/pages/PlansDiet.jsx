/*
 * Diet-plan builder (CONTRACT §4.10 / §5 `/api/plans/diet`).
 *
 * Pick a client, set the daily kcal + macro targets, then add meals. The badge
 * next to the meal list is the same live `total / target kcal` readout the mobile
 * Nutrition screen and docs/prototype.html show, and it flips to the warn tone the
 * moment the meals add up past the target.
 *
 * **Assign** activates the plan, archives the previous active one and makes the
 * backend emit `plan:assigned` to `user:<clientId>` plus a push — the client's
 * Nutrition tab updates without a reload.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Plus, Salad, Save, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@firon/shared';
import { MEAL_SLOTS } from '../lib/constants.js';
import { fmtAgo, fmtNumber } from '../lib/format.js';
import qk from '../lib/queryKeys.js';
import {
  FP_Avatar, FP_Badge, FP_Button, FP_Card, FP_CardHead, FP_ConfirmDialog, FP_EmptyState,
  FP_ErrorState, FP_IconButton, FP_Label, FP_ProgressBar, FP_Screen, FP_Select,
  FP_SkeletonRows, FP_Textarea, FP_Textbox, useToast,
} from '../components/index.ts';

let uidCounter = 0;
const uid = () => { uidCounter += 1; return `m${uidCounter}`; };

const blankPlan = () => ({
  name: '', kcal: '', protein: '', carbs: '', fat: '', notes: '', meals: [],
});

const mealFrom = (meal) => ({
  uid: uid(),
  slot: meal.slot ?? 'Breakfast',
  food: meal.food ?? '',
  kcal: meal.kcal ?? '',
  protein: meal.protein ?? '',
  carbs: meal.carbs ?? '',
  fat: meal.fat ?? '',
});

const formFrom = (plan) => ({
  name: plan.name ?? '',
  kcal: plan.kcal ?? '',
  protein: plan.protein ?? '',
  carbs: plan.carbs ?? '',
  fat: plan.fat ?? '',
  notes: plan.notes ?? '',
  meals: (plan.meals ?? []).map(mealFrom),
});

const num = (v) => (Number(v) || 0);

export default function PlansDiet() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clientId, setClientId] = useState(searchParams.get('clientId') ?? '');
  const [planId, setPlanId] = useState(null);
  const [form, setForm] = useState(blankPlan);
  const [error, setError] = useState(null);
  const [confirmAssign, setConfirmAssign] = useState(false);
  const loadedFor = useRef(null);

  /* ------------------------------- queries ------------------------------- */
  const rosterQuery = useQuery({
    queryKey: qk.clientList({ forDietBuilder: true }),
    queryFn: () => api.clients.roster({ limit: 200 }),
  });
  const roster = rosterQuery.data ?? [];
  const client = roster.find((c) => c.id === clientId) ?? null;

  const plansQuery = useQuery({
    queryKey: qk.dietPlans(clientId),
    queryFn: () => api.plans.listDiet({ clientId, status: 'all' }),
    enabled: Boolean(clientId),
  });
  const plans = plansQuery.data ?? [];

  useEffect(() => {
    const loaded = plansQuery.data;
    if (!clientId || !loaded) return;
    if (loadedFor.current === clientId) return;
    loadedFor.current = clientId;
    const preferred = loaded.find((p) => p.status === 'active') ?? loaded[0] ?? null;
    if (preferred) { setPlanId(preferred.id); setForm(formFrom(preferred)); }
    else { setPlanId(null); setForm(blankPlan()); }
    setError(null);
  }, [clientId, plansQuery.data]);

  const currentPlan = plans.find((p) => p.id === planId) ?? null;

  /* -------------------------------- totals ------------------------------- */
  const totals = useMemo(() => form.meals.reduce((acc, m) => ({
    kcal: acc.kcal + num(m.kcal),
    protein: acc.protein + num(m.protein),
    carbs: acc.carbs + num(m.carbs),
    fat: acc.fat + num(m.fat),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [form.meals]);

  const targetKcal = num(form.kcal);
  const overTarget = targetKcal > 0 && totals.kcal > targetKcal;
  const kcalPct = targetKcal > 0 ? Math.min(100, Math.round((totals.kcal / targetKcal) * 100)) : 0;

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
    setForm({ ...blankPlan(), name: client?.goal === 'Fat loss' ? 'Cutting Plan' : 'Nutrition Plan' });
    setError(null);
  };

  const loadPlan = (id) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) { startNewPlan(); return; }
    setPlanId(plan.id);
    setForm(formFrom(plan));
    setError(null);
  };

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const addMeal = () => {
    const used = form.meals.map((m) => m.slot);
    const slot = MEAL_SLOTS.find((s) => !used.includes(s)) ?? 'Snack';
    setForm((f) => ({ ...f, meals: [...f.meals, { ...mealFrom({ slot }), food: '' }] }));
    setError(null);
  };

  const patchMeal = (mealUid, patch) => setForm((f) => ({
    ...f,
    meals: f.meals.map((m) => (m.uid === mealUid ? { ...m, ...patch } : m)),
  }));

  const removeMeal = (mealUid) => setForm((f) => ({ ...f, meals: f.meals.filter((m) => m.uid !== mealUid) }));

  const buildBody = () => ({
    clientId,
    name: form.name.trim(),
    kcal: form.kcal === '' ? undefined : Number(form.kcal),
    protein: form.protein === '' ? undefined : Number(form.protein),
    carbs: form.carbs === '' ? undefined : Number(form.carbs),
    fat: form.fat === '' ? undefined : Number(form.fat),
    notes: form.notes.trim() || undefined,
    meals: form.meals.map((m, i) => ({
      slot: m.slot,
      food: m.food.trim(),
      kcal: m.kcal === '' ? undefined : Number(m.kcal),
      protein: m.protein === '' ? undefined : Number(m.protein),
      carbs: m.carbs === '' ? undefined : Number(m.carbs),
      fat: m.fat === '' ? undefined : Number(m.fat),
      order: i,
    })),
  });

  const validate = () => {
    if (!clientId) return 'Pick a client first';
    if (!form.name.trim()) return 'The plan needs a name';
    if (!form.meals.length) return 'Add at least one meal';
    if (form.meals.some((m) => !m.food.trim())) return 'Every meal needs a food';
    if (form.meals.length > 20) return 'A plan holds at most 20 meals';
    return null;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.plans });
    queryClient.invalidateQueries({ queryKey: qk.clients });
  };

  const save = useMutation({
    mutationFn: (body) => (planId ? api.plans.updateDiet(planId, body) : api.plans.createDiet(body)),
    onSuccess: (plan) => {
      setPlanId(plan.id);
      setForm(formFrom(plan));
      loadedFor.current = clientId;
      toast.success(planId ? 'Diet plan saved' : 'Draft created', {
        sub: `${plan.name} · ${plan.meals?.length ?? 0} meals · ${plan.totalKcal ?? 0} kcal`,
      });
      invalidate();
    },
  });

  const assign = useMutation({
    mutationFn: (id) => api.plans.assignDiet(id),
    onSuccess: (plan) => {
      setConfirmAssign(false);
      setForm(formFrom(plan));
      toast.success('Diet plan assigned', { sub: `${client?.name ?? 'The client'} got it on their phone (plan:assigned)` });
      invalidate();
    },
    onError: () => setConfirmAssign(false),
  });

  const remove = useMutation({
    mutationFn: (id) => api.plans.removeDiet(id, { successMessage: 'Diet plan deleted' }),
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

  /* --------------------------------- render ------------------------------ */
  return (
    <FP_Screen
      title="Diet plan builder"
      subtitle="Daily targets and meals · the client's Nutrition tab mirrors this exactly"
      actions={(
        <>
          <FP_Button variant="secondary" icon={FilePlus2} disabled={!clientId} onPress={startNewPlan}>New plan</FP_Button>
          <FP_Button icon={Save} loading={save.isPending} disabled={!clientId} onPress={onSave}>
            {planId ? 'Save plan' : 'Save draft'}
          </FP_Button>
          <FP_Button
            icon={Send}
            loading={assign.isPending}
            disabled={!clientId || !form.meals.length}
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
              options={roster.map((c) => ({
                value: c.id,
                label: `${c.name}${c.dietPlanSummary ? ` · ${c.dietPlanSummary.kcal} kcal` : ' · no diet plan'}`,
              }))}
              placeholder={rosterQuery.isLoading ? 'Loading roster…' : 'Pick a client'}
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <FP_Select
              label="Plan"
              value={planId ?? ''}
              onChange={(e) => (e.target.value ? loadPlan(e.target.value) : startNewPlan())}
              options={plans.map((p) => ({ value: p.id, label: `${p.name} · ${p.status} · ${fmtAgo(p.updatedAt)}` }))}
              placeholder="New plan (unsaved)"
              disabled={!clientId}
            />
          </div>
          {client ? (
            <div className="row grow">
              <FP_Avatar name={client.name} src={client.avatarUrl} size="md" />
              <div>
                <div className="strong">{client.name}</div>
                <div className="tiny muted">{client.goal ?? '—'} · {client.planLabel}</div>
              </div>
            </div>
          ) : null}
          {currentPlan ? (
            <div className="row">
              <FP_Badge tone={currentPlan.status === 'active' ? 'ok' : 'muted'}>{currentPlan.status}</FP_Badge>
              {currentPlan.assignedAt ? <FP_Badge tone="pt">assigned {fmtAgo(currentPlan.assignedAt)}</FP_Badge> : null}
              <FP_IconButton small icon={Trash2} label="Delete this plan" onPress={() => remove.mutate(currentPlan.id)} />
            </div>
          ) : null}
        </div>
      </FP_Card>

      {!clientId ? (
        <div className="mt4">
          <FP_EmptyState
            icon={Salad}
            title="Pick a client to start building"
            message="Diet plans belong to one client. Choose them above and their current plan opens here."
          />
        </div>
      ) : (
        <div className="builder mt4">
          <div className="col">
            <FP_Card>
              <FP_CardHead title="Daily targets" sub="What the app's rings and macro row count against" />
              <div className="grid grid--form mt3">
                <FP_Textbox label="Plan name" value={form.name} onChange={setField('name')} placeholder="Cutting Plan" />
                <FP_Textbox label="Target kcal" type="number" min={0} value={form.kcal} onChange={setField('kcal')} placeholder="2100" />
                <FP_Textbox label="Protein (g)" type="number" min={0} value={form.protein} onChange={setField('protein')} />
                <FP_Textbox label="Carbs (g)" type="number" min={0} value={form.carbs} onChange={setField('carbs')} />
                <FP_Textbox label="Fat (g)" type="number" min={0} value={form.fat} onChange={setField('fat')} />
              </div>
              <div className="mt3">
                <FP_Textarea label="Coach notes" rows={2} value={form.notes} onChange={setField('notes')} />
              </div>
            </FP_Card>

            <FP_Card>
              <FP_CardHead
                title="Meals"
                sub={`${form.meals.length} meal(s) · slots are free text, the app groups by them`}
                actions={(
                  <div className="row">
                    <FP_Badge tone={overTarget ? 'warn' : 'ok'}>
                      {fmtNumber(totals.kcal)} / {targetKcal ? fmtNumber(targetKcal) : '—'} kcal
                    </FP_Badge>
                    <FP_Button size="sm" icon={Plus} onPress={addMeal}>Add meal</FP_Button>
                  </div>
                )}
              />

              {plansQuery.isLoading ? <FP_SkeletonRows rows={5} height={18} /> : null}

              {form.meals.length ? (
                <div className="col mt3">
                  <div className="meal-row tiny muted">
                    <span>Slot</span>
                    <span>Food</span>
                    <span>kcal</span>
                    <span>P</span>
                    <span>C</span>
                    <span>F</span>
                    <span />
                  </div>
                  {form.meals.map((meal) => (
                    <div className="meal-row" key={meal.uid}>
                      <FP_Select
                        value={meal.slot}
                        onChange={(e) => patchMeal(meal.uid, { slot: e.target.value })}
                        options={MEAL_SLOTS}
                        aria-label="Meal slot"
                      />
                      <FP_Textbox
                        value={meal.food}
                        onChange={(e) => patchMeal(meal.uid, { food: e.target.value })}
                        placeholder="Grilled chicken & quinoa"
                        aria-label="Food"
                      />
                      <FP_Textbox
                        type="number"
                        min={0}
                        value={meal.kcal}
                        onChange={(e) => patchMeal(meal.uid, { kcal: e.target.value })}
                        aria-label="Calories"
                      />
                      <FP_Textbox
                        type="number"
                        min={0}
                        value={meal.protein}
                        onChange={(e) => patchMeal(meal.uid, { protein: e.target.value })}
                        aria-label="Protein in grams"
                      />
                      <FP_Textbox
                        type="number"
                        min={0}
                        value={meal.carbs}
                        onChange={(e) => patchMeal(meal.uid, { carbs: e.target.value })}
                        aria-label="Carbs in grams"
                      />
                      <FP_Textbox
                        type="number"
                        min={0}
                        value={meal.fat}
                        onChange={(e) => patchMeal(meal.uid, { fat: e.target.value })}
                        aria-label="Fat in grams"
                      />
                      <FP_IconButton small icon={Trash2} label={`Remove ${meal.slot}`} onPress={() => removeMeal(meal.uid)} />
                    </div>
                  ))}
                </div>
              ) : (
                <FP_EmptyState
                  icon={Salad}
                  title="No meals yet"
                  message="Add the first meal — kcal and macros roll up into the badge above."
                  action={<FP_Button icon={Plus} onPress={addMeal}>Add meal</FP_Button>}
                />
              )}

              {error ? <div className="errorbox mt3" role="alert">{error}</div> : null}
            </FP_Card>
          </div>

          <div className="builder__side">
            <FP_Card>
              <FP_CardHead
                title="Totals vs targets"
                sub={overTarget ? 'Meals exceed the daily kcal target' : 'Meals fit inside the target'}
              />
              <div className="mt3">
                <FP_Label>Calories</FP_Label>
                <div className="row between small">
                  <span className={overTarget ? 'danger strong' : 'strong'}>{fmtNumber(totals.kcal)} kcal</span>
                  <span className="muted">target {targetKcal ? fmtNumber(targetKcal) : '—'}</span>
                </div>
                <FP_ProgressBar value={kcalPct} tone={overTarget ? 'warn' : undefined} />
              </div>

              <div className="mt4">
                {[
                  { label: 'Protein', total: totals.protein, target: num(form.protein) },
                  { label: 'Carbs', total: totals.carbs, target: num(form.carbs) },
                  { label: 'Fat', total: totals.fat, target: num(form.fat) },
                ].map((macro) => {
                  const over = macro.target > 0 && macro.total > macro.target;
                  const pct = macro.target > 0 ? Math.min(100, Math.round((macro.total / macro.target) * 100)) : 0;
                  return (
                    <div className="mt3" key={macro.label}>
                      <div className="row between small">
                        <span className={over ? 'danger' : ''}>{macro.label}</span>
                        <span className="muted">{fmtNumber(macro.total)} / {macro.target ? fmtNumber(macro.target) : '—'} g</span>
                      </div>
                      <FP_ProgressBar value={pct} tone={over ? 'warn' : undefined} />
                    </div>
                  );
                })}
              </div>

              {overTarget ? (
                <div className="errorbox mt4" role="status">
                  <div className="errorbox__title">Over target</div>
                  The meals add up to {fmtNumber(totals.kcal - targetKcal)} kcal more than the daily target.
                  The app shows the same warning on the client&apos;s Nutrition ring.
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
        title="Assign this diet plan"
        confirmLabel="Save & assign"
        message={`${client?.name ?? 'The client'} gets this plan immediately: it is saved, activated, any previous active diet plan is archived, and their phone is notified.`}
      />
    </FP_Screen>
  );
}
