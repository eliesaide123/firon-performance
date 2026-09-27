import React from 'react';
import { RefreshControl, ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { FP_COLORS } from '../theme';

export interface FP_PullToRefreshProps {
  children: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A scroll view with a lime pull-to-refresh spinner. `FP_Screen` covers the common case;
 * use this directly when a screen needs its own scroll container.
 */
export const FP_PullToRefresh: React.FC<FP_PullToRefreshProps> = ({
  children,
  refreshing,
  onRefresh,
  style,
  contentStyle,
}) => (
  <ScrollView
    style={[styles.scroll, style]}
    contentContainerStyle={contentStyle}
    showsVerticalScrollIndicator={false}
    refreshControl={
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={FP_COLORS.accent}
        colors={[FP_COLORS.accent]}
      />
    }
  >
    {children}
  </ScrollView>
);

const styles = StyleSheet.create({ scroll: { flex: 1 } });

export default FP_PullToRefresh;
