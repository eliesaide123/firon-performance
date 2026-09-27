/**
 * Client · Nutrition (docs/prototype.html `SCREENS.nutrition` + `toggleMeal` + `logMealSheet`).
 *
 * The big kcal ring → the protein / carbs / fat row → today's meals with check-off → "Log a meal".
 *
 * `GET /nutrition/today` merges the active diet plan with today's `MealLog` rows, so each row
 * carries the plan `index` (plan meals) or a `logId` (manually logged meals); checking a row off
 * routes to the matching endpoint and the ring follows the rows, never a separate counter.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@firon/shared';
import type { NutritionToday } from '@firon/shared';
import {
  FP_AppHeader,
  FP_BottomSheet,
  FP_Button,
  FP_Card,
  FP_Checkbox,
  FP_CmsText,
  FP_EmptyState,
  FP_ErrorState,
  FP_Icon,
  FP_IconButton,
  FP_ListItem,
  FP_MealRing,
  FP_Row,
  FP_Screen,
  FP_Skeleton,
  FP_StatCard,
  FP_Textbox,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import useResource from '../../store/useResource';
import { PREVIEW_DIET_PLAN } from '../../guest/previewData';
import type { RootStackParamList } from '../../navigation/types';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../../theme';
import { TAB_BAR_CLEARANCE, useClientContext } from './useClientContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * View model for one meal row. `GET /nutrition/today` returns the plan `index` and the `logId`
 * alongside the `MealLog` fields the shared DTO names; both are needed to know which endpoint
 * a check-off should call, so the rows are normalised into this shape once.
 */
interface MealRow {
  key: string;
  slot: string;
  food: string;
  kcal: number;
  consumed: boolean;
  /** plan-meal position, or null for a manually logged meal */
  index: number | null;
  logId: string | null;
}

/**
 * `index` is the meal's position inside the diet plan and is what `plans.toggleMeal` expects;
 * a manually logged meal has `index: null` and a `logId` for `nutrition.toggleLog`. The array
 * position is NOT a safe toggle index because manual meals are interleaved.
 */
type RawMeal = NutritionToday['meals'][number];

interface LogForm {
  meal: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}
const EMPTY_LOG: LogForm = { meal: '', kcal: '', protein: '', carbs: '', fat: '' };
/** `slot` is capped at 40 chars server-side; the food description carries the full text. */
const SLOT_MAX = 40;

