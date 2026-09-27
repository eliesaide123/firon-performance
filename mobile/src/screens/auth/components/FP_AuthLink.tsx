/**
 * The prototype's inline `<a class="accent">` text links — "Forgot password?",
 * "Create account", "Resend code". A pressable label, never a button.
 *
 * Always `guestAllowed`: these live on the auth screens, so the gate must not intercept them
 * (CONTRACT §13.2) — a guest tapping "Create account" has to reach Register.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { useContent } from '../../../cms/ContentProvider';
import { FP_COLORS } from '../../../theme';

export interface FP_AuthLinkProps {
  /** CMS key for the label — no user-visible string is ever hardcoded (CONTRACT §8). */
  k: string;
  onPress: () => void;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export const FP_AuthLink: React.FC<FP_AuthLinkProps> = ({ k, onPress, style, testID }) => {
  const { t } = useContent();
  const label = t(k);
  const handlePress = useCallback(() => onPress(), [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={label}
      testID={testID ?? `auth-link:${k}`}
    >
      {({ pressed }) => (
        <Text style={[styles.link, pressed && styles.pressed, style]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  link: { color: FP_COLORS.accent, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});

export default FP_AuthLink;
