import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_EXTRA_RADIUS, FP_FONT_SIZE, FP_SPACING } from '../theme';

export interface FP_StatCardProps {
  value: string;
  label: string;
  /** the prototype paints the leading stat's number lime */
  accent?: boolean;
  /** tint the number with an arbitrary colour (adherence thresholds) */
  valueColor?: string;
  /** `padding:10px` + 16px number — the nutrition macro row */
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
}

/** `.stat`: big number over a small muted label. */
export const FP_StatCard: React.FC<FP_StatCardProps> = ({
  value,
  label,
  accent = false,
  valueColor,
  dense = false,
  style,
  valueStyle,
}) => (
  <View style={[styles.stat, dense && styles.dense, style]}>
    <Text
      style={[
        styles.value,
        dense && styles.valueDense,
        accent && styles.accent,
        valueColor ? { color: valueColor } : null,
        valueStyle,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
    >
      {value}
    </Text>
    <Text style={styles.label} numberOfLines={2}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    backgroundColor: FP_COLORS.surface,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    borderRadius: FP_EXTRA_RADIUS.stat,
    padding: 14,
  },
  dense: { padding: FP_SPACING.sm + 2 },
  value: { fontSize: FP_FONT_SIZE.stat, fontWeight: '800', color: FP_COLORS.text },
  valueDense: { fontSize: 16 },
  accent: { color: FP_COLORS.accent },
  label: { fontSize: FP_FONT_SIZE.tiny, color: FP_COLORS.muted, marginTop: 2 },
});

export default FP_StatCard;
