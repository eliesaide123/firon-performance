import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_EXTRA_RADIUS, FP_SPACING } from '../theme';
import { useGatedPress, useGuestGate } from '../guest/GuestGateProvider';

export interface FP_SegmentedProps<T extends string | number> {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  options: readonly T[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  /** so labels can come from the CMS rather than the raw option */
  labelFor?: (option: T) => string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** `.seg` — inset track with a lime active pill. */
export function FP_Segmented<T extends string | number>({
  options,
  value,
  onChange,
  labelFor,
  style,
  testID,
  guestAllowed,
}: FP_SegmentedProps<T>): React.ReactElement {
  const handleChange = useGatedPress(onChange, guestAllowed);
  return (
    <View style={[styles.track, style]} testID={testID}>
      {options.map(option => {
        const active = option === value;
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => handleChange?.(option)}
            style={[styles.button, active && styles.buttonActive]}
          >
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
              {labelFor ? labelFor(option) : String(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    borderRadius: FP_EXTRA_RADIUS.seg,
    padding: FP_SPACING.xs,
    gap: FP_SPACING.xs,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: FP_EXTRA_RADIUS.segButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: { backgroundColor: FP_COLORS.accent },
  text: { fontSize: 13, fontWeight: '600', color: FP_COLORS.muted },
  textActive: { color: FP_COLORS.onAccent },
});

export default FP_Segmented;
