import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { FP_COLORS } from '../theme';
import { useGatedPress } from '../guest/GuestGateProvider';

export interface FP_FabProps {
  /** Opt out of the guest gate (auth screens, the guest banner CTA, alert/toast controls). */
  guestAllowed?: boolean;
  onPress: () => void;
  glyph?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** `.fab`: 56px lime disc pinned bottom-right with a lime glow. */
export const FP_Fab: React.FC<FP_FabProps> = ({
  onPress,
  glyph = '+',
  icon,
  style,
  accessibilityLabel,
  guestAllowed,
}) => {
  const handlePress = useGatedPress(onPress, guestAllowed);
  return (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPress={handlePress}
    style={({ pressed }) => [styles.fab, pressed && styles.pressed, style]}
  >
    {icon ?? <Text style={styles.glyph}>{glyph}</Text>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: FP_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: FP_COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    zIndex: 20,
  },
  pressed: { transform: [{ scale: 0.96 }] },
  glyph: { fontSize: 26, color: FP_COLORS.onAccent, fontWeight: '600', lineHeight: 30 },
});

export default FP_Fab;
