import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS } from '../theme';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_ChipProps {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  /** the compact inline variant used as an On/Off toggle in the PT profile */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/** `.chip` / `.chip.active` — pill, lime when selected. */
export const FP_Chip: React.FC<FP_ChipProps> = ({
  label,
  active = false,
  onPress,
  icon,
  small = false,
  style,
  textStyle,
  testID,
  guestAllowed,
}) => {
  const handlePress = useGatedPress(onPress, guestAllowed);
  return (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={handlePress}
    style={({ pressed }) => [
      styles.chip,
      small && styles.small,
      active && styles.active,
      pressed && styles.pressed,
      style,
    ]}
  >
    {icon ? <View>{icon}</View> : null}
    <Text
      style={[styles.text, small && styles.textSmall, active && styles.textActive, textStyle]}
      numberOfLines={1}
    >
      {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: FP_RADIUS.chip,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
  },
  small: { paddingVertical: 5, paddingHorizontal: 12 },
  active: { backgroundColor: FP_COLORS.accent, borderColor: FP_COLORS.accent },
  pressed: { transform: [{ scale: 0.98 }] },
  text: { fontSize: 13, color: FP_COLORS.text },
  textSmall: { fontSize: 12 },
  textActive: { color: FP_COLORS.onAccent, fontWeight: '700' },
});

export default FP_Chip;
