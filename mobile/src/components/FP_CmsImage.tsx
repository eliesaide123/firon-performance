/**
 * CMS-driven image. The `Content` row is typed `image` and its `value`/`mediaId` resolves to an
 * approved `MediaAsset`; an admin attaches or swaps it in the CMS and this updates live via
 * `content:updated` — no app release.
 *
 *   <FP_CmsImage k="common.logo" width={46} height={46} />
 *   <FP_CmsImage k="home.today_banner" height={140} fallbackGradientIndex={4} />
 *
 * Renders `fallback` (or a gradient placeholder) when no asset is attached yet, so a freshly
 * seeded install never shows a broken image.
 */
import React, { useState } from 'react';
import { Image, ImageResizeMode, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { fpGradient } from '@firon/shared';
import { FP_GRADIENT_DIRECTION, FP_RADIUS } from '../theme';
import { useContent } from '../cms/ContentProvider';

export interface FP_CmsImageProps {
  k: string;
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  resizeMode?: ImageResizeMode;
  /** Shown when the CMS has no asset attached (or it failed to load). */
  fallback?: React.ReactNode;
  /** Index into the shared gradient palette for the default placeholder. */
  fallbackGradientIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export const FP_CmsImage: React.FC<FP_CmsImageProps> = ({
  k,
  width = '100%',
  height = 140,
  radius = FP_RADIUS.thumb,
  resizeMode = 'cover',
  fallback,
  fallbackGradientIndex = 0,
  style,
  testID,
  accessibilityLabel,
}) => {
  const { media } = useContent();
  const [failed, setFailed] = useState(false);
  const uri = media(k);
  const frame: StyleProp<ViewStyle> = [{ width, height, borderRadius: radius, overflow: 'hidden' }, style];

  if (!uri || failed) {
    if (fallback) return <View style={frame}>{fallback}</View>;
    const [from, to] = fpGradient(fallbackGradientIndex);
    return (
      <LinearGradient
        testID={testID ?? `cms-image:${k}:placeholder`}
        colors={[from, to]}
        start={FP_GRADIENT_DIRECTION.start}
        end={FP_GRADIENT_DIRECTION.end}
        style={frame}
      />
    );
  }

  return (
    <View style={frame}>
      <Image
        testID={testID ?? `cms-image:${k}`}
        accessibilityLabel={accessibilityLabel ?? k}
        source={{ uri }}
        resizeMode={resizeMode}
        onError={() => setFailed(true)}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

export default FP_CmsImage;
