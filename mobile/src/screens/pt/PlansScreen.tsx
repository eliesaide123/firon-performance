/**
 * PT tab 2 — the prototype's `pt-builder` screen: `trainBuilder()`, `dietBuilder()`,
 * `mealEditSheet()` / `saveClientMeal()` / `removeClientMeal()` and, critically,
 * `syncBuilderFields()`.
 *
 * `syncBuilderFields` exists because the prototype re-rendered the whole screen whenever the
 * trainer switched client or tab. Here every in-progress edit lives in `drafts[clientId]`, so
 * switching away and back keeps it; `fpSyncDraft()` reproduces the prototype's normalisation
 * (blank name reverts to the seeded one, a non-positive number reverts to the seeded one) at
 * exactly the two moments the prototype called it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  api,
  type ClientDetail,
  type Exercise,
  type RosterEntry,
  type TrainingPlan,
} from '@firon/shared';
import {
  FP_Avatar,
  FP_Badge,
  FP_BottomSheet,
  FP_Button,
  FP_Card,
  FP_Chip,
  FP_ChipScroll,
  FP_CmsText,
  FP_Column,
  FP_EmptyState,
  FP_ErrorState,
  FP_Icon,
  FP_IconButton,
  FP_ListItem,
  FP_Row,
  FP_Screen,
  FP_ScreenTitle,
  FP_SearchInput,
  FP_Segmented,
  FP_Skeleton,
  FP_StickyHead,
  FP_Textbox,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import useResource from '../../store/useResource';
import queryCache, { QK } from '../../store/queryCache';
import { FP_COLORS, FP_SPACING } from '../../theme';
import FP_PtSectionHead from './components/FP_PtSectionHead';
import FP_PtSheetHead from './components/FP_PtSheetHead';
import { fpFirstName, fpGroupNumber, fpPositiveInt } from './ptUtils';

type BuilderKind = 'train' | 'diet';
const KINDS: readonly BuilderKind[] = ['train', 'diet'] as const;
const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snack', 'Pre-workout', 'Dinner'] as const;

/** The server sends `meals` (a count) where the shared DTO names `mealCount`. */
type RosterDietSummary = NonNullable<RosterEntry['dietPlanSummary']> & { meals?: number };

interface MealDraft {
  slot: string;
  food: string;
  kcal: number;
}

