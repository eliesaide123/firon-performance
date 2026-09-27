import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_SPACING } from '../theme';

export interface FP_CardProps {
  children?: React.ReactNode;
  onPress?: () => void;
  /** the dashed upload dropzone on the PT uploads screen */
  dashed?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** `.card`: surface fill + 1px line + radius 18 + 16px padding. */
export const FP_Card: React.FC<FP_CardProps> = ({ children, onPress, dashed, style, testID }) => {
  const composed = [styles.card, dashed && styles.dashed, style];
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [...composed, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={composed}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: FP_COLORS.surface,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    borderRadius: FP_RADIUS.card,
    padding: FP_SPACING.lg,
  },
  dashed: { borderStyle: 'dashed' },
  pressed: { opacity: 0.85 },
});

export default FP_Card;
