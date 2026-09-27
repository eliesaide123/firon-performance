import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { FP_SPACING } from '../theme';

export interface FP_RowProps {
  children?: React.ReactNode;
  /** `justify-content: space-between` — the prototype's `.between` */
  between?: boolean;
  gap?: number;
  align?: ViewStyle['alignItems'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The prototype's `.row` layout helper. */
export const FP_Row: React.FC<FP_RowProps> = ({
  children,
  between,
  gap = FP_SPACING.md,
  align = 'center',
  wrap,
  style,
}) => (
  <View
    style={[
      styles.row,
      { gap, alignItems: align },
      between && styles.between,
      wrap && styles.wrap,
      style,
    ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  between: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
});

export default FP_Row;