interface ClientDraft {
  /** training */
  programName: string;
  startFrom: 'template' | 'blank';
  picked: string[];
  /** diet — numbers stay strings while the trainer types */
  planName: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  meals: MealDraft[];
  /** `syncBuilderFields` fallbacks: what the plan said before this editing session */
  seed: {
    programName: string;
    planName: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  /** meals only exist on the detail payload, so they are filled in a second pass */
  mealsSeeded: boolean;
}

function fpMakeDraft(entry: RosterEntry): ClientDraft {
  const diet = (entry.dietPlanSummary ?? null) as RosterDietSummary | null;
  const seed = {
    programName: entry.planLabel ?? '',
    planName: diet?.name ?? '',
    kcal: diet?.kcal ?? 0,
    protein: diet?.protein ?? 0,
    carbs: diet?.carbs ?? 0,
    fat: diet?.fat ?? 0,
  };
  return {
    programName: seed.programName,
    startFrom: 'template',
    picked: [],
    planName: seed.planName,
    kcal: seed.kcal ? String(seed.kcal) : '',
    protein: seed.protein ? String(seed.protein) : '',
    carbs: seed.carbs ? String(seed.carbs) : '',
    fat: seed.fat ? String(seed.fat) : '',
    meals: [],
    seed,
    mealsSeeded: false,
  };
}

/** Second seeding pass: the real meal rows only arrive with `GET /clients/:id`. */
function fpSeedMeals(draft: ClientDraft, detail: ClientDetail): ClientDraft {
  const plan = detail.dietPlan;
  const seed = {
    ...draft.seed,
    planName: plan?.name ?? draft.seed.planName,
    kcal: plan?.kcal ?? draft.seed.kcal,
    protein: plan?.protein ?? draft.seed.protein,
    carbs: plan?.carbs ?? draft.seed.carbs,
    fat: plan?.fat ?? draft.seed.fat,
    programName: detail.trainingPlan?.name ?? draft.seed.programName,
  };
  return {
    ...draft,
    seed,
    mealsSeeded: true,
    meals: (plan?.meals ?? []).map(m => ({ slot: m.slot, food: m.food, kcal: m.kcal })),
  };
}

/** The prototype's `syncBuilderFields()` — normalise, never discard. */
function fpSyncDraft(draft: ClientDraft): ClientDraft {
  return {
    ...draft,
    programName: draft.programName.trim() || draft.seed.programName,
    planName: draft.planName.trim(),
    kcal: String(fpPositiveInt(draft.kcal, draft.seed.kcal)),
    protein: String(fpPositiveInt(draft.protein, draft.seed.protein)),
    carbs: String(fpPositiveInt(draft.carbs, draft.seed.carbs)),
    fat: String(fpPositiveInt(draft.fat, draft.seed.fat)),
  };
}

type PtNav = { navigate: (screen: string, params?: Record<string, unknown>) => void };

export interface PlansScreenProps {
  navigation?: PtNav;
  route?: { params?: { clientId?: string; kind?: BuilderKind } };
}

const PlansScreen: React.FC<PlansScreenProps> = ({ route }) => {
  const { t } = useContent();
  const { toast } = useToast();

  const roster = useResource<RosterEntry[]>(QK.roster, () => api.clients.roster());
  const entries = roster.data ?? [];

  const routeClientId = route?.params?.clientId;
  const routeKind = route?.params?.kind;

  const [clientId, setClientId] = useState<string | null>(routeClientId ?? null);
  const [kind, setKind] = useState<BuilderKind>(routeKind ?? 'train');
  const [drafts, setDrafts] = useState<Record<string, ClientDraft>>({});
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [mealIndex, setMealIndex] = useState<number | null>(null);
  const [mealForm, setMealForm] = useState<{ slot: string; food: string; kcal: string }>({
    slot: '',
    food: '',
    kcal: '',
  });
  const [mealErrors, setMealErrors] = useState<{ slot: boolean; food: boolean; kcal: boolean }>({
    slot: false,
    food: false,
    kcal: false,
  });

  /* route params win whenever the roster sheet hands us a client */
  const lastRouteKey = useRef<string>('');
  useEffect(() => {
    const key = `${routeClientId ?? ''}:${routeKind ?? ''}`;
    if (key === lastRouteKey.current) {
      return;
    }
    lastRouteKey.current = key;
    if (routeClientId) {
      setClientId(routeClientId);
    }
    if (routeKind) {
      setKind(routeKind);
    }
  }, [routeClientId, routeKind]);

  /* default selection = first client, like the prototype's `ptClient = 0` */
  useEffect(() => {
    if (!clientId && entries.length > 0) {
      setClientId(entries[0].id);
    }
  }, [clientId, entries]);

  const selected = useMemo(
    () => entries.find(c => c.id === clientId) ?? null,
    [entries, clientId],
  );

  const detail = useResource<ClientDetail>(
    QK.clientDetail(clientId ?? 'none'),
    () => api.clients.byId(clientId as string),
    { enabled: Boolean(clientId) },
  );

  /* first seeding pass — from the roster row */
  useEffect(() => {
    if (!selected) {
      return;
    }
    setDrafts(prev => (prev[selected.id] ? prev : { ...prev, [selected.id]: fpMakeDraft(selected) }));
  }, [selected]);

  /* second seeding pass — meals + exact plan names from the detail payload */
  useEffect(() => {
    const data = detail.data;
    if (!clientId || !data) {
      return;
    }
    setDrafts(prev => {
      const current = prev[clientId];
      if (!current || current.mealsSeeded) {
        return prev;
      }
      return { ...prev, [clientId]: fpSeedMeals(current, data) };
    });
  }, [clientId, detail.data]);

  /* debounce the library search so every keystroke is not a request */
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  const library = useResource<Exercise[]>(
    QK.exercises(debouncedQuery),
    async () => (await api.exercises.list({ q: debouncedQuery || undefined })).data,
    { enabled: kind === 'train' },
  );

  const draft = clientId ? drafts[clientId] : undefined;
  const first = fpFirstName(selected?.name);

  const patchDraft = useCallback(
    (patch: Partial<ClientDraft>) => {
      if (!clientId) {
        return;
      }
      setDrafts(prev => {
        const current = prev[clientId];
        if (!current) {
          return prev;
        }
        return { ...prev, [clientId]: { ...current, ...patch } };
      });
    },
    [clientId],
  );

  /** `syncBuilderFields()` before the two switches that used to re-render the screen. */
  const syncCurrent = useCallback(() => {
    if (!clientId) {
      return;
    }
    setDrafts(prev => {
      const current = prev[clientId];
      if (!current) {
        return prev;
      }
      return { ...prev, [clientId]: fpSyncDraft(current) };
    });
  }, [clientId]);

  const selectClient = useCallback(
    (id: string) => {
      if (id === clientId) {
        return;
      }
      syncCurrent();
      setClientId(id);
    },
    [clientId, syncCurrent],
  );

  const selectKind = useCallback(
    (next: BuilderKind) => {
      if (next === kind) {
        return;
      }
      syncCurrent();
      setKind(next);
    },
    [kind, syncCurrent],
  );

  const totalKcal = useMemo(
    () => (draft?.meals ?? []).reduce((sum, m) => sum + (m.kcal || 0), 0),
    [draft?.meals],
  );
  const targetKcal = fpPositiveInt(draft?.kcal ?? '', draft?.seed.kcal ?? 0);
  const over = totalKcal > targetKcal;

  /* ------------------------------ meal sheet ------------------------------ */

  const openMealSheet = useCallback(
    (index: number) => {
      syncCurrent();
      const existing = index >= 0 ? draft?.meals[index] : undefined;
      setMealForm({
        slot: existing?.slot ?? '',
        food: existing?.food ?? '',
        kcal: existing ? String(existing.kcal) : '',
      });
      setMealErrors({ slot: false, food: false, kcal: false });
      setMealIndex(index);
    },
    [draft?.meals, syncCurrent],
  );

  const saveMeal = useCallback(() => {
    if (mealIndex === null || !draft) {
      return;
    }
    const slot = mealForm.slot.trim();
    const food = mealForm.food.trim();
    const kcal = parseInt(mealForm.kcal, 10);
    const errors = { slot: !slot, food: !food, kcal: !(kcal > 0) };
    setMealErrors(errors);
    if (errors.slot || errors.food || errors.kcal) {
      return;
    }
    const next = [...draft.meals];
    if (mealIndex >= 0) {
      next[mealIndex] = { slot, food, kcal };
    } else {
      next.push({ slot, food, kcal });
    }
    patchDraft({ meals: next });
    setMealIndex(null);
    toast(t(mealIndex >= 0 ? 'pt.builder.toast_meal_updated' : 'pt.builder.toast_meal_added'));
  }, [draft, mealForm, mealIndex, patchDraft, t, toast]);

  const removeMeal = useCallback(
    (index: number) => {
      if (!draft) {
        return;
      }
      const removed = draft.meals[index];
      patchDraft({ meals: draft.meals.filter((_, i) => i !== index) });
      toast(t('pt.builder.toast_meal_removed', { slot: removed?.slot ?? '' }));
    },
    [draft, patchDraft, t, toast],
  );

  /* -------------------------------- assign -------------------------------- */

  const assignTraining = useCallback(async () => {
    if (!draft || !clientId) {
      return;
    }
    const name = draft.programName.trim() || draft.seed.programName;
    if (!name) {
      toast(t('pt.builder.err_needs_name'));
      return;
    }
    const chosen = (library.data ?? []).filter(e => draft.picked.includes(e.id));
    /**
     * The builder collects only what the prototype collected; the server's `normaliseDays()` +
     * `ensureCurrentDay()` fill the day defaults, so this is a deliberate partial payload.
     */
    const days = [
      {
        dayIndex: 0,
        dayLabel: 'Mon',
        title: name,
        exercises: chosen.map((e, i) => ({ exerciseId: e.id, name: e.name, order: i })),
      },
    ] as unknown as TrainingPlan['days'];

    setAssigning(true);
    try {
      const plan = await api.plans.createTraining({ clientId, name, days });
      await api.plans.assignTraining(plan.id);
      queryCache.invalidate(QK.roster, QK.clientDetail(clientId), QK.trainingFor(clientId));
      patchDraft({ seed: { ...draft.seed, programName: name }, picked: [] });
      toast(t('pt.builder.toast_train_assigned', { first }));
    } finally {
      setAssigning(false);
    }
  }, [clientId, draft, first, library.data, patchDraft, t, toast]);

  const assignDiet = useCallback(async () => {
    if (!draft || !clientId) {
      return;
    }
    const name = draft.planName.trim();
    if (!name) {
      toast(t('pt.builder.err_needs_name'));
      return;
    }
    setAssigning(true);
    try {
      const plan = await api.plans.createDiet({
        clientId,
        name,
        kcal: fpPositiveInt(draft.kcal, draft.seed.kcal),
        protein: fpPositiveInt(draft.protein, draft.seed.protein),
        carbs: fpPositiveInt(draft.carbs, draft.seed.carbs),
        fat: fpPositiveInt(draft.fat, draft.seed.fat),
        meals: draft.meals.map((m, i) => ({ ...m, order: i })),
      });
      await api.plans.assignDiet(plan.id);
      queryCache.invalidate(QK.roster, QK.clientDetail(clientId), QK.dietFor(clientId));
      patchDraft({ seed: { ...draft.seed, planName: name }, mealsSeeded: true });
      toast(t('pt.builder.toast_diet_assigned', { first }));
    } finally {
      setAssigning(false);
    }
  }, [clientId, draft, first, patchDraft, t, toast]);

  /* -------------------------------- render -------------------------------- */

  const header = (
    <FP_StickyHead>
      <View style={styles.headTitle}>
        <FP_ScreenTitle small>{t('pt.builder.title')}</FP_ScreenTitle>
      </View>
      <FP_CmsText k="pt.builder.subtitle" variant="sub" />

      <FP_ChipScroll style={styles.chips}>
        {entries.map(c => (
          <FP_Chip
            key={c.id}
            label={fpFirstName(c.name)}
            active={c.id === clientId}
            onPress={() => selectClient(c.id)}
          />
        ))}
      </FP_ChipScroll>

      <FP_Segmented
        style={styles.seg}
        options={KINDS}
        value={kind}
        onChange={selectKind}
        labelFor={option => t(option === 'train' ? 'pt.builder.tab_train' : 'pt.builder.tab_diet')}
      />
    </FP_StickyHead>
  );

  if (roster.error) {
    return (
      <FP_Screen header={header}>
        <FP_ErrorState
          title={t('common.error_generic')}
          message={roster.error.message}
          retryLabel={t('common.retry')}
          onRetry={roster.refresh}
        />
      </FP_Screen>
    );
  }

  if (roster.initialLoading) {
    return (
      <FP_Screen header={header}>
        <FP_Skeleton height={62} style={styles.block} />
        <FP_Skeleton height={62} style={styles.block} />
        <FP_Skeleton height={180} style={styles.block} />
      </FP_Screen>
    );
  }

  if (!selected || !draft) {
    return (
      <FP_Screen header={header}>
        <FP_EmptyState
          title={t('pt.builder.no_clients')}
          icon={<FP_Icon name="users" size={26} color={FP_COLORS.muted} />}
        />
      </FP_Screen>
    );
  }

  return (
    <FP_Screen header={header}>
      <FP_Textbox
        label={t('pt.builder.client_label')}
        value={selected.name}
        editable={false}
        containerStyle={styles.firstField}
      />

      {kind === 'train' ? (
        <>
          <FP_Textbox
            label={t('pt.builder.program_label')}
            placeholder={t('pt.builder.program_ph')}
            value={draft.programName}
            onChangeText={text => patchDraft({ programName: text })}
          />

          <FP_CmsText k="pt.builder.start_from" variant="label" style={styles.startFromLabel} />
          <FP_ChipScroll style={styles.chipsTight}>
            <FP_Chip
              label={t('pt.builder.start_template')}
              active={draft.startFrom === 'template'}
              onPress={() => patchDraft({ startFrom: 'template' })}
            />
            <FP_Chip
              label={t('pt.builder.start_blank')}
              active={draft.startFrom === 'blank'}
              onPress={() => patchDraft({ startFrom: 'blank' })}
            />
          </FP_ChipScroll>

          <FP_PtSectionHead k="pt.builder.library_title" />
          <FP_SearchInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={t('pt.builder.search_ph')}
          />

          {library.error ? (
            <FP_ErrorState
              title={t('common.error_generic')}
              message={library.error.message}
              retryLabel={t('common.retry')}
              onRetry={library.refresh}
            />
          ) : library.initialLoading ? (
            <View style={styles.block}>
              <FP_Skeleton height={56} style={styles.rowSkeleton} />
              <FP_Skeleton height={56} style={styles.rowSkeleton} />
              <FP_Skeleton height={56} style={styles.rowSkeleton} />
            </View>
          ) : (library.data ?? []).length === 0 ? (
            <FP_EmptyState
              title={t('common.empty_generic')}
              icon={<FP_Icon name="search" size={24} color={FP_COLORS.muted} />}
            />
          ) : (
            <View style={styles.block}>
              {(library.data ?? []).map((exercise, index, all) => {
                const added = draft.picked.includes(exercise.id);
                return (
                  <FP_ListItem
                    key={exercise.id}
                    last={index === all.length - 1}
                    title={exercise.name}
                    subtitle={
                      exercise.type ??
                      [exercise.muscleGroup, exercise.equipment].filter(Boolean).join(' · ')
                    }
                    right={
                      <FP_Chip
                        small
                        active={added}
                        label={t(added ? 'pt.builder.cta_added' : 'pt.builder.cta_add')}
                        onPress={() =>
                          patchDraft({
                            picked: added
                              ? draft.picked.filter(id => id !== exercise.id)
                              : [...draft.picked, exercise.id],
                          })
                        }
                      />
                    }
                  />
                );
              })}
            </View>
          )}

          <FP_Button
            style={styles.cta}
            loading={assigning}
            title={t('pt.builder.cta_assign_train', { first })}
            onPress={assignTraining}
          />
        </>
      ) : (
        <>
          <FP_Textbox
            label={t('pt.builder.plan_label')}
            placeholder={t('pt.builder.plan_ph')}
            value={draft.planName}
            onChangeText={text => patchDraft({ planName: text })}
          />

          <FP_PtSectionHead k="pt.builder.daily_targets" />
          <FP_Textbox
            label={t('pt.builder.kcal_label')}
            keyboardType="number-pad"
            value={draft.kcal}
            onChangeText={text => patchDraft({ kcal: text })}
            containerStyle={styles.kcalField}
          />
          <FP_Row gap={FP_SPACING.sm} align="flex-start">
            <FP_Column grow>
              <FP_Textbox
                label={t('pt.builder.protein_label')}
                keyboardType="number-pad"
                value={draft.protein}
                onChangeText={text => patchDraft({ protein: text })}
              />
            </FP_Column>
            <FP_Column grow>
              <FP_Textbox
                label={t('pt.builder.carbs_label')}
                keyboardType="number-pad"
                value={draft.carbs}
                onChangeText={text => patchDraft({ carbs: text })}
              />
            </FP_Column>
            <FP_Column grow>
              <FP_Textbox
                label={t('pt.builder.fat_label')}
                keyboardType="number-pad"
                value={draft.fat}
                onChangeText={text => patchDraft({ fat: text })}
              />
            </FP_Column>
          </FP_Row>

          <FP_Row between style={styles.mealsHead}>
            <FP_CmsText k="pt.builder.meals" variant="sectionTitle" />
            <FP_Badge
              tone={over ? 'warn' : 'ok'}
              label={t('pt.builder.kcal_badge', {
                total: fpGroupNumber(totalKcal),
                target: fpGroupNumber(targetKcal),
              })}
            />
          </FP_Row>

          <FP_Card style={styles.mealsCard}>
            {draft.meals.length === 0 ? (
              <FP_CmsText k="pt.builder.no_meals" variant="sub" style={styles.noMeals} />
            ) : (
              draft.meals.map((meal, index) => (
                <FP_ListItem
                  key={`${meal.slot}-${index}`}
                  last={index === draft.meals.length - 1}
                  left={
                    <FP_Avatar
                      size={38}
                      glyph={<FP_Icon name="meal" size={18} color={FP_COLORS.onAccent} />}
                    />
                  }
                  title={meal.slot}
                  subtitle={`${meal.food} · ${meal.kcal} kcal`}
                  onPressBody={() => openMealSheet(index)}
                  right={
                    <FP_IconButton
                      size={36}
                      accessibilityLabel={meal.slot}
                      onPress={() => removeMeal(index)}
                    >
                      <FP_Icon name="trash" size={16} color={FP_COLORS.muted} />
                    </FP_IconButton>
                  }
                />
              ))
            )}
            <FP_Button
              variant="ghost"
              style={styles.addMeal}
              title={t('pt.builder.add_meal')}
              onPress={() => openMealSheet(-1)}
            />
          </FP_Card>

          <FP_Button
            style={styles.cta}
            loading={assigning}
            title={t('pt.builder.cta_assign_diet', { first })}
            onPress={assignDiet}
          />
        </>
      )}

      <FP_BottomSheet visible={mealIndex !== null} onClose={() => setMealIndex(null)}>
        <FP_PtSheetHead
          title={t(
            mealIndex !== null && mealIndex >= 0
              ? 'pt.builder.meal_edit_title'
              : 'pt.builder.meal_add_title',
          )}
          subtitle={`${selected.name} · ${draft.planName.trim() || t('pt.builder.new_plan')}`}
        />

        <FP_ChipScroll style={styles.chips}>
          {MEAL_SLOTS.map(slot => (
            <FP_Chip
              key={slot}
              label={slot}
              active={mealForm.slot === slot}
              onPress={() => {
                setMealForm(prev => ({ ...prev, slot }));
                setMealErrors(prev => ({ ...prev, slot: false }));
              }}
            />
          ))}
        </FP_ChipScroll>

        <FP_Textbox
          label={t('pt.builder.meal_slot_label')}
          placeholder={t('pt.builder.meal_slot_ph')}
          value={mealForm.slot}
          onChangeText={text => setMealForm(prev => ({ ...prev, slot: text }))}
          error={mealErrors.slot ? t('pt.builder.meal_err_slot') : null}
        />
        <FP_Textbox
          label={t('pt.builder.meal_food_label')}
          placeholder={t('pt.builder.meal_food_ph')}
          value={mealForm.food}
          onChangeText={text => setMealForm(prev => ({ ...prev, food: text }))}
          error={mealErrors.food ? t('pt.builder.meal_err_food') : null}
        />
        <FP_Textbox
          label={t('pt.builder.meal_kcal_label')}
          placeholder={t('pt.builder.meal_kcal_ph')}
          keyboardType="number-pad"
          value={mealForm.kcal}
          onChangeText={text => setMealForm(prev => ({ ...prev, kcal: text }))}
          error={mealErrors.kcal ? t('pt.builder.meal_err_kcal') : null}
        />

        <FP_Button
          style={styles.cta}
          title={t(
            mealIndex !== null && mealIndex >= 0
              ? 'pt.builder.meal_cta_save'
              : 'pt.builder.meal_cta_add',
          )}
          onPress={saveMeal}
        />
      </FP_BottomSheet>
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  headTitle: { paddingTop: 6, paddingBottom: 2 },
  chips: { marginTop: FP_SPACING.md },
  chipsTight: { marginTop: FP_SPACING.sm },
  seg: { marginTop: FP_SPACING.md },
  firstField: { marginTop: 18 },
  startFromLabel: { marginTop: FP_SPACING.xl, fontWeight: '700' },
  search: { marginTop: FP_SPACING.sm },
  block: { marginTop: FP_SPACING.md },
  rowSkeleton: { marginTop: FP_SPACING.sm },
  kcalField: { marginTop: FP_SPACING.sm },
  mealsHead: { marginTop: FP_SPACING.xxl },
  mealsCard: { marginTop: FP_SPACING.md },
  noMeals: { textAlign: 'center', paddingVertical: 18 },
  addMeal: { marginTop: FP_SPACING.lg },
  cta: { marginTop: FP_SPACING.xl },
});

export default PlansScreen;
