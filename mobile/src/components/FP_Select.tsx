import React, { useState } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_SPACING, FP_TYPE } from '../theme';
import FP_Icon from './FP_Icon';
import FP_Label from './FP_Label';
import FP_Modal from './FP_Modal';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_SelectOption<T extends string | number> {
  value: T;
  label: string;
  subtitle?: string;
}

export interface FP_SelectProps<T extends string | number> {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  options: readonly FP_SelectOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  /** dialog heading */
  title?: string;
  error?: string | null;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Tap-to-open picker. RN has no native dropdown, so this is a modal option list. */
export function FP_Select<T extends string | number>({
  options,
  value,
  onChange,
  label,
  placeholder,
  title,
  error,
  disabled = false,
  style,
  guestAllowed,
}: FP_SelectProps<T>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const handleOpen = useGatedPress(() => setOpen(true), guestAllowed);
  const selected = options.find(option => option.value === value);

  return (
    <View style={style}>
      {label ? <FP_Label style={styles.label}>{label}</FP_Label> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        onPress={disabled ? undefined : handleOpen}
        style={[styles.field, Boolean(error) && styles.invalid, disabled && styles.disabled]}
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder ?? '—'}
        </Text>
        <FP_Icon name="chevron-right" size={16} color={FP_COLORS.muted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FP_Modal visible={open} onClose={() => setOpen(false)}>
        {title || label ? <Text style={FP_TYPE.sheetTitle}>{title ?? label}</Text> : null}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {options.map(option => {
            const active = option.value === value;
            return (
              <Pressable
                key={String(option.value)}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={styles.optionBody}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  {option.subtitle ? <Text style={FP_TYPE.sub}>{option.subtitle}</Text> : null}
                </View>
                {active ? <FP_Icon name="check" size={16} color={FP_COLORS.accent} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </FP_Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 7 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: FP_SPACING.sm,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    borderRadius: FP_RADIUS.input,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  invalid: { borderColor: FP_COLORS.danger },
  disabled: { opacity: 0.5 },
  value: { flex: 1, fontSize: 15, color: FP_COLORS.text },
  placeholder: { color: FP_COLORS.muted },
  error: { color: FP_COLORS.danger, fontSize: 12, marginTop: 6 },
  list: { maxHeight: 360, marginTop: FP_SPACING.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FP_SPACING.md,
    paddingVertical: 14,
    paddingHorizontal: FP_SPACING.md,
    borderRadius: FP_RADIUS.input,
  },
  optionActive: { backgroundColor: FP_COLORS.accentSoft },
  optionBody: { flex: 1 },
  optionText: { fontSize: 15, color: FP_COLORS.text },
  optionTextActive: { color: FP_COLORS.accent, fontWeight: '700' },
});

export default FP_Select;
