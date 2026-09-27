/**
 * Client · Home (docs/prototype.html `SCREENS.home`).
 *
 * Header (avatar + time-of-day greeting + search + bell) → the three stat cards → today's session
 * card → "Suggested for you" rail → "Continue watching" rail → the nutrition summary card.
 *
 * Guest preview (CONTRACT §13): no authenticated endpoint is called. The plan / nutrition numbers
 * come from `src/guest/previewData.ts` and the rails from the public `GET /videos`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@firon/shared';
import type { NutritionToday, SuggestedVideo, TrainingPlan, Video } from '@firon/shared';
import {
  FP_Avatar,
  FP_Badge,
  FP_Card,
  FP_ChipScroll,
  FP_CmsText,
  FP_ErrorState,
  FP_Icon,
  FP_IconButton,
  FP_MealRing,
  FP_Row,
  FP_Screen,
  FP_Skeleton,
  FP_StatCard,
  FP_AppHeader,
  FP_VideoPlayer,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useNotifications } from '../../store/NotificationsProvider';
import { useToast } from '../../components/FP_ToastProvider';
import useResource from '../../store/useResource';
import type { RootStackParamList } from '../../navigation/types';
import {
  PREVIEW_DIET_PLAN,
  PREVIEW_HOME_STATS,
  PREVIEW_TODAY_SESSION,
  PREVIEW_TRAINING_PLAN,
} from '../../guest/previewData';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../../theme';
import { TAB_BAR_CLEARANCE, useClientContext } from './useClientContext';
import FP_SectionHeader from './components/FP_SectionHeader';
import FP_TodayCard from './components/FP_TodayCard';
import FP_VideoRailCard from './components/FP_VideoRailCard';
import FP_VideoSheet from './components/FP_VideoSheet';

/** Decorative prototype glyphs (not copy — the CMS owns every string on this screen). */
const GLYPH_WAVE = '👋';
const GLYPH_SPARKLE = '✨';
const GLYPH_CHEVRON = '›';
const PROMO_KEY = 'home.promo_video';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t, media } = useContent();
  const { toast } = useToast();
  const { unread } = useNotifications();
  const { isGuest, user, trainer, coach, displayName, firstName, greeting } = useClientContext();

  const [openVideo, setOpenVideo] = useState<Video | null>(null);

  const plan = useResource<TrainingPlan | null>('plans.training.me', () => api.plans.myTraining(), {
    enabled: !isGuest,
  });
  const nutrition = useResource<NutritionToday>('nutrition.today', () => api.nutrition.today(), {
    enabled: !isGuest,
  });
  const suggested = useResource<SuggestedVideo[]>(
    'home.suggested',
    () => api.videos.suggested(),
    { enabled: !isGuest },
  );
  const continueWatching = useResource<Video[]>(
    'home.continue',
    () => api.videos.continueWatching(),
    { enabled: !isGuest },
  );
  /** Guest preview: the only video source that needs no token (CONTRACT §13.3). */
  const publicVideos = useResource<Video[]>(
    'home.public_videos',
    async () => (await api.videos.list({ limit: 6 })).data,
    { enabled: isGuest },
  );

  /* ---------------- derived ---------------- */

  const activePlan = isGuest ? PREVIEW_TRAINING_PLAN : plan.data ?? null;
  const today = activePlan?.days?.[activePlan.currentDayIndex] ?? null;

  const sessionsTarget =
    (isGuest ? PREVIEW_HOME_STATS.sessionsTarget : user?.clientProfile?.sessionsPerWeek) ??
    activePlan?.totalDays ??
    0;
  const sessionsDone = isGuest ? PREVIEW_HOME_STATS.sessionsDone : activePlan?.doneDays ?? 0;
  const planProgressPct = isGuest
    ? PREVIEW_HOME_STATS.planProgressPct
    : activePlan?.adherencePct ?? 0;
  const kcalToday = isGuest
    ? PREVIEW_HOME_STATS.kcalToday
    : nutrition.data?.consumed.kcal ?? 0;

  const targetKcal = isGuest ? PREVIEW_DIET_PLAN.kcal : nutrition.data?.targets.kcal ?? 0;
  const dietPlanName = isGuest ? PREVIEW_DIET_PLAN.name : nutrition.data?.plan?.name ?? null;

  const suggestedList: Video[] = useMemo(() => {
    if (isGuest) {
      return (publicVideos.data ?? []).filter(v => !v.progress).slice(0, 3);
    }
    return suggested.data ?? [];
  }, [isGuest, publicVideos.data, suggested.data]);

  const continueList: Video[] = useMemo(() => {
    if (isGuest) {
      return (publicVideos.data ?? []).filter(v => v.progress > 0).slice(0, 6);
    }
    return continueWatching.data ?? [];
  }, [isGuest, publicVideos.data, continueWatching.data]);

  const sessionMeta = isGuest ? PREVIEW_TODAY_SESSION.timeLabel : today?.dayLabel;
  const sessionSub = useMemo(() => {
    if (!today || !activePlan) {
      return undefined;
    }
    const parts = [
      t('train.day_of', {
        n: today.dayIndex + 1,
        total: activePlan.totalDays,
        dur: `${today.durationMin} ${t('train.complete_minutes')}`,
        coach,
      }),
    ];
    const studio = isGuest ? PREVIEW_TODAY_SESSION.studio : trainer?.studio;
    if (studio) {
      parts.push(studio);
    }
    return parts.join(' · ');
  }, [today, activePlan, coach, isGuest, trainer, t]);

  const nutritionSub = useMemo(() => {
    const macros = isGuest
      ? { protein: PREVIEW_DIET_PLAN.protein, carbs: PREVIEW_DIET_PLAN.carbs, fat: PREVIEW_DIET_PLAN.fat }
      : nutrition.data?.targets;
    const head = `${kcalToday.toLocaleString()} ${t('nutrition.kcal_of', {
      target: targetKcal.toLocaleString(),
    })}`;
    if (!macros) {
      return head;
    }
    return [
      head,
      `${t('nutrition.protein')} ${macros.protein}g`,
      `${t('nutrition.carbs')} ${macros.carbs}g`,
      `${t('nutrition.fat')} ${macros.fat}g`,
    ].join(' · ');
  }, [isGuest, nutrition.data, kcalToday, targetKcal, t]);

  /* ---------------- actions ---------------- */

  const refreshing =
    plan.loading || nutrition.loading || suggested.loading || continueWatching.loading;

  const refresh = useCallback(async () => {
    if (isGuest) {
      await publicVideos.refresh();
      return;
    }
    await Promise.all([
      plan.refresh(),
      nutrition.refresh(),
      suggested.refresh(),
      continueWatching.refresh(),
    ]);
  }, [isGuest, publicVideos, plan, nutrition, suggested, continueWatching]);

  const patchOpenVideo = useCallback((next: Video) => {
    setOpenVideo(current => (current && current.id === next.id ? next : current));
    const apply = (list: Video[] | undefined) =>
      (list ?? []).map(v => (v.id === next.id ? { ...v, ...next } : v));
    suggested.setData(prev => apply(prev) as SuggestedVideo[]);
    continueWatching.setData(prev => apply(prev));
    publicVideos.setData(prev => apply(prev));
  }, [suggested, continueWatching, publicVideos]);

  const handleStart = useCallback(
    async (video: Video) => {
      const resuming = video.progress > 0;
      setOpenVideo(null);
      toast(t(resuming ? 'videos.toast_resuming' : 'videos.toast_playing', { title: video.title }));
      if (isGuest) {
        return;
      }
      const nextProgress = resuming ? video.progress : 0.05;
      patchOpenVideo({ ...video, progress: nextProgress });
      await api.videos.setProgress(video.id, { progress: nextProgress });
      await continueWatching.refresh();
    },
    [isGuest, toast, t, patchOpenVideo, continueWatching],
  );

  const handleToggleFavorite = useCallback(
    async (video: Video) => {
      if (isGuest) {
        return;
      }
      const { favorite } = await api.videos.toggleFavorite(video.id);
      patchOpenVideo({ ...video, favorite });
      toast(t(favorite ? 'videos.toast_fav_added' : 'videos.toast_fav_removed'));
    },
    [isGuest, patchOpenVideo, toast, t],
  );

  const goVideos = useCallback(
    () => navigation.navigate('ClientTabs', { screen: 'Videos' }),
    [navigation],
  );

  /* ---------------- render ---------------- */

  const header = (
    <FP_AppHeader
      left={<FP_Avatar name={displayName} size={44} />}
      eyebrow={greeting}
      title={`${firstName} ${GLYPH_WAVE}`}
      right={
        <FP_Row gap={FP_SPACING.sm}>
          <FP_IconButton
            accessibilityLabel={t('search.title')}
            onPress={() => navigation.navigate('Search')}
          >
            <FP_Icon name="search" size={19} color={FP_COLORS.text} />
          </FP_IconButton>
          <FP_IconButton
            accessibilityLabel={t('notifications.title')}
            onPress={() => navigation.navigate('Notifications')}
            badge={
              unread > 0 ? (
                <FP_Badge
                  label={String(unread)}
                  tone="danger"
                  style={styles.bellBadge}
                  textStyle={styles.bellBadgeText}
                />
              ) : undefined
            }
          >
            <FP_Icon name="bell" size={19} color={FP_COLORS.text} />
          </FP_IconButton>
        </FP_Row>
      }
    />
  );

  const loadingFirstPaint = !isGuest && (plan.initialLoading || nutrition.initialLoading);
  const fatalError = !isGuest && plan.error && !plan.data && nutrition.error && !nutrition.data;

  return (
    <FP_Screen onRefresh={refresh} refreshing={refreshing} bottomInset={TAB_BAR_CLEARANCE}>
      {header}

      {fatalError ? (
        <FP_ErrorState
          title={t('common.error_generic')}
          message={plan.error?.message}
          retryLabel={t('common.retry')}
          onRetry={refresh}
          style={styles.block}
        />
      ) : loadingFirstPaint ? (
        <View style={styles.block}>
          <FP_Row gap={FP_SPACING.md}>
            <FP_Skeleton height={74} style={styles.flex} />
            <FP_Skeleton height={74} style={styles.flex} />
            <FP_Skeleton height={74} style={styles.flex} />
          </FP_Row>
          <FP_Skeleton height={168} style={styles.blockTop} />
          <FP_Skeleton height={148} style={styles.blockTop} />
        </View>
      ) : (
        <>
          {/* --- the three stat cards --- */}
          <FP_Row gap={FP_SPACING.md} style={styles.block}>
            <FP_StatCard
              accent
              value={`${sessionsDone}/${sessionsTarget}`}
              label={t('home.stat_sessions_label')}
              style={styles.flex}
            />
            <FP_StatCard
              value={`${planProgressPct}%`}
              label={t('home.stat_progress_label')}
              style={styles.flex}
            />
            <FP_StatCard
              value={kcalToday.toLocaleString()}
              label={t('home.stat_kcal_label')}
              style={styles.flex}
            />
          </FP_Row>

          {/* --- today's session --- */}
          <View style={styles.block}>
            {today ? (
              <FP_TodayCard
                badgeLabel={t('home.today_badge')}
                metaLabel={sessionMeta}
                title={today.title}
                subtitle={sessionSub}
                ctaLabel={t('home.today_cta')}
                onPressCta={() => navigation.navigate('ClientTabs', { screen: 'Train' })}
              />
            ) : (
              <FP_TodayCard
                badgeLabel={t('home.today_badge')}
                title={t('home.no_session_title')}
                subtitle={t('home.no_session_sub', { coach })}
              />
            )}
          </View>

          {/* --- promo video, only when the CMS has one attached --- */}
          {media(PROMO_KEY) ? (
            <View style={styles.block}>
              <FP_VideoPlayer uri={media(PROMO_KEY)} height={180} />
            </View>
          ) : null}

          {/* --- suggested for you --- */}
          {suggestedList.length > 0 ? (
            <View style={styles.section}>
              <FP_SectionHeader
                title={t('home.suggested_title')}
                sub={t('home.suggested_sub', { coach })}
                actionLabel={t('home.view_all')}
                onPressAction={goVideos}
                guestAllowed
              />
              <FP_ChipScroll gap={FP_SPACING.md} style={styles.rail}>
                {suggestedList.map(video => (
                  <FP_VideoRailCard
                    key={video.id}
                    video={video}
                    caption={
                      'why' in video && (video as SuggestedVideo).why
                        ? `${GLYPH_SPARKLE} ${(video as SuggestedVideo).why}`
                        : undefined
                    }
                    onPress={() => setOpenVideo(video)}
                  />
                ))}
              </FP_ChipScroll>
            </View>
          ) : null}

          {/* --- continue watching --- */}
          {continueList.length > 0 ? (
            <View style={styles.section}>
              <FP_SectionHeader
                title={t('home.continue_title')}
                actionLabel={t('home.view_all')}
                onPressAction={goVideos}
                guestAllowed
              />
              <FP_ChipScroll gap={FP_SPACING.md} style={styles.rail}>
                {continueList.map(video => (
                  <FP_VideoRailCard
                    key={video.id}
                    video={video}
                    caption={t('home.watched_pct', { pct: Math.round(video.progress * 100) })}
                    onPress={() => setOpenVideo(video)}
                  />
                ))}
              </FP_ChipScroll>
            </View>
          ) : null}

          {/* --- nutrition summary --- */}
          <View style={styles.section}>
            <FP_SectionHeader
              title={t('home.nutrition_title')}
              actionLabel={t('home.view_all')}
              onPressAction={() => navigation.navigate('Nutrition')}
              guestAllowed
            />
            <FP_Card style={styles.railTight} onPress={() => navigation.navigate('Nutrition')}>
              <FP_Row gap={FP_SPACING.md}>
                <FP_MealRing
                  consumedKcal={kcalToday}
                  targetKcal={targetKcal}
                  variant="percent"
                  size={64}
                  innerSize={48}
                />
                <View style={styles.flex}>
                  {dietPlanName ? (
                    <Text style={FP_TYPE.bodyBold}>{dietPlanName}</Text>
                  ) : (
                    <FP_CmsText k="home.nutrition_none" variant="body" />
                  )}
                  <Text style={[FP_TYPE.sub, styles.nutritionSub]}>{nutritionSub}</Text>
                </View>
                <Text style={styles.chevron}>{GLYPH_CHEVRON}</Text>
              </FP_Row>
            </FP_Card>
          </View>
        </>
      )}

      <FP_VideoSheet
        video={openVideo}
        visible={openVideo !== null}
        onClose={() => setOpenVideo(null)}
        onStart={handleStart}
        onToggleFavorite={handleToggleFavorite}
      />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginTop: FP_SPACING.lg },
  blockTop: { marginTop: FP_SPACING.lg },
  section: { marginTop: FP_SPACING.xxl },
  rail: { marginTop: FP_SPACING.md },
  railTight: { marginTop: FP_SPACING.md },
  nutritionSub: { marginTop: FP_SPACING.sm },
  chevron: { ...FP_TYPE.body, color: FP_COLORS.muted },
  bellBadge: { paddingHorizontal: 5, paddingVertical: 1, minWidth: 18 },
  bellBadgeText: { fontSize: 9.5 },
});

export default HomeScreen;
