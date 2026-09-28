/**
 * Client · Videos (docs/prototype.html `SCREENS.videos` + `thumb()` + `videoSheet()`).
 *
 * Category chips (All + the CMS categories + ♥ Favorites) → a two-column media grid → the video
 * detail sheet with real playback when the CMS has a video asset attached.
 *
 * `GET /categories` and `GET /videos` are the two public endpoints (CONTRACT §13.3), so the grid
 * is fully populated in guest preview too; every tap inside it is gated by the FP_ primitives.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@firon/shared';
import type { Category, Video } from '@firon/shared';
import {
  FP_AppHeader,
  FP_Chip,
  FP_ChipScroll,
  FP_EmptyState,
  FP_ErrorState,
  FP_Icon,
  FP_IconButton,
  FP_Screen,
  FP_Skeleton,
  FP_Thumb,
} from '../../components';
import { useContent } from '../../cms/ContentProvider';
import { useToast } from '../../components/FP_ToastProvider';
import useResource from '../../store/useResource';
import { QK } from '../../store/queryCache';
import { useGuestGate } from '../../guest/GuestGateProvider';
import type { ClientTabParamList, RootStackParamList } from '../../navigation/types';
import { FP_COLORS, FP_GUTTER, FP_SPACING } from '../../theme';
import { TAB_BAR_CLEARANCE } from './useClientContext';
import FP_VideoSheet from './components/FP_VideoSheet';

const GRID_GAP = FP_SPACING.md;
const TILE_HEIGHT = 150;
/** Sentinel chip ids that are not category names. */
const ALL = '__all__';
const FAVORITES = '__fav__';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type VideosRoute = RouteProp<ClientTabParamList, 'Videos'>;

export const VideosScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<VideosRoute>();
  const { t } = useContent();
  const { toast } = useToast();
  const { isGuest } = useGuestGate();
  const { width } = useWindowDimensions();

  const [selected, setSelected] = useState<string>(ALL);
  const [openVideo, setOpenVideo] = useState<Video | null>(null);
  const [favBusy, setFavBusy] = useState(false);

  const tileWidth = Math.floor((width - FP_GUTTER * 2 - GRID_GAP) / 2);

  const categories = useResource<Category[]>(QK.categories, () =>
    api.categories.list({ kind: 'video' }),
  );

  const videos = useResource<Video[]>(
    QK.videos(selected),
    async () =>
      (
        await api.videos.list({
          category: selected === ALL || selected === FAVORITES ? undefined : selected,
          favorite: selected === FAVORITES ? true : undefined,
          limit: 50,
        })
      ).data,
  );

  /* A `firon://video/<id>` deep link lands here with the video pre-opened. */
  const deepLinkId = route.params?.videoId;
  useEffect(() => {
    if (!deepLinkId || isGuest) {
      return;
    }
    let cancelled = false;
    void api.videos.byId(deepLinkId, { showAlert: false }).then(
      found => {
        if (!cancelled) {
          setOpenVideo(found);
        }
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [deepLinkId, isGuest]);

  const list = videos.data ?? [];

  const chips = useMemo(
    () => [
      { id: ALL, label: t('videos.chip_all') },
      ...(categories.data ?? []).map(c => ({ id: c.name, label: c.name })),
      { id: FAVORITES, label: t('videos.favorites_chip') },
    ],
    [categories.data, t],
  );

  const patchVideo = useCallback(
    (next: Video) => {
      setOpenVideo(current => (current && current.id === next.id ? next : current));
      videos.setData(prev => (prev ?? []).map(v => (v.id === next.id ? { ...v, ...next } : v)));
    },
    [videos],
  );

  const toggleFavorite = useCallback(
    async (video: Video) => {
      if (isGuest) {
        return;
      }
      setFavBusy(true);
      try {
        const { favorite } = await api.videos.toggleFavorite(video.id);
        patchVideo({ ...video, favorite });
        toast(t(favorite ? 'videos.toast_fav_added' : 'videos.toast_fav_removed'));
        if (selected === FAVORITES && !favorite) {
          await videos.refresh();
        }
      } finally {
        setFavBusy(false);
      }
    },
    [isGuest, patchVideo, toast, t, selected, videos],
  );

  const startVideo = useCallback(
    async (video: Video) => {
      const resuming = video.progress > 0;
      setOpenVideo(null);
      toast(t(resuming ? 'videos.toast_resuming' : 'videos.toast_playing', { title: video.title }));
      if (isGuest) {
        return;
      }
      const nextProgress = resuming ? video.progress : 0.05;
      patchVideo({ ...video, progress: nextProgress });
      await api.videos.setProgress(video.id, { progress: nextProgress });
    },
    [isGuest, toast, t, patchVideo],
  );

  return (
    <FP_Screen
      onRefresh={videos.refresh}
      refreshing={videos.loading}
      bottomInset={TAB_BAR_CLEARANCE}
    >
      <FP_AppHeader
        title={t('videos.title')}
        large
        right={
          <FP_IconButton
            accessibilityLabel={t('search.title')}
            onPress={() => navigation.navigate('Search')}
          >
            <FP_Icon name="search" size={19} color={FP_COLORS.text} />
          </FP_IconButton>
        }
      />

      <FP_ChipScroll style={styles.chips}>
        {chips.map(chip => (
          <FP_Chip
            key={chip.id}
            label={chip.label}
            active={selected === chip.id}
            onPress={() => setSelected(chip.id)}
          />
        ))}
      </FP_ChipScroll>

      {videos.initialLoading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map(i => (
            <FP_Skeleton key={i} height={TILE_HEIGHT} width={tileWidth} radius={14} />
          ))}
        </View>
      ) : videos.error && list.length === 0 ? (
        <FP_ErrorState
          title={t('common.error_generic')}
          message={videos.error.message}
          retryLabel={t('common.retry')}
          onRetry={videos.refresh}
          style={styles.state}
        />
      ) : list.length === 0 ? (
        <FP_EmptyState
          title={t('videos.empty_category')}
          icon={<FP_Icon name="video" size={28} color={FP_COLORS.muted} />}
          style={styles.state}
        />
      ) : (
        <View style={styles.grid}>
          {list.map(video => (
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
      )}

      <FP_VideoSheet
        video={openVideo}
        visible={openVideo !== null}
        favoriteBusy={favBusy}
        onClose={() => setOpenVideo(null)}
        onStart={startVideo}
        onToggleFavorite={toggleFavorite}
      />
    </FP_Screen>
  );
};

const styles = StyleSheet.create({
  chips: { marginTop: FP_SPACING.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: 14,
  },
  state: { marginTop: FP_SPACING.xxl },
});

export default VideosScreen;
