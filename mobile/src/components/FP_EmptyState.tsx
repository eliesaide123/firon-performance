import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_SPACING, FP_TYPE } from '../theme';

export interface FP_EmptyStateProps {
  title: string;
  message?: string;
  /** an emoji or an FP_Icon */
  icon?: React.ReactNode;
  /** an optional FP_Button */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const FP_EmptyState: React.FC<FP_EmptyStateProps> = ({
  title,
  message,
  icon,
  action,
  style,
}) => (
  <View style={[styles.wrap, style]}>
    {icon ? <View style={styles.icon}>{icon}</View> : null}
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {action ? <View style={styles.action}>{action}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 34, gap: 6 },
  icon: { marginBottom: FP_SPACING.xs },
  title: { ...FP_TYPE.bodyBold, textAlign: 'center' },
  message: { ...FP_TYPE.sub, textAlign: 'center', paddingHorizontal: FP_SPACING.xl },
  action: { marginTop: FP_SPACING.lg, alignSelf: 'stretch' },
});

export default FP_EmptyState;
