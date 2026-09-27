import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_SPACING } from '../theme';

export interface FP_KeyValueRowProps {
  label: string;
  value?: string;
  /** a badge or chip on the right instead of plain text */
  right?: React.ReactNode;
  valueColor?: string;
  muted?: boolean;
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** `.kv`: label left, value right, hairline beneath. */
export const FP_KeyValueRow: React.FC<FP_KeyValueRowProps> = ({
  label,
  value,
  right,
  valueColor,
  muted,
  last,
  style,
}) => (
  <View style={[styles.kv, last && styles.last, style]}>
    <Text style={styles.key} numberOfLines={2}>
      {label}
    </Text>
    {right ?? (
      <Text
        style={[styles.value, muted && styles.muted, valueColor ? { color: valueColor } : null]}
        numberOfLines={2}
      >
        {value ?? '—'}
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: FP_SPACING.md,
    paddingVertical: FP_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: FP_COLORS.line,
  },
  last: { borderBottomWidth: 0 },
  key: { fontSize: 14, color: FP_COLORS.muted, flexShrink: 1 },
  value: { fontSize: 14, color: FP_COLORS.text, flexShrink: 1, textAlign: 'right' },
  muted: { color: FP_COLORS.muted },
});

export default FP_KeyValueRow;
