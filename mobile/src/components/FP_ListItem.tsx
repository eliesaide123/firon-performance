import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_SPACING, FP_TYPE } from '../theme';
import { FP_DONE_TEXT } from './FP_Checkbox';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_ListItemProps {
  /** Opt out of the guest gate (auth screens, alert/toast controls). */
  guestAllowed?: boolean;
  /** avatar, checkbox or thumbnail on the left */
  left?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** badge, price, chevron or icon button on the right */
  right?: React.ReactNode;
  /** rendered instead of title/subtitle when a row needs custom content */
  children?: React.ReactNode;
  onPress?: () => void;
  /** tapping only the middle column (the prototype does this in the diet builder) */
  onPressBody?: () => void;
  /** strike through the title — the prototype's `.done-text` */
  done?: boolean;
  /** the prototype drops the hairline on `:last-child` */
  last?: boolean;
  /** extra node next to the title, e.g. a "Logged" badge */
  titleAdornment?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** `.list-item`: left slot + title/subtitle + right slot, with a bottom hairline. */
export const FP_ListItem: React.FC<FP_ListItemProps> = ({
  left,
  title,
  subtitle,
  right,
  children,
  onPress,
  onPressBody,
  guestAllowed,
  done,
  last,
  titleAdornment,
  style,
  testID,
}) => {
  const handlePress = useGatedPress(onPress, guestAllowed);
  const handlePressBody = useGatedPress(onPressBody, guestAllowed);
  const body = children ?? (
    <>
      <View style={styles.titleRow}>
        {title ? (
          <Text style={[FP_TYPE.bodyBold, done && FP_DONE_TEXT]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {titleAdornment}
      </View>
      {subtitle ? (
        <Text style={[FP_TYPE.sub, styles.subtitle]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  const inner = (
    <>
      {left}
      {onPressBody ? (
        <Pressable style={styles.grow} onPress={handlePressBody}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.grow}>{body}</View>
      )}
      {right}
    </>
  );

  const composed = [styles.item, last && styles.last, style];

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={handlePress}
        style={({ pressed }) => [...composed, pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={composed}>
      {inner}
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: FP_COLORS.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.7 },
  grow: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: FP_SPACING.sm, flexWrap: 'wrap' },
  subtitle: { marginTop: 2 },
});

export default FP_ListItem;
