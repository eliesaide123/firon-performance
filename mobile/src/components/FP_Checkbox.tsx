import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS } from '../theme';
import { FP_Icon } from './FP_Icon';
import { useGatedPress, useGuestGate } from '../guest/GuestGateProvider';

export interface FP_CheckboxProps {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  checked: boolean;
  onPress?: () => void;
  /** shown instead of the tick when unchecked — the week sheet puts the day number here */
  glyph?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  glyphStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** `.checkbox`: 26px, lime when done. */
export const FP_Checkbox: React.FC<FP_CheckboxProps> = ({
  checked,
  onPress,
  glyph,
  disabled,
  style,
  glyphStyle,
  accessibilityLabel,
  testID,
  guestAllowed,
}) => {
  const handlePress = useGatedPress(onPress, guestAllowed);
  return (
  <Pressable
    testID={testID}
    accessibilityRole="checkbox"
    accessibilityState={{ checked, disabled: Boolean(disabled) }}
    accessibilityLabel={accessibilityLabel}
    onPress={disabled ? undefined : handlePress}
    hitSlop={8}
    style={[styles.box, checked && styles.done, style]}
  >
    {checked ? (
      <FP_Icon name="check" size={16} color={FP_COLORS.onAccent} />
    ) : glyph ? (
      <Text style={[styles.glyph, glyphStyle]}>{glyph}</Text>
    ) : null}
    </Pressable>
  );
};

/** `.done-text`: strike-through + muted, applied to a checked item's label. */
export const FP_DONE_TEXT: TextStyle = {
  textDecorationLine: 'line-through',
  color: FP_COLORS.muted,
};

const styles = StyleSheet.create({
  box: {
    width: 26,
    height: 26,
    borderRadius: FP_RADIUS.checkbox,
    borderWidth: 2,
    borderColor: FP_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  done: { backgroundColor: FP_COLORS.accent, borderColor: FP_COLORS.accent },
  glyph: { fontSize: 12, fontWeight: '700', color: FP_COLORS.muted },
});

export default FP_Checkbox;
