import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_EXTRA_RADIUS, FP_FONT_SIZE } from '../theme';

export type FP_BadgeTone = 'ok' | 'warn' | 'pt' | 'danger';

export interface FP_BadgeProps {
  label: string;
  tone?: FP_BadgeTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** `.badge.ok | .warn | .pt` from the prototype, plus a danger tone. */
export const FP_Badge: React.FC<FP_BadgeProps> = ({ label, tone = 'pt', style, textStyle }) => (
  <View style={[styles.badge, TONES[tone].container, style]}>
    <Text style={[styles.text, TONES[tone].text, textStyle]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: FP_EXTRA_RADIUS.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: FP_FONT_SIZE.badge, fontWeight: '700' },
});

const TONES: Record<FP_BadgeTone, { container: ViewStyle; text: TextStyle }> = {
  ok: { container: { backgroundColor: FP_COLORS.okSoft }, text: { color: FP_COLORS.accent2 } },
  warn: { container: { backgroundColor: FP_COLORS.warnSoft }, text: { color: FP_COLORS.warn } },
  pt: { container: { backgroundColor: FP_COLORS.accentSoftBorder }, text: { color: FP_COLORS.accent } },
  danger: { container: { backgroundColor: FP_COLORS.warnSoft }, text: { color: FP_COLORS.danger } },
};

export default FP_Badge;
