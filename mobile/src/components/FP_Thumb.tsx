import React from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { fpGradient } from '@firon/shared';
import { FP_COLORS, FP_EXTRA_COLORS, FP_GRADIENT_DIRECTION, FP_RADIUS } from '../theme';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_ThumbProps {
  /** Opt out of the guest gate. */
  guestAllowed?: boolean;
  /** indexes into FP_GRADIENTS when there is no thumbnail image */
  gradientIndex?: number;
  thumbnailUrl?: string | null;
  height?: number;
  width?: number | `${number}%`;
  /** small line above the title — the category in the prototype */
  eyebrow?: string;
  title?: string;
  durationLabel?: string;
  /** 0..1 — paints the lime bar along the bottom edge */
  progress?: number;
  favorite?: boolean;
  onPress?: () => void;
  onToggleFavorite?: () => void;
  showPlay?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

/**
 * `.thumb`: a gradient-backed media tile with a scrim, a centre play button, a duration pill,
 * a favourite heart and a progress bar.
 */
export const FP_Thumb: React.FC<FP_ThumbProps> = ({
  gradientIndex = 0,
  thumbnailUrl,
  height = 150,
  width,
  eyebrow,
  title,
  durationLabel,
  progress = 0,
  favorite,
  onPress,
  guestAllowed,
  onToggleFavorite,
  showPlay = true,
  style,
  children,
  testID,
}) => {
  const handlePress = useGatedPress(onPress, guestAllowed);
  const handleFavorite = useGatedPress(onToggleFavorite, guestAllowed);
  const [from, to] = fpGradient(gradientIndex);
  const pct = Math.max(0, Math.min(1, progress));

  const content = (
    <>
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[from, to]}
          start={FP_GRADIENT_DIRECTION.start}
          end={FP_GRADIENT_DIRECTION.end}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* `linear-gradient(to top, rgba(0,0,0,.55), transparent 60%)` */}
      <LinearGradient
        colors={[FP_EXTRA_COLORS.transparent, FP_EXTRA_COLORS.scrimTop]}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {showPlay ? (
        <View style={styles.playWrap} pointerEvents="none">
          <View style={styles.playPill}>
            <Text style={styles.playGlyph}>▶</Text>
          </View>
        </View>
      ) : null}

      {onToggleFavorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Remove from favorites' : 'Save to favorites'}
          onPress={handleFavorite}
          hitSlop={6}
          style={styles.fav}
        >
          <Text style={styles.favGlyph}>{favorite ? '♥' : '♡'}</Text>
        </Pressable>
      ) : null}

      {durationLabel ? (
        <View style={styles.duration} pointerEvents="none">
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      ) : null}

      {pct > 0 ? (
        <View style={[styles.progress, { width: `${Math.round(pct * 100)}%` }]} pointerEvents="none" />
      ) : null}

      {eyebrow || title ? (
        <View style={styles.caption} pointerEvents="none">
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
        </View>
      ) : null}

      {children}
    </>
  );

  const frame: StyleProp<ViewStyle> = [styles.thumb, { height }, width ? { width } : null, style];

  if (onPress) {
    return (
      <Pressable testID={testID} onPress={handlePress} style={({ pressed }) => [frame, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={frame}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  thumb: {
    borderRadius: FP_RADIUS.thumb,
    overflow: 'hidden',
    backgroundColor: FP_EXTRA_COLORS.thumbBase,
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.9 },
  playWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FP_EXTRA_COLORS.playPill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  playGlyph: { color: FP_COLORS.onAccent, fontSize: 16 },
  fav: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: FP_EXTRA_COLORS.favPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favGlyph: { fontSize: 16, color: FP_EXTRA_COLORS.onMedia },
  duration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: FP_EXTRA_COLORS.durationPill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  durationText: { fontSize: 11, fontWeight: '600', color: FP_EXTRA_COLORS.onMedia },
  progress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 4,
    backgroundColor: FP_COLORS.accent,
    zIndex: 2,
  },
  caption: { zIndex: 2, paddingHorizontal: 12, paddingVertical: 10 },
  eyebrow: { fontSize: 10, fontWeight: '600', color: FP_EXTRA_COLORS.onMedia, opacity: 0.85 },
  title: { fontSize: 14, fontWeight: '700', color: FP_EXTRA_COLORS.onMedia },
});

export default FP_Thumb;
