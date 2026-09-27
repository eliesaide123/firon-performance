import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_TYPE } from '../theme';
import FP_Label from './FP_Label';
import { useGuestGate } from '../guest/GuestGateProvider';

export interface FP_TextareaProps {
  /** Opt out of the guest gate. */
  guestAllowed?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  error?: string | null;
  maxLength?: number;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
}

/** Multi-line input that grows with its content and can show a character counter. */
export const FP_Textarea: React.FC<FP_TextareaProps> = ({
  value,
  onChangeText,
  guestAllowed,
  label,
  placeholder,
  error,
  maxLength,
  minHeight = 84,
  style,
}) => {
  const { isGuest, gate } = useGuestGate();
  const gated = isGuest && !guestAllowed;
  const [focused, setFocused] = useState(false);
  const [height, setHeight] = useState(minHeight);

  return (
    <View style={style}>
      {label ? <FP_Label style={styles.label}>{label}</FP_Label> : null}
      <View style={[styles.field, focused && styles.focused, Boolean(error) && styles.errored]}>
        <TextInput
          style={[styles.input, { height: Math.max(minHeight, height) }]}
          value={value}
          onChangeText={onChangeText}
          editable={!gated}
          placeholder={placeholder}
          placeholderTextColor={FP_COLORS.muted}
          selectionColor={FP_COLORS.accent}
          keyboardAppearance="dark"
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
          onContentSizeChange={event => setHeight(event.nativeEvent.contentSize.height + 16)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {gated ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => gate('textarea')}
            accessibilityRole="button"
            accessibilityLabel="Sign in to edit"
          />
        ) : null}
      </View>
      <View style={styles.footer}>
        {error ? <Text style={styles.errMsg}>{error}</Text> : <View />}
        {maxLength ? (
          <Text style={FP_TYPE.tiny}>
            {value.length} / {maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 7 },
  field: {
    borderRadius: FP_RADIUS.input,
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    paddingHorizontal: 14,
  },
  focused: { borderColor: FP_COLORS.accent },
  errored: { borderColor: FP_COLORS.danger },
  input: { paddingVertical: 12, fontSize: 15, color: FP_COLORS.text },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  errMsg: { color: FP_COLORS.danger, fontSize: 12 },
});

export default FP_Textarea;
