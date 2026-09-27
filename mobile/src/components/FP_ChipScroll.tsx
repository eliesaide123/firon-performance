import React from 'react';
import { ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { FP_GUTTER } from '../theme';

export interface FP_ChipScrollProps {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * `.chip-scroll`: a horizontal rail that bleeds past the screen gutter
 * (`margin:0 -20px` + `padding-inline:20px`) so chips can scroll edge to edge.
 */
export const FP_ChipScroll: React.FC<FP_ChipScrollProps> = ({
  children,
  gap = 9,
  style,
  contentStyle,
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={[styles.scroll, style]}
    contentContainerStyle={[styles.content, { gap }, contentStyle]}
  >
    {children}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -FP_GUTTER, flexGrow: 0 },
  content: {
    paddingHorizontal: FP_GUTTER,
    paddingTop: 2,
    paddingBottom: 4,
    alignItems: 'center',
  },
});

export default FP_ChipScroll;
