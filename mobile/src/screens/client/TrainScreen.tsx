/**
 * Client · Train (docs/prototype.html `SCREENS.workouts` + `weekSheet` / `daySheet` /
 * `playExercise` / `finishSession` / `logExerciseSheet`).
 *
 * This week / Program / History filter → the plan card with the day ring → today's exercise
 * checklist with per-exercise demo sheets → session progress → "Check off session ✓" and
 * "+ Log an exercise" → the "Up next" locked card.
 *
 * `doneDays` / `totalDays` / `currentDayIndex` come straight off `GET /plans/training/me`; the
 * screen never recomputes them.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@firon/shared';
import type { Exercise, PlanDay, PlanExercise, TrainingPlan } from '@firon/shared';
import {
  FP_AppHeader,
  FP_Badge,
  FP_BottomSheet,
  FP_Button,
  FP_Card,
  FP_Checkbox,
  FP_Chip,
  FP_ChipScroll,
  FP_CmsText,
  FP_Divider,
  FP_EmptyState,
  FP_ErrorState,
  FP_Icon,
  FP_IconButton,
  FP_KeyValueRow,
  FP_ListItem,
  FP_ProgressRing,
  FP_Row,
  FP_Screen,
  FP_Skeleton,
  FP_StatCard,
  FP_Textbox,
  FP_Thumb,
  FP_VideoPlayer,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import useResource from '../../store/useResource';
import { QK } from '../../store/queryCache';
import { PREVIEW_TRAINING_PLAN } from '../../guest/previewData';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../../theme';
import { TAB_BAR_CLEARANCE, useClientContext } from './useClientContext';
import FP_SectionHeader from './components/FP_SectionHeader';

/** Decorative prototype glyphs (not copy). */
const GLYPH_TICK = '✓';
const GLYPH_CHEVRON = '›';
const GLYPH_PARTY = '🎉';
/** The demo tile uses the prototype's 4th gradient. */
const DEMO_GRADIENT = 3;

type TrainFilter = 'week' | 'program' | 'history';
const FILTERS: ReadonlyArray<{ id: TrainFilter; key: string }> = [
  { id: 'week', key: 'train.filter_week' },
  { id: 'program', key: 'train.filter_program' },
  { id: 'history', key: 'train.filter_history' },
];

interface LogForm {
  name: string;
  sets: string;
  reps: string;
  weight: string;
  notes: string;
}
const EMPTY_LOG: LogForm = { name: '', sets: '', reps: '', weight: '', notes: '' };

/** Snapshot taken when a session is checked off — the plan's "today" has moved on by then. */
interface CompletedSession {
  title: string;
  dayLabel: string;
  minutes: number;
  exercises: number;
  doneDays: number;
  totalDays: number;
}

