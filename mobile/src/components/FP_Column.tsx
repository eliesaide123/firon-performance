import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export interface FP_ColumnProps {
  children?: React.ReactNode;
  gap?: number;
  /** `flex: 1` — the prototype's `.grow` */
  grow?: boolean;
  align?: ViewStyle['alignItems'];
  style?: StyleProp<ViewStyle>;
}

export const FP_Column: React.FC<FP_ColumnProps> = ({
  children,
  gap = 0,
  grow,
  align,
  style,
}) => (
  <View style={[styles.column, { gap }, grow && styles.grow, align ? { alignItems: align } : null, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  column: { flexDirection: 'column' },
  grow: { flex: 1 },
});

export default FP_Column;
