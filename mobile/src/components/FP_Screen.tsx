import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FP_COLORS, FP_GUTTER, FP_TYPE } from '../theme';

export interface FP_ScreenProps {
  children: React.ReactNode;
  /** pinned above the scroll area — the prototype's `.sticky-head` */
  header?: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** clear the bottom tab bar */
  bottomInset?: number;
  /** honour the notch; off for screens nested under a header that already did */
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** drop the 20px side gutters (full-bleed screens) */
  flush?: boolean;
  testID?: string;
}

/** `.screen`: safe-area + bg + 20px gutters + vertical scroll. */
export const FP_Screen: React.FC<FP_ScreenProps> = ({
  children,
  header,
  scroll = true,
  onRefresh,
  refreshing = false,
  bottomInset = 0,
  topInset = true,
  contentStyle,
  flush = false,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[!flush && styles.gutter, contentStyle]}>
      {children}
      <View style={{ height: 26 + bottomInset }} />
    </View>
  );

  return (
    <View
      testID={testID}
      style={[styles.root, { paddingTop: topInset ? insets.top + 6 : 6 }]}
    >
      {header}
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={FP_COLORS.accent}
                colors={[FP_COLORS.accent]}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
};

/** `.sticky-head`: bg fill, bottom hairline, bleeds to the screen edges. */
export const FP_StickyHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.sticky}>
    <View style={styles.gutter}>{children}</View>
    <View style={styles.stickyRule} />
  </View>
);

/** `h2.screen-title` */
export const FP_ScreenTitle: React.FC<{ children: string; small?: boolean }> = ({
  children,
  small,
}) => <Text style={small ? FP_TYPE.screenTitleSm : FP_TYPE.screenTitle}>{children}</Text>;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FP_COLORS.bg },
  scroll: { flex: 1 },
  gutter: { paddingHorizontal: FP_GUTTER },
  sticky: { backgroundColor: FP_COLORS.bg, paddingBottom: 12, zIndex: 30 },
  stickyRule: {
    position: 'absolute',
    left: FP_GUTTER,
    right: FP_GUTTER,
    bottom: 0,
    height: 1,
    backgroundColor: FP_COLORS.line,
    opacity: 0.7,
  },
});

export default FP_Screen;
