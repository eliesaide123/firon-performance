/**
 * The prototype's `videoSheet(i)` — the video detail bottom sheet, shared by Home, Videos and
 * Search so all three open exactly the same panel.
 *
 * Real playback happens through `FP_VideoPlayer` whenever the CMS has a video asset attached to
 * the record; otherwise the sheet shows the gradient media tile and the `videos.no_source` note.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Video } from '@firon/shared';
import {
  FP_BottomSheet,
  FP_Button,
  FP_CmsText,
  FP_Thumb,
  FP_VideoPlayer,
} from '../../../components';
import { useContent } from '../../../cms/ContentProvider';
import { FP_SPACING, FP_TYPE } from '../../../theme';

export interface FP_VideoSheetProps {
  video: Video | null;
  visible: boolean;
  onClose: () => void;
  onStart: (video: Video) => void;
  onToggleFavorite: (video: Video) => void;
  favoriteBusy?: boolean;
}

export const FP_VideoSheet: React.FC<FP_VideoSheetProps> = ({
  video,
  visible,
  onClose,
  onStart,
  onToggleFavorite,
  favoriteBusy = false,
}) => {
  const { t } = useContent();

  if (!video) {
    return <FP_BottomSheet visible={false} onClose={onClose} />;
  }

  const pct = Math.round((video.progress ?? 0) * 100);
  const metaParts = [video.category, video.durationLabel].filter(Boolean) as string[];
  if (pct > 0) {
    metaParts.push(t('videos.watched_suffix', { pct }));
  }

  return (
    <FP_BottomSheet visible={visible} onClose={onClose}>
      <Text style={FP_TYPE.sheetTitle}>{video.title}</Text>
      <Text style={[FP_TYPE.sub, styles.meta]}>{metaParts.join(' · ')}</Text>

      <View style={styles.media}>
        {video.videoUrl ? (
          <FP_VideoPlayer
            uri={video.videoUrl}
            videoId={video.id}
            initialProgress={video.progress}
            durationLabel={video.durationLabel}
            height={190}
          />
        ) : (
          <FP_Thumb
            gradientIndex={video.gradientIndex}
            thumbnailUrl={video.thumbnailUrl}
            height={190}
            durationLabel={video.durationLabel}
            progress={video.progress}
            onPress={() => onStart(video)}
          />
        )}
      </View>

      {video.videoUrl ? null : (
        <FP_CmsText k="videos.no_source" variant="tiny" style={styles.noSource} />
      )}

      <FP_CmsText k="videos.sheet_blurb" variant="sub" style={styles.blurb} />

      <FP_Button
        title={t(video.progress > 0 ? 'videos.cta_resume' : 'videos.cta_start')}
        onPress={() => onStart(video)}
        style={styles.cta}
      />
      <FP_Button
        variant="ghost"
        loading={favoriteBusy}
        title={t(video.favorite ? 'videos.cta_fav_remove' : 'videos.cta_fav_add')}
        onPress={() => onToggleFavorite(video)}
        style={styles.ctaGhost}
      />
    </FP_BottomSheet>
  );
};

const styles = StyleSheet.create({
  meta: { marginTop: FP_SPACING.sm },
  media: { marginTop: FP_SPACING.lg },
  noSource: { marginTop: FP_SPACING.sm },
  blurb: { marginTop: FP_SPACING.lg },
  cta: { marginTop: FP_SPACING.xl },
  ctaGhost: { marginTop: FP_SPACING.md },
});

export default FP_VideoSheet;
