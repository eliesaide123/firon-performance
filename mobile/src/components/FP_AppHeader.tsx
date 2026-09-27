import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_SPACING, FP_TYPE } from '../theme';

export interface FP_AppHeaderProps {
  /** avatar or back button */
  left?: React.ReactNode;
  /** small muted line above the title (greeting, "Trainer portal") */
  eyebrow?: string;
  title?: string;
  /** big `.screen-title` instead of the 17px header title */
  large?: boolean;
  /** search / bell buttons */
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** `.apphead`: the in-app header row. */
export const FP_AppHeader: React.FC<FP_AppHeaderProps> = ({
  left,
  eyebrow,
  title,
  large = false,
  right,
  children,
  style,
}) => (
  <View style={[styles.head, style]}>
    {left}
    {children ?? (
      <View style={styles.grow}>
        {eyebrow ? <Text style={FP_TYPE.sub}>{eyebrow}</Text> : null}
        {title ? (
          <Text style={large ? FP_TYPE.screenTitle : styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
    )}
    {right}
  </View>
);

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FP_SPACING.md,
    paddingTop: 6,
    paddingBottom: 2,
  },
  grow: { flex: 1 },
  title: { ...FP_TYPE.bodyBold, fontSize: 17, fontWeight: '800' },
});

export default FP_AppHeader;
