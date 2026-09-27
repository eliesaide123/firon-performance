import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { FP_CmsText } from '../../../components';
import { FP_COLORS } from '../../../theme';

export interface FP_PtTextButtonProps {
  /** CMS key for the label. */
  k: string;
  vars?: Record<string, string | number>;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** The prototype's inline `<a class="accent">` text action inside a section heading. */
export const FP_PtTextButton: React.FC<FP_PtTextButtonProps> = ({ k, vars, onPress, style }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    hitSlop={8}
    style={({ pressed }) => [style, pressed && styles.pressed]}
  >
    <FP_CmsText k={k} vars={vars} style={styles.label} />
  </Pressable>
);

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: FP_COLORS.accent },
  pressed: { opacity: 0.6 },
});

export default FP_PtTextButton;
