/**
 * Client · Search (docs/prototype.html `SCREENS.search` + `runSearch`).
 *
 * Debounced `GET /search?q=` → results grouped as Plans then Videos, with the prototype's
 * suggestion chips above them (sourced from the real category list rather than hardcoded words).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@firon/shared';
import type { Category, SearchResults, Video } from '@firon/shared';
import {
  FP_AppHeader,
  FP_Avatar,
  FP_Chip,
  FP_ChipScroll,
  FP_CmsText,
  FP_ErrorState,
  FP_Icon,
  FP_IconButton,
  FP_ListItem,
  FP_Screen,
  FP_SearchInput,
  FP_Skeleton,
  FP_Thumb,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import useResource from '../../store/useResource';
import { QK } from '../../store/queryCache';
import { useGuestGate } from '../../guest/GuestGateProvider';
import type { RootStackParamList } from '../../navigation/types';
import { FP_COLORS, FP_GUTTER, FP_SPACING, FP_TYPE } from '../../theme';
import FP_VideoSheet from './components/FP_VideoSheet';

const DEBOUNCE_MS = 300;
const GRID_GAP = FP_SPACING.md;
const TILE_HEIGHT = 150;
/** Decorative glyph for a plan row — the prototype's 📋 avatar. */
const GLYPH_PLAN = '📋';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useContent();
  const { toast } = useToast();
  const { isGuest } = useGuestGate();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [openVideo, setOpenVideo] = useState<Video | null>(null);

  const tileWidth = Math.floor((width - FP_GUTTER * 2 - GRID_GAP) / 2);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const categories = useResource<Category[]>(QK.categories, () =>
    api.categories.list({ kind: 'video' }),
  );

  const results = useResource<SearchResults>(
    `search:${debounced.toLowerCase()}`,
    () => api.search(debounced),
    { enabled: !isGuest && debounced.length > 0 },
  );

  const suggestions = useMemo(
    () => (categories.data ?? []).slice(0, 4).map(c => c.name),
    [categories.data],
  );

  const plans = results.data?.plans ?? [];
  const videos = results.data?.videos ?? [];
  const hasQuery = debounced.length > 0;
  const nothingFound =
    hasQuery && !results.loading && !results.error && plans.length === 0 && videos.length === 0;

  const startVideo = useCallback(
    async (video: Video) => {
      const resuming = video.progress > 0;
      setOpenVideo(null);
      toast(t(resuming ? 'videos.toast_resuming' : 'videos.toast_playing', { title: video.title }));
      if (isGuest) {
        return;
      }
      await api.videos.setProgress(video.id, { progress: resuming ? video.progress : 0.05 });
    },
    [isGuest, toast, t],
  );

  const toggleFavorite = useCallback(
    async (video: Video) => {
      if (isGuest) {
        return;
      }
      const { favorite } = await api.videos.toggleFavorite(video.id);
      setOpenVideo(current =>
        current && current.id === video.id ? { ...current, favorite } : current,
      );
      const current = results.data;
      if (current) {
        results.setData({
          ...current,
          videos: current.videos.map(v => (v.id === video.id ? { ...v, favorite } : v)),
        });
      }
      toast(t(favorite ? 'videos.toast_fav_added' : 'videos.toast_fav_removed'));
    },
    [isGuest, results, toast, t],
  );

  return (
    <FP_Screen>
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
      />
      <FP_CmsText k="search.title" variant="screenTitle" accessibilityRole="header" />
      <FP_CmsText k="search.subtitle" variant="sub" style={styles.gapTop} />

      <FP_SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('search.placeholder')}
        style={styles.block}
      />

      {suggestions.length > 0 ? (
        <FP_ChipScroll style={styles.block}>
          {suggestions.map(term => (
            <FP_Chip
              key={term}
              label={term}
              active={debounced.toLowerCase() === term.toLowerCase()}
              onPress={() => setQuery(term)}
            />
          ))}
        </FP_ChipScroll>
      ) : null}

      {!hasQuery ? (
        <FP_CmsText k="search.empty" variant="sub" style={styles.centeredNote} />
      ) : results.initialLoading ? (
        <View style={styles.block}>
          <FP_Skeleton height={56} />
          <FP_Skeleton height={56} style={styles.gapTop} />
        </View>
      ) : results.error ? (
        <FP_ErrorState
          title={t('common.error_generic')}
          message={results.error.message}
          retryLabel={t('common.retry')}
          onRetry={results.refresh}
          style={styles.block}
        />
      ) : nothingFound ? (
        <FP_CmsText k="search.no_results" variant="sub" style={styles.centeredNote} />
      ) : (
        <View style={styles.block}>
          {plans.length > 0 ? (
            <>
              <FP_CmsText k="search.group_plans" variant="label" style={styles.groupLabel} />
              {plans.map((plan, i) => (
                <FP_ListItem
                  key={plan.id}
                  last={i === plans.length - 1}
                  left={<FP_Avatar glyph={GLYPH_PLAN} size={38} />}
                  title={plan.title}
                  subtitle={plan.subtitle}
                  onPress={() =>
                    plan.kind === 'training'
                      ? navigation.navigate('ClientTabs', { screen: 'Train' })
                      : navigation.navigate('Nutrition')
                  }
                />
              ))}
            </>
          ) : null}

          {videos.length > 0 ? (
            <>
              <FP_CmsText k="search.group_videos" variant="label" style={styles.groupLabelTop} />
              <View style={styles.grid}>
                {videos.map(video => (
                  <FP_Thumb
                    key={video.id}
                    width={tileWidth}
                    height={TILE_HEIGHT}
                    gradientIndex={video.gradientIndex}
                    thumbnailUrl={video.thumbnailUrl}
                    eyebrow={video.category}
                    title={video.title}
                    durationLabel={video.durationLabel}
                    progress={video.progress}
                    favorite={video.favorite}
                    onPress={() => setOpenVideo(video)}
                    onToggleFavorite={() => void toggleFavorite(video)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>
      )}

      <FP_VideoSheet
        video={openVideo}
        visible={openVideo !== null}
        onClose={() => setOpenVideo(null)}
        onStart={startVideo}
        onToggleFavorite={toggleFavorite}
      />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  gapTop: { marginTop: FP_SPACING.sm },
  block: { marginTop: FP_SPACING.lg },
  centeredNote: { ...FP_TYPE.sub, textAlign: 'center', marginTop: 40 },
  groupLabel: { fontWeight: '700' },
  groupLabelTop: { fontWeight: '700', marginTop: 14, marginBottom: FP_SPACING.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
});

export default SearchScreen;
