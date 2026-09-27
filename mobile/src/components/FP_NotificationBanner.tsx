import React, { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NotificationType } from '@firon/shared';
import { FP_COLORS, FP_RADIUS, FP_SPACING, FP_TYPE } from '../theme';
import FP_Icon, { FP_IconName } from './FP_Icon';

/** One glyph + accent per notification type, so the banner reads before the text does. */
const TYPE_ICON: Record<NotificationType, { icon: FP_IconName; tint: string }> = {
  plan_assigned: { icon: 'clipboard', tint: FP_COLORS.accent },
  plan_updated: { icon: 'clipboard', tint: FP_COLORS.accent },
  session_reminder: { icon: 'bell', tint: FP_COLORS.accent2 },
  media_approved: { icon: 'check', tint: FP_COLORS.accent2 },
  media_rejected: { icon: 'warning', tint: FP_COLORS.danger },
  client_progress: { icon: 'dumbbell', tint: FP_COLORS.accent },
  new_client: { icon: 'users', tint: FP_COLORS.accent2 },
  content_updated: { icon: 'clipboard', tint: FP_COLORS.accent2 },
  message: { icon: 'bell', tint: FP_COLORS.accent },
  generic: { icon: 'bell', tint: FP_COLORS.accent },
};

const FALLBACK = TYPE_ICON.generic;

/** Past these the gesture is a dismissal, not a scroll-ish wobble. */
const SWIPE_UP = 26;
const SWIPE_SIDE = 64;

export interface FP_NotificationBannerProps {
  title: string;
  body?: string;
  /** Drives the slide-in/out; owned by the caller so it can queue banners. */
  anim: Animated.Value;
  /** Safe-area aware offset from the top of the screen. */
  top: number;
  type?: NotificationType;
  /** Emoji override coming from `notification.icon`; wins over the type glyph. */
  glyph?: string;
  /** How many more are waiting behind this one. */
  queued?: number;
  onPress?: () => void;
  /** Swiped away (up, left or right). */
  onDismiss?: () => void;
  testID?: string;
}

/**
 * The in-app heads-up banner for a `notification:new` socket event (CONTRACT §6/§12).
 *
 * Layering: this renders inside the app's root view, *not* a native `Modal`, which is what
 * guarantees it can never cover the `FP_Alert` popup (FP_Alert is an RN `Modal`, so it always
 * paints above the view hierarchy). See NotificationsProvider for the full note.
 */
export const FP_NotificationBanner: React.FC<FP_NotificationBannerProps> = ({
  title,
  body,
  anim,
  top,
  type = 'generic',
  glyph,
  queued = 0,
  onPress,
  onDismiss,
  testID,
}) => {
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const { icon, tint } = TYPE_ICON[type] ?? FALLBACK;

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Let a tap through to the Pressable; only claim real movement.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 || Math.abs(g.dx) > 10,
        onPanResponderMove: (_e, g) => {
          // Downward drag is resisted — the banner only leaves upwards or sideways.
          drag.setValue({ x: g.dx, y: g.dy > 0 ? g.dy * 0.25 : g.dy });
        },
        onPanResponderRelease: (_e, g) => {
          const away = g.dy < -SWIPE_UP || Math.abs(g.dx) > SWIPE_SIDE;
          if (away) {
            Animated.timing(drag, {
              toValue: { x: g.dx > SWIPE_SIDE ? 500 : g.dx < -SWIPE_SIDE ? -500 : 0, y: -160 },
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              drag.setValue({ x: 0, y: 0 });
              onDismiss?.();
            });
            return;
          }
          Animated.spring(drag, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        },
      }),
    [drag, onDismiss],
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
          ],
        },
      ]}
    >
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX: drag.x }, { translateY: drag.y }] }}
      >
        <Pressable
          onPress={onPress}
          style={[styles.card, { borderColor: tint }]}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${body ?? ''}`}
          testID={testID ?? 'fp-notification-banner'}
        >
          <View style={[styles.iconPill, { borderColor: tint }]}>
            {glyph ? (
              <Text style={styles.glyph}>{glyph}</Text>
            ) : (
              <FP_Icon name={icon} size={17} color={tint} />
            )}
          </View>

          <View style={styles.text}>
            <Text style={FP_TYPE.bodyBold} numberOfLines={1}>
              {title}
            </Text>
            {body ? (
              <Text style={[FP_TYPE.sub, styles.body]} numberOfLines={2}>
                {body}
              </Text>
            ) : null}
          </View>

          {queued > 0 ? (
            <View style={styles.queue}>
              <Text style={styles.queueText}>+{queued}</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.grabber} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  /* Above every in-view layer: FP_Toast is 80, the old banner was 90. */
  wrap: { position: 'absolute', left: 14, right: 14, zIndex: 9999 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FP_SPACING.md,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderRadius: FP_RADIUS.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 24,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: FP_RADIUS.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FP_COLORS.surface3,
  },
  glyph: { fontSize: 17 },
  text: { flex: 1 },
  body: { marginTop: 2 },
  queue: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: FP_RADIUS.chip,
    backgroundColor: FP_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: FP_COLORS.accentSoftBorder,
  },
  queueText: { ...FP_TYPE.tiny, color: FP_COLORS.accent },
  /* "swipe me" affordance, mirroring the FP_BottomSheet handle */
  grabber: {
    alignSelf: 'center',
    marginTop: 5,
    width: 34,
    height: 4,
    borderRadius: FP_RADIUS.chip,
    backgroundColor: FP_COLORS.line,
  },
});

export default FP_NotificationBanner;
