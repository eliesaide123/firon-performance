/**
 * CMS-driven video. The `Content` row is typed `video`; an admin attaches an approved
 * `MediaAsset` in the CMS and it appears here live via `content:updated`.
 *
 *   <FP_CmsVideo k="home.promo_video" height={180} />
 *
 * Delegates playback to FP_VideoPlayer, which also carries the guest gate.
 */
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useContent } from '../cms/ContentProvider';
import FP_VideoPlayer from './FP_VideoPlayer';

export interface FP_CmsVideoProps {
  k: string;
  height?: number;
  autoPlay?: boolean;
  durationLabel?: string;
  guestAllowed?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const FP_CmsVideo: React.FC<FP_CmsVideoProps> = ({
  k,
  height = 190,
  autoPlay = false,
  durationLabel,
  guestAllowed,
  testID,
}) => {
  const { media } = useContent();
  return (
    <FP_VideoPlayer
      testID={testID ?? `cms-video:${k}`}
      uri={media(k)}
      height={height}
      autoPlay={autoPlay}
      durationLabel={durationLabel}
      guestAllowed={guestAllowed}
    />
  );
};

export default FP_CmsVideo;
