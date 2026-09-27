import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { FP_COLORS, FP_RADIUS, FP_SPACING } from '../theme';
import FP_Spinner from './FP_Spinner';
import { useGatedPress } from '../guest/GuestGateProvider';

export type FP_ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface FP_ButtonProps {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  title: string;
  onPress?: () => void;
  variant?: FP_ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  /** the prototype's buttons are full-width by default */
  fullWidth?: boolean;
  /** `padding:13px` variant used inside the today's-session card */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/** `.btn` + `.btn.secondary|.ghost|.danger`, with the prototype's 0.98 press scale. */
export const FP_Button: React.FC<FP_ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  compact = false,
  style,
  textStyle,
  testID,
  accessibilityLabel,
  guestAllowed,
}) => {
  const inert = disabled || loading;
  const handlePress = useGatedPress(onPress, guestAllowed);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inert }}
      onPress={inert ? undefined : handlePress}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        compact && styles.compact,
        VARIANTS[variant].container,
        pressed && !inert && styles.pressed,
        inert && styles.inert,
        style,
      ]}
    >
      {loading ? (
        <FP_Spinner color={variant === 'primary' ? FP_COLORS.onAccent : FP_COLORS.accent} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text style={[styles.label, VARIANTS[variant].label, textStyle]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: FP_SPACING.sm,
    padding: FP_SPACING.lg,
    borderRadius: FP_RADIUS.button,
    borderWidth: 1,
    borderColor: FP_COLORS.accent,
  },
  fullWidth: { width: '100%' },
  compact: { padding: 13 },
  pressed: { transform: [{ scale: 0.98 }] },
  inert: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '700' },
});

const VARIANTS: Record<FP_ButtonVariant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    container: { backgroundColor: FP_COLORS.accent, borderColor: FP_COLORS.accent },
    label: { color: FP_COLORS.onAccent },
  },
  secondary: {
    container: { backgroundColor: FP_COLORS.surface2, borderColor: FP_COLORS.line },
    label: { color: FP_COLORS.text },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: FP_COLORS.line },
    label: { color: FP_COLORS.accent },
  },
  danger: {
    container: { backgroundColor: 'transparent', borderColor: FP_COLORS.dangerSoft },
    label: { color: FP_COLORS.danger },
  },
};

export default FP_Button;
