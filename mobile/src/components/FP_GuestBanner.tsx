/**
 * The guest-preview banner (CONTRACT §13.4).
 *
 * On a fresh install the app looks signed-in, so this is deliberately small and dismissible —
 * just enough affordance that the preview isn't confusing. All three strings come from the CMS
 * (`guest.banner_title` / `guest.banner_body` / `guest.banner_cta`), so it can be softened or
 * emptied from the CMS without an app release.
 *
 * Renders nothing when there is a real session, or once dismissed for this session.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_SPACING } from '../theme';
import { useContent } from '../cms/ContentProvider';
import { useGuestGate } from '../guest/GuestGateProvider';

export interface FP_GuestBannerProps {
  testID?: string;
}

export const FP_GuestBanner: React.FC<FP_GuestBannerProps> = ({ testID }) => {
  const { t } = useContent();
  const { isGuest, gate, bannerDismissed, dismissBanner } = useGuestGate();

  if (!isGuest || bannerDismissed) return null;

  const title = t('guest.banner_title');
  const body = t('guest.banner_body');
  const cta = t('guest.banner_cta');

  // An admin can empty the copy in the CMS to hide the banner entirely.
  if (!title && !body) return null;

  return (
    <View testID={testID ?? 'guest-banner'} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.grow}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {body ? (
            <Text style={styles.body} numberOfLines={2}>
              {body}
            </Text>
          ) : null}
        </View>

        {cta ? (
          <Pressable
            onPress={() => gate('banner')}
            accessibilityRole="button"
            accessibilityLabel={cta}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>{cta}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={dismissBanner}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: FP_SPACING.lg, paddingBottom: FP_SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FP_SPACING.md,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.accentSoftBorder,
    borderRadius: FP_RADIUS.input,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
  },
  grow: { flex: 1 },
  title: { color: FP_COLORS.accent, fontSize: 12, fontWeight: '700' },
  body: { color: FP_COLORS.muted, fontSize: 12, marginTop: 1 },
  cta: {
    backgroundColor: FP_COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  ctaText: { color: FP_COLORS.onAccent, fontSize: 12.5, fontWeight: '700' },
  close: { paddingHorizontal: 4, paddingVertical: 4 },
  closeText: { color: FP_COLORS.muted, fontSize: 13, fontWeight: '700' },
});

export default FP_GuestBanner;
