import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { FP_COLORS, FP_EXTRA_COLORS, FP_RADIUS } from '../theme';

export interface FP_ToastProps {
  message: string;
  anim: Animated.Value;
  /** 96 in the prototype — clear of the bottom tab bar */
  bottom?: number;
}

/** `.toast`: floating light pill, auto-hidden by FP_ToastProvider after 1.8s. */
export const FP_Toast: React.FC<FP_ToastProps> = ({ message, anim, bottom = 96 }) => (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.wrap,
      {
        bottom,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      },
    ]}
  >
    <Text style={styles.text} numberOfLines={2}>
      {message}
    </Text>
  </Animated.View>
);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center', zIndex: 80 },
  text: {
    backgroundColor: FP_EXTRA_COLORS.toast,
    color: FP_COLORS.onAccent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: FP_RADIUS.thumb,
    fontSize: 13.5,
    fontWeight: '600',
    overflow: 'hidden',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});

export default FP_Toast;
