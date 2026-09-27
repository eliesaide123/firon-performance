import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_SPACING, FP_TYPE } from '../theme';
import FP_Modal from './FP_Modal';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_TimePickerProps {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  /** 'HH:mm' */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** minutes between options */
  step?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

function buildOptions(step: number): string[] {
  const out: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return out;
}

/**
 * `HH:mm` picker for the trainer's availability rows.
 *
 * The prototype uses `<input type="time">`; React Native has no such control, so this is a
 * tap-to-open list of half-hour slots — no extra native module, and it keeps the same
 * `HH:mm` string contract the `PUT /trainer/availability` payload expects.
 */
export const FP_TimePicker: React.FC<FP_TimePickerProps> = ({
  value,
  onChange,
  disabled = false,
  invalid = false,
  step = 30,
  style,
  accessibilityLabel,
  guestAllowed,
}) => {
  const [open, setOpen] = useState(false);
  const handleOpen = useGatedPress(() => setOpen(true), guestAllowed);
  const options = useMemo(() => buildOptions(step), [step]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `Time ${value}`}
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : handleOpen}
        style={[styles.field, disabled && styles.disabled, invalid && styles.invalid, style]}
      >
        <Text style={styles.value}>{value}</Text>
      </Pressable>

      <FP_Modal visible={open} onClose={() => setOpen(false)}>
        <Text style={FP_TYPE.sheetTitle}>{accessibilityLabel ?? 'Pick a time'}</Text>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {options.map(option => {
            const active = option === value;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={[styles.option, active && styles.optionActive]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </FP_Modal>
    </>
  );
};

const styles = StyleSheet.create({
  field: {
    flex: 1,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    borderRadius: FP_RADIUS.input,
    paddingVertical: 9,
    paddingHorizontal: 9,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  invalid: { borderColor: FP_COLORS.danger },
  value: { fontSize: 13, color: FP_COLORS.text },
  list: { maxHeight: 320, marginTop: FP_SPACING.md },
  option: { paddingVertical: 12, borderRadius: FP_RADIUS.input, alignItems: 'center' },
  optionActive: { backgroundColor: FP_COLORS.accentSoft },
  optionText: { fontSize: 15, color: FP_COLORS.text },
  optionTextActive: { color: FP_COLORS.accent, fontWeight: '700' },
});

export default FP_TimePicker;
