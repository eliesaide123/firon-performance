import React from 'react';
import { Pressable, StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_SPACING } from '../theme';
import FP_Icon from './FP_Icon';
import { useGuestGate } from '../guest/GuestGateProvider';

export interface FP_SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Opt out of the guest gate. */
  guestAllowed?: boolean;
}

/** `.search-in`: magnifier + borderless input inside a surface-2 field. */
export const FP_SearchInput: React.FC<FP_SearchInputProps> = ({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onSubmitEditing,
  style,
  testID,
  guestAllowed,
}) => {
  const { isGuest, gate } = useGuestGate();
  const gated = isGuest && !guestAllowed;
  return (
  <View style={[styles.wrap, style]}>
    <FP_Icon name="search" size={18} color={FP_COLORS.muted} strokeWidth={2} />
    <TextInput
      testID={testID}
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={FP_COLORS.muted}
      selectionColor={FP_COLORS.accent}
      keyboardAppearance="dark"
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus={autoFocus}
      returnKeyType="search"
      onSubmitEditing={onSubmitEditing}
      editable={!gated}
    />
    {gated ? (
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => gate('search')}
        accessibilityRole="button"
        accessibilityLabel="Sign in to search"
      />
    ) : null}
  </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FP_SPACING.sm + 2,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    borderRadius: FP_RADIUS.input,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: FP_COLORS.text },
});

export default FP_SearchInput;
