import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_SPACING } from '../theme';

export interface FP_DividerProps {
  style?: StyleProp<ViewStyle>;
}

/** The prototype's `.divider`: 1px line with 16px of vertical breathing room. */
export const FP_Divider: React.FC<FP_DividerProps> = ({ style }) => (
  <View style={[styles.divider, style]} />
);

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: FP_COLORS.line, marginVertical: FP_SPACING.lg },
});

export default FP_Divider;
