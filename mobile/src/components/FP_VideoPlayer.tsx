/**
 * `react-native-video` wrapper.
 *
 * Reports playback position back to the API through the shared proxy so "Continue watching"
 * and the progress bars stay accurate — throttled, and with `showAlert: false` so a dropped
 * progress ping never interrupts playback with a dialog.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Video, { type OnProgressData, type VideoRef } from 'react-native-video';
import { api } from '@firon/shared';
import { FP_COLORS, FP_RADIUS } from '../theme';
import FP_Icon from './FP_Icon';
import { useGuestGate } from '../guest/GuestGateProvider';
import log from '../log';

export interface FP_VideoPlayerProps {
  /** Absolute media URL. When null the player renders its poster/placeholder only. */
  uri: string | null;
  /** Video id — when given, progress is reported to the API. */
  videoId?: string;
  /** 0..1 resume point. */
  initialProgress?: number;
  durationLabel?: string;
  autoPlay?: boolean;
  height?: number;
  onEnd?: () => void;
  guestAllowed?: boolean;
  testID?: string;
}

/** Don't spam the API: report at most once every 5 seconds of playback. */
const PROGRESS_INTERVAL_MS = 5000;

export const FP_VideoPlayer: React.FC<FP_VideoPlayerProps> = ({
  uri,
  videoId,
  initialProgress = 0,
  durationLabel,
  autoPlay = false,
  height = 200,
  onEnd,
  guestAllowed,
  testID,
}) => {
  const ref = useRef<VideoRef>(null);
  const lastReport = useRef(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const { isGuest, gate } = useGuestGate();

  const togglePlay = useCallback(() => {
    if (isGuest && !guestAllowed) {
      gate('video');
      return;
    }
    setPlaying(value => !value);
  }, [isGuest, guestAllowed, gate]);

  const handleProgress = useCallback(
    ({ currentTime, seekableDuration }: OnProgressData) => {
      if (!videoId || !seekableDuration) return;
      const now = Date.now();
      if (now - lastReport.current < PROGRESS_INTERVAL_MS) return;
      lastReport.current = now;
      const progress = Math.min(1, Math.max(0, currentTime / seekableDuration));
      // Fire-and-forget; the endpoint is declared with showAlert:false in @firon/shared.
      api.videos
        .setProgress(videoId, { progress, secondsWatched: Math.round(currentTime) })
        .catch(() => undefined);
    },
    [videoId],
  );

  if (!uri) {
    return (
      <View testID={testID} style={[styles.frame, { height }, styles.center]}>
        <Text style={styles.placeholder}>No video attached yet</Text>
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.frame, { height }]}>
      <Video
        ref={ref}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        paused={!playing}
        resizeMode="cover"
        controls={playing}
        onProgress={handleProgress}
        onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
        onLoad={() => {
          if (initialProgress > 0 && initialProgress < 1) {
            ref.current?.seek(0);
          }
        }}
        onError={error => {
          log.warn('video error', error);
          setFailed(true);
        }}
        onEnd={() => {
          setPlaying(false);
          onEnd?.();
        }}
        ignoreSilentSwitch="ignore"
        playInBackground={false}
      />

      {failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.scrim]}>
          <Text style={styles.placeholder}>This video could not be played</Text>
        </View>
      ) : null}

      {buffering ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={FP_COLORS.accent} />
        </View>
      ) : null}

      {!playing && !failed ? (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.center]}
          onPress={togglePlay}
          accessibilityRole="button"
          accessibilityLabel="Play video"
        >
          <View style={styles.playBubble}>
            <FP_Icon name="play" size={18} color={FP_COLORS.onAccent} />
          </View>
        </Pressable>
      ) : null}

      {durationLabel && !playing ? (
        <View style={styles.duration} pointerEvents="none">
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    borderRadius: FP_RADIUS.thumb,
    overflow: 'hidden',
    backgroundColor: FP_COLORS.surface3,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  placeholder: { color: FP_COLORS.muted, fontSize: 13 },
  playBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  duration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});

export default FP_VideoPlayer;
