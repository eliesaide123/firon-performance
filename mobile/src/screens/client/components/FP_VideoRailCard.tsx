/**
 * One tile in a Home horizontal rail: the 200×120 media tile plus the caption line under it
 * (`✨ {why}` for "Suggested for you", `{pct}% watched` for "Continue watching").
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Video } from '@firon/shared';
import { FP_Thumb } from '../../../components';
import { FP_SPACING, FP_TYPE } from '../../../theme';

const RAIL_TILE_WIDTH = 200;
const RAIL_TILE_HEIGHT = 120;

export interface FP_VideoRailCardProps {
  video: Video;
  caption?: string;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

export const FP_VideoRailCard: React.FC<FP_VideoRailCardProps> = ({
  video,
  caption,
  onPress,
  onToggleFavorite,
}) => (
  <View style={styles.wrap}>
    <FP_Thumb
      gradientIndex={video.gradientIndex}
      thumbnailUrl={video.thumbnailUrl}
      height={RAIL_TILE_HEIGHT}
      eyebrow={video.category}
      title={video.title}
      durationLabel={video.durationLabel}
      progress={video.progress}
      favorite={video.favorite}
      onPress={onPress}
      onToggleFavorite={onToggleFavorite}
    />
    {caption ? <Text style={styles.caption}>{caption}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { width: RAIL_TILE_WIDTH },
  caption: {
    ...FP_TYPE.tiny,
    fontSize: 11.5,
    lineHeight: 15.5,
    marginTop: FP_SPACING.sm,
  },
});

export default FP_VideoRailCard;