export const NutritionScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useContent();
  const { toast } = useToast();
  const { isGuest, coach } = useClientContext();

  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState<LogForm>(EMPTY_LOG);
  const [logError, setLogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = useResource<NutritionToday>('nutrition.today', () => api.nutrition.today(), {
    enabled: !isGuest,
  });

  const rows: MealRow[] = useMemo(() => {
    if (isGuest) {
      return PREVIEW_DIET_PLAN.meals.map((m, i) => ({
        key: `preview-${i}`,
        slot: m.slot,
        food: m.food,
        kcal: m.kcal,
        consumed: Boolean(m.consumed),
        index: i,
        logId: null,
      }));
    }
    return ((today.data?.meals ?? []) as RawMeal[]).map((m, i) => ({
      key: m.logId ?? `meal-${i}`,
      slot: m.slot,
      food: m.food,
      kcal: m.kcal,
      consumed: Boolean(m.consumed),
      index: typeof m.index === 'number' ? m.index : null,
      logId: m.logId ?? null,
    }));
  }, [isGuest, today.data]);

  const targets = isGuest
    ? {
        kcal: PREVIEW_DIET_PLAN.kcal,
        protein: PREVIEW_DIET_PLAN.protein,
        carbs: PREVIEW_DIET_PLAN.carbs,
        fat: PREVIEW_DIET_PLAN.fat,
      }
    : today.data?.targets ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  const planName = isGuest ? PREVIEW_DIET_PLAN.name : today.data?.plan?.name ?? null;
  const planId = isGuest ? PREVIEW_DIET_PLAN.id : today.data?.plan?.id ?? null;

  /** The ring follows the checkboxes — the prototype's `kcal-now` behaviour. */
  const consumedKcal = useMemo(
    () => rows.filter(r => r.consumed).reduce((sum, r) => sum + r.kcal, 0),
    [rows],
  );

  /* ---------------- mutations ---------------- */

  const toggleMeal = useCallback(
    async (row: MealRow, position: number) => {
      if (isGuest) {
        return;
      }
      /* optimistic: flip the row so the ring moves immediately */
      const current = today.data;
      if (current) {
        today.setData({
          ...current,
          meals: current.meals.map((m, i) =>
            i === position ? { ...m, consumed: !m.consumed } : m,
          ),
        });
      }
      if (row.index !== null && planId) {
        await api.plans.toggleMeal(planId, row.index);
      } else if (row.logId) {
        await api.nutrition.toggleLog(row.logId);
      }
      await today.refresh();
    },
    [isGuest, today, planId],
  );

  const submitLog = useCallback(async () => {
    const meal = logForm.meal.trim();
    const kcal = Number(logForm.kcal);
    if (!meal || !Number.isFinite(kcal) || kcal <= 0) {
      setLogError(t('nutrition.log_err'));
      return;
    }
    setLogError(null);
    setBusy(true);
    try {
      await api.nutrition.log({
        slot: meal.slice(0, SLOT_MAX),
        food: meal,
        kcal,
        protein: logForm.protein ? Number(logForm.protein) : undefined,
        carbs: logForm.carbs ? Number(logForm.carbs) : undefined,
        fat: logForm.fat ? Number(logForm.fat) : undefined,
      });
      setLogOpen(false);
      setLogForm(EMPTY_LOG);
      toast(t('nutrition.toast_logged'));
      await today.refresh();
    } finally {
      setBusy(false);
    }
  }, [logForm, t, toast, today]);

  /* ---------------- render ---------------- */

  const header = (
    <FP_AppHeader
      left={
        <FP_IconButton
          accessibilityLabel={t('common.cta_back')}
          guestAllowed
          onPress={() => navigation.goBack()}
        >
          <FP_Icon name="chevron-left" size={20} color={FP_COLORS.text} />
        </FP_IconButton>
      }
      title={t('nutrition.title')}
      large
    />
  );

  if (!isGuest && today.initialLoading) {
    return (
      <FP_Screen bottomInset={TAB_BAR_CLEARANCE}>
        {header}
        <FP_Skeleton height={18} width="60%" style={styles.gapTop} />
        <FP_Skeleton height={230} style={styles.block} />
        <FP_Skeleton height={180} style={styles.block} />
      </FP_Screen>
    );
  }

  if (!isGuest && today.error && !today.data) {
    return (
      <FP_Screen bottomInset={TAB_BAR_CLEARANCE}>
        {header}
        <FP_ErrorState
          title={t('common.error_generic')}
          message={today.error.message}
          retryLabel={t('common.retry')}
          onRetry={today.refresh}
          style={styles.block}
        />
      </FP_Screen>
    );
  }

  return (
    <FP_Screen
      onRefresh={isGuest ? undefined : today.refresh}
      refreshing={today.loading}
      bottomInset={TAB_BAR_CLEARANCE}
    >
      {header}
      {planName ? (
        <FP_CmsText
          k="nutrition.subtitle"
          vars={{ plan: planName, coach }}
          variant="sub"
          style={styles.gapTop}
        />
      ) : (
        <FP_CmsText k="nutrition.no_plan" variant="sub" style={styles.gapTop} />
      )}

      <FP_Card style={[styles.block, styles.center]}>
        <FP_MealRing
          consumedKcal={consumedKcal}
          targetKcal={targets.kcal}
          targetLabel={t('nutrition.kcal_of', { target: targets.kcal.toLocaleString() })}
        />
        <FP_Row gap={FP_SPACING.sm} style={styles.macros}>
          <FP_StatCard
            dense
            value={`${targets.protein}g`}
            label={t('nutrition.protein')}
            style={styles.flex}
          />
          <FP_StatCard
            dense
            value={`${targets.carbs}g`}
            label={t('nutrition.carbs')}
            style={styles.flex}
          />
          <FP_StatCard
            dense
            value={`${targets.fat}g`}
            label={t('nutrition.fat')}
            style={styles.flex}
          />
        </FP_Row>
      </FP_Card>

      <FP_CmsText k="nutrition.todays_meals" variant="sectionTitle" style={styles.section} />

      {rows.length === 0 ? (
        <FP_EmptyState
          title={t('nutrition.empty')}
          icon={<FP_Icon name="meal" size={28} color={FP_COLORS.muted} />}
          style={styles.block}
        />
      ) : (
        <View style={styles.list}>
          {rows.map((row, i) => (
            <FP_ListItem
              key={row.key}
              last={i === rows.length - 1}
              left={
                <FP_Checkbox
                  checked={row.consumed}
                  accessibilityLabel={row.slot}
                  onPress={() => void toggleMeal(row, i)}
                />
              }
              title={row.slot}
              subtitle={row.food}
              done={row.consumed}
              right={
                <Text style={styles.kcal}>
                  {row.kcal}
                  <Text style={FP_TYPE.sub}> {t('nutrition.kcal_unit')}</Text>
                </Text>
              }
            />
          ))}
        </View>
      )}

      <FP_Button
        variant="ghost"
        title={t('nutrition.cta_log_meal')}
        onPress={() => {
          setLogForm(EMPTY_LOG);
          setLogError(null);
          setLogOpen(true);
        }}
        style={styles.block}
      />

      {/* ---------- log a meal sheet ---------- */}
      <FP_BottomSheet visible={logOpen} onClose={() => setLogOpen(false)}>
        <FP_CmsText k="nutrition.log_title" variant="sectionTitle" style={styles.sheetTitle} />
        <FP_Textbox
          label={t('nutrition.log_meal_label')}
          placeholder={t('nutrition.log_meal_ph')}
          value={logForm.meal}
          error={logError}
          containerStyle={styles.block}
          onChangeText={value => setLogForm(form => ({ ...form, meal: value }))}
        />
        <FP_Textbox
          label={t('nutrition.log_kcal_label')}
          placeholder={t('nutrition.log_kcal_ph')}
          keyboardType="number-pad"
          value={logForm.kcal}
          onChangeText={value => setLogForm(form => ({ ...form, kcal: value }))}
        />
        <FP_Row gap={FP_SPACING.sm} style={styles.blockSm}>
          <FP_Textbox
            placeholder={t('nutrition.log_protein_ph')}
            keyboardType="number-pad"
            value={logForm.protein}
            containerStyle={styles.flex}
            onChangeText={value => setLogForm(form => ({ ...form, protein: value }))}
          />
          <FP_Textbox
            placeholder={t('nutrition.log_carbs_ph')}
            keyboardType="number-pad"
            value={logForm.carbs}
            containerStyle={styles.flex}
            onChangeText={value => setLogForm(form => ({ ...form, carbs: value }))}
          />
          <FP_Textbox
            placeholder={t('nutrition.log_fat_ph')}
            keyboardType="number-pad"
            value={logForm.fat}
            containerStyle={styles.flex}
            onChangeText={value => setLogForm(form => ({ ...form, fat: value }))}
          />
        </FP_Row>
        <FP_Button
          title={t('nutrition.log_submit')}
          loading={busy}
          onPress={() => void submitLog()}
          style={styles.block}
        />
      </FP_BottomSheet>
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapTop: { marginTop: FP_SPACING.sm },
  block: { marginTop: FP_SPACING.lg },
  blockSm: { marginTop: FP_SPACING.md },
  section: { marginTop: FP_SPACING.xxl },
  list: { marginTop: FP_SPACING.sm },
  center: { alignItems: 'center' },
  macros: { marginTop: FP_SPACING.lg, alignSelf: 'stretch' },
  kcal: { ...FP_TYPE.bodyBold, fontSize: 14 },
  sheetTitle: { fontSize: 20 },
});

export default NutritionScreen;
