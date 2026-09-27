import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { FP_COLORS } from '../theme';

export interface FP_ProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** Linear progress — the `.progressbar` the prototype lays over a media tile. */
export const FP_ProgressBar: React.FC<FP_ProgressBarProps> = ({
  progress,
  height = 4,
  color = FP_COLORS.accent,
  trackColor = FP_COLORS.surface3,
  style,
}) => {
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});

export default FP_ProgressBar;
