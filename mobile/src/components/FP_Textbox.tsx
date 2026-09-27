import React, { forwardRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_SPACING, FP_TYPE } from '../theme';
import FP_Label from './FP_Label';
import { useGuestGate } from '../guest/GuestGateProvider';

export interface FP_TextboxProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label?: string;
  /** inline `.err-msg` under the field; also paints the red border */
  error?: string | null;
  /** red border without a message (when one message covers a whole row) */
  invalid?: boolean;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** password field with a show/hide toggle */
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  /** compact padding, used by the availability time row */
  dense?: boolean;
  /** Opt out of the guest gate — set on the auth screens' own fields. */
  guestAllowed?: boolean;
}

/**
 * `.field` + `.input`: lime focus ring, danger border on error, `.err-msg` beneath.
 */
export const FP_Textbox = forwardRef<ComponentRef<typeof TextInput>, FP_TextboxProps>(function FP_Textbox(
  {
    label,
    error,
    invalid,
    hint,
    leftIcon,
    rightIcon,
    secure = false,
    containerStyle,
    fieldStyle,
    dense = false,
    guestAllowed,
    onFocus,
    onBlur,
    editable,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const bad = Boolean(error) || Boolean(invalid);
  // A guest must not be able to type into a field (CONTRACT §13.5): the input goes
  // read-only and an absolute Pressable over the field opens the login modal instead.
  const { isGuest, gate } = useGuestGate();
  const gated = isGuest && !guestAllowed;

  return (
    <View style={containerStyle}>
      {label ? <FP_Label style={styles.label}>{label}</FP_Label> : null}
      <View
        style={[
          styles.field,
          dense && styles.fieldDense,
          focused && styles.focused,
          bad && styles.errored,
          editable === false && styles.readonly,
          fieldStyle,
        ]}
      >
        {leftIcon}
        <TextInput
          ref={ref}
          style={[styles.input, dense && styles.inputDense]}
          placeholderTextColor={FP_COLORS.muted}
          selectionColor={FP_COLORS.accent}
          keyboardAppearance="dark"
          secureTextEntry={secure && !revealed}
          editable={gated ? false : editable}
          onFocus={event => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={event => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed(value => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Text style={styles.reveal}>{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : (
          rightIcon
        )}
        {gated ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => gate('textbox')}
            accessibilityRole="button"
            accessibilityLabel="Sign in to edit"
          />
        ) : null}
      </View>
      {error ? <Text style={styles.errMsg}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { marginBottom: 7 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FP_SPACING.sm,
    borderRadius: FP_RADIUS.input,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    paddingHorizontal: 14,
  },
  fieldDense: { paddingHorizontal: 9 },
  focused: { borderColor: FP_COLORS.accent },
  errored: { borderColor: FP_COLORS.danger },
  readonly: { opacity: 0.6 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: FP_COLORS.text },
  inputDense: { paddingVertical: 9, fontSize: 13 },
  reveal: { ...FP_TYPE.label, color: FP_COLORS.accent },
  errMsg: { color: FP_COLORS.danger, fontSize: 12, marginTop: 6 },
  hint: { ...FP_TYPE.tiny, marginTop: 6 },
});

/** Standalone `.err-msg` for a shared, row-level message (e.g. the height/weight pair). */
export const FP_FieldError: React.FC<{ message: string; visible: boolean }> = ({
  message,
  visible,
}) => (visible ? <Text style={styles.errMsg}>{message}</Text> : null);

export default FP_Textbox;