export const TrainScreen: React.FC = () => {
  const { t } = useContent();
  const { toast } = useToast();
  const { isGuest, coach } = useClientContext();

  const [filter, setFilter] = useState<TrainFilter>('week');
  const [weekOpen, setWeekOpen] = useState(false);
  const [dayIndexOpen, setDayIndexOpen] = useState<number | null>(null);
  const [demo, setDemo] = useState<PlanExercise | null>(null);
  const [completed, setCompleted] = useState<CompletedSession | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState<LogForm>(EMPTY_LOG);
  const [logError, setLogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = useResource<TrainingPlan | null>(QK.trainingPlan, () => api.plans.myTraining(), {
    enabled: !isGuest,
  });
  const presets = useResource<Exercise[]>(
    'train.presets',
    async () => (await api.exercises.list({ limit: 8 })).data,
    { enabled: !isGuest && logOpen },
  );

  const activePlan = isGuest ? PREVIEW_TRAINING_PLAN : plan.data ?? null;
  const days = activePlan?.days ?? [];
  const today: PlanDay | null = activePlan ? days[activePlan.currentDayIndex] ?? null : null;
  const upNext: PlanDay | null = activePlan ? days[activePlan.currentDayIndex + 1] ?? null : null;

  const doneExercises = today ? today.exercises.filter(e => e.done).length : 0;
  const totalExercises = today?.exercises.length ?? 0;

  const updatedLabel = useMemo(
    () => (activePlan ? new Date(activePlan.updatedAt).toLocaleDateString() : ''),
    [activePlan],
  );

  /* ---------------- mutations ---------------- */

  const toggleExercise = useCallback(
    async (exIndex: number) => {
      if (!activePlan || !today || isGuest) {
        return;
      }
      /* optimistic — the shared proxy pops the dialog if the write fails */
      plan.setData(prev => {
        if (!prev) {
          return null;
        }
        return {
          ...prev,
          days: prev.days.map(day =>
            day.dayIndex === today.dayIndex
              ? {
                  ...day,
                  exercises: day.exercises.map((ex, i) =>
                    i === exIndex ? { ...ex, done: !ex.done } : ex,
                  ),
                }
              : day,
          ),
        };
      });
      const next = await api.plans.toggleExercise(activePlan.id, today.dayIndex, exIndex);
      plan.setData(next);
    },
    [activePlan, today, isGuest, plan],
  );

  const completeSession = useCallback(async () => {
    if (!activePlan || !today || isGuest) {
      return;
    }
    setBusy(true);
    try {
      const next = await api.plans.completeDay(activePlan.id, today.dayIndex, {
        durationMin: today.durationMin,
      });
      plan.setData(next);
      setCompleted({
        title: today.title,
        dayLabel: today.dayLabel,
        minutes: today.durationMin,
        exercises: today.exercises.length,
        doneDays: next.doneDays,
        totalDays: next.totalDays,
      });
    } finally {
      setBusy(false);
    }
  }, [activePlan, today, isGuest, plan]);

  const submitLog = useCallback(async () => {
    if (!activePlan || !today) {
      return;
    }
    const name = logForm.name.trim();
    if (!name) {
      setLogError(t('train.log_err_name'));
      return;
    }
    setLogError(null);
    setBusy(true);
    try {
      const next = await api.plans.logExercise(activePlan.id, today.dayIndex, {
        name,
        sets: logForm.sets ? Number(logForm.sets) : undefined,
        reps: logForm.reps ? Number(logForm.reps) : undefined,
        weightKg: logForm.weight ? Number(logForm.weight) : undefined,
        notes: logForm.notes.trim() || undefined,
      });
      plan.setData(next);
      setLogOpen(false);
      setLogForm(EMPTY_LOG);
      toast(`${name} · ${t('train.badge_logged')}`);
    } finally {
      setBusy(false);
    }
  }, [activePlan, today, logForm, plan, t, toast]);

  /* ---------------- sheets ---------------- */

  const dayBadge = (day: PlanDay) => {
    if (day.status === 'done') {
      return <FP_Badge label={t('train.badge_completed')} tone="ok" />;
    }
    if (day.status === 'now') {
      return <FP_Badge label={t('train.badge_here')} tone="pt" />;
    }
    return <FP_Badge label={t('train.badge_upcoming')} tone="warn" />;
  };

  const dayOpen = dayIndexOpen !== null ? days[dayIndexOpen] ?? null : null;

  const closeDaySheet = useCallback(() => setDayIndexOpen(null), []);

  const handleDayAction = useCallback(() => {
    if (!dayOpen) {
      return;
    }
    const status = dayOpen.status;
    closeDaySheet();
    if (status === 'done') {
      toast(t('train.toast_already_done'));
    } else if (status === 'todo') {
      toast(t('train.toast_unlocks', { day: dayOpen.dayLabel }));
    }
  }, [dayOpen, closeDaySheet, toast, t]);

  /* ---------------- render helpers ---------------- */

  const renderDayList = (list: PlanDay[]) => (
    <View>
      {list.map((day, i) => (
        <FP_ListItem
          key={day.dayIndex}
          last={i === list.length - 1}
          left={
            <FP_Checkbox
              checked={day.status === 'done'}
              glyph={String(day.dayIndex + 1)}
              glyphStyle={day.status === 'now' ? styles.dayGlyphNow : styles.dayGlyph}
              style={day.status === 'now' ? styles.dayBoxNow : undefined}
            />
          }
          title={day.title}
          subtitle={`${day.dayLabel} · ${day.durationMin} ${t('train.complete_minutes')}`}
          done={day.status === 'done'}
          right={
            day.status === 'now' ? (
              <FP_Badge label={t('train.badge_today')} tone="pt" />
            ) : day.status === 'todo' ? (
              <FP_Badge label={t('train.locked_badge')} tone="warn" />
            ) : undefined
          }
          onPress={() => {
            setWeekOpen(false);
            setDayIndexOpen(day.dayIndex);
          }}
        />
      ))}
    </View>
  );

  /* ---------------- states ---------------- */

  if (!isGuest && plan.initialLoading) {
    return (
      <FP_Screen bottomInset={TAB_BAR_CLEARANCE}>
        <FP_AppHeader title={t('train.title')} large />
        <FP_Skeleton height={18} width="70%" style={styles.block} />
        <FP_Skeleton height={44} style={styles.block} />
        <FP_Skeleton height={320} style={styles.block} />
      </FP_Screen>
    );
  }

  if (!isGuest && plan.error && !plan.data) {
    return (
      <FP_Screen bottomInset={TAB_BAR_CLEARANCE}>
        <FP_AppHeader title={t('train.title')} large />
        <FP_ErrorState
          title={t('common.error_generic')}
          message={plan.error.message}
          retryLabel={t('common.retry')}
          onRetry={plan.refresh}
          style={styles.block}
        />
      </FP_Screen>
    );
  }

  return (
    <FP_Screen
      onRefresh={isGuest ? undefined : plan.refresh}
      refreshing={plan.loading}
      bottomInset={TAB_BAR_CLEARANCE}
    >
      <FP_AppHeader title={t('train.title')} large />
      <CmsSubtitle coach={coach} when={updatedLabel} />

      <FP_ChipScroll style={styles.block}>
        {FILTERS.map(f => (
          <FP_Chip
            key={f.id}
            label={t(f.key)}
            active={filter === f.id}
            onPress={() => setFilter(f.id)}
          />
        ))}
      </FP_ChipScroll>

      {!activePlan ? (
        <FP_EmptyState
          title={t('train.empty_title')}
          message={t('train.empty_sub', { coach })}
          icon={<FP_Icon name="dumbbell" size={28} color={FP_COLORS.muted} />}
          style={styles.block}
        />
      ) : filter === 'program' ? (
        <FP_Card style={styles.block}>{renderDayList(days)}</FP_Card>
      ) : filter === 'history' ? (
        days.some(d => d.status === 'done') ? (
          <FP_Card style={styles.block}>
            {renderDayList(days.filter(d => d.status === 'done'))}
          </FP_Card>
        ) : (
          <FP_EmptyState title={t('common.empty_generic')} style={styles.block} />
        )
      ) : (
        <>
          <FP_Card style={styles.block}>
            {/* plan header → week overview sheet */}
            <FP_Row gap={FP_SPACING.md} style={styles.planHead}>
              <FP_ProgressRing
                progress={activePlan.totalDays ? activePlan.doneDays / activePlan.totalDays : 0}
                size={64}
                innerSize={48}
              >
                <Text style={styles.ringValue}>
                  {activePlan.currentDayIndex + 1}/{activePlan.totalDays}
                </Text>
                <Text style={styles.ringLabel}>{t('train.days_label')}</Text>
              </FP_ProgressRing>
              <View style={styles.flex}>
                <Text style={FP_TYPE.bodyBold}>{today?.title ?? activePlan.name}</Text>
                <Text style={[FP_TYPE.sub, styles.gapTop]}>
                  {t('train.days_done', {
                    done: activePlan.doneDays,
                    total: activePlan.totalDays,
                    min: today?.durationMin ?? 0,
                  })}
                </Text>
              </View>
              <FP_IconButton
                accessibilityLabel={t('train.week_title')}
                size={36}
                onPress={() => setWeekOpen(true)}
              >
                <Text style={styles.chevron}>{GLYPH_CHEVRON}</Text>
              </FP_IconButton>
            </FP_Row>

            <FP_Divider />

            {/* today's checklist */}
            {today?.exercises.map((ex, i) => (
              <FP_ListItem
                key={`${ex.name}-${i}`}
                last={i === totalExercises - 1}
                left={<FP_Checkbox checked={ex.done} onPress={() => void toggleExercise(i)} />}
                title={ex.name}
                subtitle={
                  ex.prescription || (ex.loggedByClient ? t('train.log_fallback') : undefined)
                }
                done={ex.done}
                titleAdornment={
                  ex.loggedByClient ? (
                    <FP_Badge label={t('train.badge_logged')} tone="ok" />
                  ) : undefined
                }
                right={
                  <FP_IconButton
                    size={36}
                    accessibilityLabel={t('train.demo_title')}
                    onPress={() => setDemo(ex)}
                  >
                    <FP_Icon name="play" size={16} color={FP_COLORS.text} />
                  </FP_IconButton>
                }
              />
            ))}

            <FP_Divider />

            <FP_Row between>
              <FP_CmsText k="train.session_progress" variant="sub" />
              <Text style={styles.progressValue}>
                {doneExercises} / {totalExercises}
              </Text>
            </FP_Row>

            <FP_Button
              title={t('train.cta_check_off')}
              loading={busy}
              onPress={() => void completeSession()}
              style={styles.block}
            />
            <FP_Button
              variant="ghost"
              title={t('train.cta_log_exercise')}
              onPress={() => {
                setLogForm(EMPTY_LOG);
                setLogError(null);
                setLogOpen(true);
              }}
              style={styles.blockSm}
            />
          </FP_Card>

          {upNext ? (
            <View style={styles.section}>
              <FP_SectionHeader title={t('train.up_next')} />
              <FP_Card style={[styles.blockSm, styles.dim]}>
                <FP_Row between>
                  <View>
                    <Text style={FP_TYPE.bodyBold}>{upNext.title}</Text>
                    <Text style={[FP_TYPE.sub, styles.gapTop]}>
                      {t('train.up_next_sub', {
                        n: upNext.dayIndex + 1,
                        when: t('train.tomorrow'),
                      })}
                    </Text>
                  </View>
                  <FP_Badge label={t('train.locked_badge')} tone="warn" />
                </FP_Row>
              </FP_Card>
            </View>
          ) : null}
        </>
      )}

      {/* ---------- week overview sheet ---------- */}
      <FP_BottomSheet visible={weekOpen} onClose={() => setWeekOpen(false)}>
        <Text style={FP_TYPE.sheetTitle}>{t('train.week_title')}</Text>
        {activePlan ? (
          <Text style={[FP_TYPE.sub, styles.gapTop]}>
            {`${activePlan.name} · ${t('train.subtitle', { coach, when: updatedLabel })}`}
          </Text>
        ) : null}
        <FP_Card style={[styles.block, styles.center]}>
          <FP_ProgressRing
            progress={
              activePlan && activePlan.totalDays ? activePlan.doneDays / activePlan.totalDays : 0
            }
            size={104}
            innerSize={80}
          >
            <Text style={styles.ringValueLg}>
              {activePlan?.doneDays ?? 0}/{activePlan?.totalDays ?? 0}
            </Text>
            <Text style={styles.ringLabel}>{t('train.days_label')}</Text>
          </FP_ProgressRing>
        </FP_Card>
        <View style={styles.block}>{renderDayList(days)}</View>
        <FP_Button
          title={t('common.cta_close')}
          onPress={() => setWeekOpen(false)}
          style={styles.block}
        />
      </FP_BottomSheet>

      {/* ---------- per-day detail sheet ---------- */}
      <FP_BottomSheet visible={dayOpen !== null} onClose={closeDaySheet}>
        {dayOpen && activePlan ? (
          <>
            <FP_Row between>
              <Text style={FP_TYPE.sheetTitle}>{dayOpen.title}</Text>
              {dayBadge(dayOpen)}
            </FP_Row>
            <Text style={[FP_TYPE.sub, styles.gapTop]}>
              {t('train.day_of', {
                n: dayOpen.dayIndex + 1,
                total: activePlan.totalDays,
                dur: `${dayOpen.durationMin} ${t('train.complete_minutes')}`,
                coach,
              })}
            </Text>
            <FP_Card style={styles.block}>
              {dayOpen.exercises.map((ex, i) => (
                <FP_KeyValueRow
                  key={`${ex.name}-${i}`}
                  label={ex.name}
                  value={ex.done ? GLYPH_TICK : ''}
                  last={i === dayOpen.exercises.length - 1}
                />
              ))}
            </FP_Card>
            <FP_Button
              variant={dayOpen.status === 'now' ? 'primary' : 'ghost'}
              title={t(
                dayOpen.status === 'now'
                  ? 'train.cta_back_today'
                  : dayOpen.status === 'done'
                    ? 'train.cta_repeat'
                    : 'train.cta_locked',
              )}
              onPress={handleDayAction}
              style={styles.block}
            />
          </>
        ) : null}
      </FP_BottomSheet>

      {/* ---------- exercise demo sheet ---------- */}
      <FP_BottomSheet visible={demo !== null} onClose={() => setDemo(null)}>
        {demo ? (
          <>
            <Text style={FP_TYPE.sheetTitle}>{demo.name}</Text>
            <FP_CmsText k="train.demo_title" variant="sub" style={styles.gapTop} />
            <View style={styles.block}>
              {demo.demoUrl ? (
                <FP_VideoPlayer uri={demo.demoUrl} height={200} />
              ) : (
                <FP_Thumb gradientIndex={DEMO_GRADIENT} height={200} />
              )}
            </View>
            <Text style={[FP_TYPE.sub, styles.block]}>
              {demo.notes?.trim() || t('train.demo_cue_default')}
            </Text>
            <FP_Button
              title={t('common.cta_got_it')}
              onPress={() => setDemo(null)}
              style={styles.block}
            />
          </>
        ) : null}
      </FP_BottomSheet>

      {/* ---------- session complete sheet ---------- */}
      <FP_BottomSheet visible={completed !== null} onClose={() => setCompleted(null)}>
        {completed ? (
          <>
            <View style={styles.center}>
              <Text style={styles.party}>{GLYPH_PARTY}</Text>
              <FP_CmsText k="train.complete_title" variant="screenTitle" style={styles.gapTop} />
              <Text style={[FP_TYPE.sub, styles.gapTop]}>
                {t('train.complete_sub', { title: completed.title, day: completed.dayLabel })}
              </Text>
            </View>
            <FP_Row gap={FP_SPACING.md} style={styles.block}>
              <FP_StatCard
                accent
                value={String(completed.minutes)}
                label={t('train.complete_minutes')}
                style={styles.flex}
              />
              <FP_StatCard
                value={`${completed.exercises}/${completed.exercises}`}
                label={t('train.complete_exercises')}
                style={styles.flex}
              />
              <FP_StatCard
                value={`${completed.doneDays}/${completed.totalDays}`}
                label={t('train.complete_week')}
                style={styles.flex}
              />
            </FP_Row>
            <FP_Button
              title={t('common.cta_done')}
              onPress={() => setCompleted(null)}
              style={styles.block}
            />
          </>
        ) : null}
      </FP_BottomSheet>

      {/* ---------- log an exercise sheet ---------- */}
      <FP_BottomSheet visible={logOpen} onClose={() => setLogOpen(false)}>
        <Text style={FP_TYPE.sheetTitle}>{t('train.log_title')}</Text>
        <Text style={[FP_TYPE.sub, styles.gapTop]}>{t('train.log_sub', { coach })}</Text>

        <FP_ChipScroll style={styles.block}>
          {(presets.data ?? []).map(ex => (
            <FP_Chip
              key={ex.id}
              label={ex.name}
              active={logForm.name === ex.name}
              onPress={() => {
                setLogForm(form => ({ ...form, name: ex.name }));
                setLogError(null);
              }}
            />
          ))}
        </FP_ChipScroll>

        <FP_Textbox
          label={t('train.log_name_label')}
          placeholder={t('train.log_name_ph')}
          value={logForm.name}
          error={logError}
          onChangeText={value => setLogForm(form => ({ ...form, name: value }))}
        />
        <FP_Row gap={FP_SPACING.sm} style={styles.blockSm}>
          <FP_Textbox
            placeholder={t('train.log_sets_ph')}
            keyboardType="number-pad"
            value={logForm.sets}
            containerStyle={styles.flex}
            onChangeText={value => setLogForm(form => ({ ...form, sets: value }))}
          />
          <FP_Textbox
            placeholder={t('train.log_reps_ph')}
            keyboardType="number-pad"
            value={logForm.reps}
            containerStyle={styles.flex}
            onChangeText={value => setLogForm(form => ({ ...form, reps: value }))}
          />
          <FP_Textbox
            placeholder={t('train.log_weight_ph')}
            keyboardType="decimal-pad"
            value={logForm.weight}
            containerStyle={styles.flex}
            onChangeText={value => setLogForm(form => ({ ...form, weight: value }))}
          />
        </FP_Row>
        <FP_Textbox
          label={t('train.log_notes_label')}
          placeholder={t('train.log_notes_ph')}
          value={logForm.notes}
          containerStyle={styles.blockSm}
          onChangeText={value => setLogForm(form => ({ ...form, notes: value }))}
        />
        <FP_Button
          title={t('train.log_submit')}
          loading={busy}
          onPress={() => void submitLog()}
          style={styles.block}
        />
      </FP_BottomSheet>
    </FP_Screen>
  );
};

/** `train.subtitle` needs two interpolations, so it gets its own tiny presenter. */
const CmsSubtitle: React.FC<{ coach: string; when: string }> = ({ coach, when }) => (
  <FP_CmsText k="train.subtitle" vars={{ coach, when }} variant="sub" />
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginTop: FP_SPACING.lg },
  blockSm: { marginTop: FP_SPACING.md },
  section: { marginTop: FP_SPACING.xxl },
  gapTop: { marginTop: FP_SPACING.sm },
  planHead: { paddingBottom: FP_SPACING.xs },
  center: { alignItems: 'center' },
  dim: { opacity: 0.7 },
  chevron: { ...FP_TYPE.body, color: FP_COLORS.muted },
  ringValue: { fontSize: 14, fontWeight: '800', color: FP_COLORS.text },
  ringValueLg: { fontSize: 20, fontWeight: '800', color: FP_COLORS.text },
  ringLabel: { ...FP_TYPE.tiny, fontSize: 9.5 },
  progressValue: { ...FP_TYPE.bodyBold, color: FP_COLORS.accent },
  dayGlyph: { fontSize: 12, fontWeight: '700', color: FP_COLORS.muted },
  dayGlyphNow: { fontSize: 12, fontWeight: '700', color: FP_COLORS.accent },
  dayBoxNow: { borderColor: FP_COLORS.accent },
  party: { fontSize: 52 },
});

export default TrainScreen;
