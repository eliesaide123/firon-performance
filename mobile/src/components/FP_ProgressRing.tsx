import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FP_COLORS } from '../theme';

export interface FP_ProgressRingProps {
  /** 0..1 */
  progress: number;
  /** outer diameter */
  size?: number;
  /** diameter of the punched-out centre — the prototype's `.inner` */
  innerSize?: number;
  children?: React.ReactNode;
  trackColor?: string;
  fillColor?: string;
  innerColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native stand-in for the prototype's
 * `conic-gradient(var(--accent) 0 var(--p), var(--surface-3) var(--p) 100%)` donut:
 * an SVG arc that starts at 12 o'clock and runs clockwise.
 */
export const FP_ProgressRing: React.FC<FP_ProgressRingProps> = ({
  progress,
  size = 64,
  innerSize = 48,
  children,
  trackColor = FP_COLORS.surface3,
  fillColor = FP_COLORS.accent,
  innerColor = FP_COLORS.surface,
  style,
}) => {
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const strokeWidth = Math.max(1, (size - innerSize) / 2);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * pct;
  const centre = size / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={centre} cy={centre} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {pct > 0 ? (
          <Circle
            cx={centre}
            cy={centre}
            r={r}
            stroke={fillColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="butt"
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        ) : null}
      </Svg>
      <View
        style={[
          styles.inner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: innerColor,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inner: { alignItems: 'center', justifyContent: 'center' },
});

export default FP_ProgressRing;
