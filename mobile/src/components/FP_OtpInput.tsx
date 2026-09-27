import React, { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputKeyPressEvent,
  View,
  ViewStyle,
} from 'react-native';
import { FP_COLORS, FP_RADIUS } from '../theme';

export interface FP_OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  /** fired once the last box is filled */
  onComplete?: (code: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** `.otp`: N square boxes, auto-advance forwards and backspace-to-previous. */
export const FP_OtpInput: React.FC<FP_OtpInputProps> = ({
  value,
  onChange,
  length = 4,
  onComplete,
  invalid = false,
  autoFocus = true,
  style,
  testID,
}) => {
  const inputs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const [focusedAt, setFocusedAt] = useState(-1);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const write = (index: number, raw: string): void => {
    // Handle a paste / autofill of the whole code as well as a single keystroke.
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      return;
    }
    const next = digits.slice();
    for (let i = 0; i < clean.length && index + i < length; i += 1) {
      next[index + i] = clean[i] as string;
    }
    const code = next.join('');
    onChange(code);

    const landed = Math.min(index + clean.length, length - 1);
    if (index + clean.length >= length) {
      inputs.current[length - 1]?.blur();
      if (code.length === length) {
        onComplete?.(code);
      }
    } else {
      inputs.current[landed]?.focus();
    }
  };

  const onKeyPress = (index: number, event: TextInputKeyPressEvent): void => {
    if (event.nativeEvent.key !== 'Backspace') {
      return;
    }
    const next = digits.slice();
    if (next[index]) {
      next[index] = '';
      onChange(next.join(''));
    } else if (index > 0) {
      next[index - 1] = '';
      onChange(next.join(''));
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[styles.row, style]} testID={testID}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={ref => {
            inputs.current[index] = ref;
          }}
          style={[
            styles.box,
            focusedAt === index && styles.focused,
            invalid && styles.invalid,
          ]}
          value={digit}
          onChangeText={text => write(index, text)}
          onKeyPress={event => onKeyPress(index, event)}
          onFocus={() => setFocusedAt(index)}
          onBlur={() => setFocusedAt(-1)}
          keyboardType="number-pad"
          keyboardAppearance="dark"
          selectionColor={FP_COLORS.accent}
          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={index === 0 ? 'sms-otp' : 'off'}
          maxLength={length}
          autoFocus={autoFocus && index === 0}
          textAlign="center"
          accessibilityLabel={`Digit ${index + 1}`}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  box: {
    flex: 1,
    aspectRatio: 1,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    borderRadius: FP_RADIUS.input,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    color: FP_COLORS.text,
  },
  focused: { borderColor: FP_COLORS.accent },
  invalid: { borderColor: FP_COLORS.danger },
});

export default FP_OtpInput;
