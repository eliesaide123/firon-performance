import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../theme';
import FP_Button from './FP_Button';
import FP_Icon from './FP_Icon';

export interface FP_ErrorStateProps {
  title: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Shown in place of content when a query failed, with a retry affordance. */
export const FP_ErrorState: React.FC<FP_ErrorStateProps> = ({
  title,
  message,
  retryLabel,
  onRetry,
  style,
}) => (
  <View style={[styles.wrap, style]}>
    <FP_Icon name="warning" size={32} color={FP_COLORS.danger} />
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {onRetry && retryLabel ? (
      <FP_Button title={retryLabel} variant="ghost" onPress={onRetry} style={styles.action} />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 34, gap: 8 },
  title: { ...FP_TYPE.bodyBold, textAlign: 'center' },
  message: { ...FP_TYPE.sub, textAlign: 'center', paddingHorizontal: FP_SPACING.xl },
  action: { marginTop: FP_SPACING.md },
});

export default FP_ErrorState;
