/**
 * The prototype's `.tabbar`: blurred dark bar, lime active tab, 24px stroked icons.
 *
 * Used as React Navigation's `tabBar` renderer for both ClientTabs and PtTabs.
 *
 * Guest mode (CONTRACT §13.2): the tab bar stays fully live. Switching tabs is navigation, not
 * an action, and a dead tab bar makes the app look broken rather than signed-in — every action
 * *inside* a tab is gated by the FP_ primitives instead.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FP_COLORS } from '../theme';
import FP_Icon, { type FP_IconName } from './FP_Icon';
import { useContent } from '../cms/ContentProvider';

/** Route name -> [icon, CMS copy key]. Labels come from the CMS like everything else. */
const TABS: Record<string, { icon: FP_IconName; labelKey: string }> = {
  // client
  Home: { icon: 'home', labelKey: 'tabs.client.home' },
  Train: { icon: 'dumbbell', labelKey: 'tabs.client.train' },
  Videos: { icon: 'video', labelKey: 'tabs.client.videos' },
  Profile: { icon: 'user', labelKey: 'tabs.client.profile' },
  // trainer
  Clients: { icon: 'users', labelKey: 'tabs.pt.clients' },
  Plans: { icon: 'plans', labelKey: 'tabs.pt.plans' },
  Uploads: { icon: 'upload', labelKey: 'tabs.pt.uploads' },
  PtProfile: { icon: 'user', labelKey: 'tabs.pt.profile' },
};

export interface FP_TabBarProps extends BottomTabBarProps {}

export const FP_TabBar: React.FC<FP_TabBarProps> = ({ state, navigation }) => {
  const { t } = useContent();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TABS[route.name];
        const color = focused ? FP_COLORS.accent : FP_COLORS.muted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta ? t(meta.labelKey) : route.name}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.tab}
          >
            <FP_Icon name={meta?.icon ?? 'home'} size={24} color={color} strokeWidth={1.9} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {meta ? t(meta.labelKey) : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 14,
    // `rgba(11,15,13,.85)` + backdrop-filter in the prototype; RN has no blur without a native
    // module, so we use the opaque token — visually equivalent over this dark background.
    backgroundColor: FP_COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FP_COLORS.line,
    ...Platform.select({ android: { elevation: 8 }, default: {} }),
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 10.5, fontWeight: '600' },
});

export default FP_TabBar;
