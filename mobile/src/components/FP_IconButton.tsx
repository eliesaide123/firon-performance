import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { FP_COLORS, FP_RADIUS } from '../theme';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_IconButtonProps {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  /** rendered at the top-right, for the notification count on the bell */
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** `.icon-btn`: 42px rounded square on surface-2. */
export const FP_IconButton: React.FC<FP_IconButtonProps> = ({
  children,
  onPress,
  size = 42,
  badge,
  style,
  accessibilityLabel,
  testID,
  guestAllowed,
}) => {
  const handlePress = useGatedPress(onPress, guestAllowed);
  return (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPress={handlePress}
    style={({ pressed }) => [
      styles.button,
      { width: size, height: size, borderRadius: size >= 40 ? FP_RADIUS.iconBtn : 10 },
      pressed && styles.pressed,
      style,
    ]}
  >
    {children}
    {badge ? <View style={styles.badge}>{badge}</View> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: FP_COLORS.surface2,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: { transform: [{ scale: 0.96 }] },
  badge: { position: 'absolute', top: -5, right: -5 },
});

export default FP_IconButton;
