/**
 * The prototype's `<div class="row between"><h2>…</h2><a class="accent">View all</a></div>`
 * section header, with an optional muted sub-line underneath.
 *
 * Lives under `screens/client/` (not the shared component folder) because it is a composite of
 * existing FP_ primitives owned by the client screens — CONTRACT §12 still applies: `FP_` prefix,
 * one component per file, tokens only, and the guest gate is wired through `useGatedPress`.
 */
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../../../theme';
import { useGatedPress } from '../../../guest/GuestGateProvider';

export interface FP_SectionHeaderProps {
  title: string;
  /** small muted line under the title — e.g. `home.suggested_sub` */
  sub?: string;
  /** the accent text link on the right, e.g. `home.view_all` */
  actionLabel?: string;
  onPressAction?: () => void;
  /** the action is pure navigation into a preview-safe screen, so it may stay open to guests */
  guestAllowed?: boolean;
  /** `sectionTitleSm` (15px) instead of the 17px ramp — the Profile card headers */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const FP_SectionHeader: React.FC<FP_SectionHeaderProps> = ({
  title,
  sub,
  actionLabel,
  onPressAction,
  guestAllowed,
  small = false,
  style,
}) => {
  const handleAction = useGatedPress(onPressAction, guestAllowed);

  return (
    <View style={style}>
      <View style={styles.row}>
        <Text style={small ? FP_TYPE.sectionTitleSm : FP_TYPE.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {actionLabel && onPressAction ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={actionLabel}
            onPress={handleAction}
            hitSlop={8}
          >
            {({ pressed }) => (
              <Text style={[styles.link, pressed && styles.linkPressed]}>{actionLabel}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {sub ? <Text style={[FP_TYPE.subSm, styles.sub]}>{sub}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: FP_SPACING.md,
  },
  link: { ...FP_TYPE.sub, color: FP_COLORS.accent, fontWeight: '600' },
  linkPressed: { opacity: 0.6 },
  sub: { marginTop: 3 },
});

export default FP_SectionHeader;
