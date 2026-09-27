import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FP_COLORS, FP_GUTTER, FP_RADIUS, FP_SPACING } from '../theme';

export interface FP_ModalProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** tapping the scrim closes; off for blocking dialogs */
  dismissOnBackdrop?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Centred panel over a scrim. Android back / iOS swipe-down both call `onClose`. */
export const FP_Modal: React.FC<FP_ModalProps> = ({
  visible,
  onClose,
  children,
  dismissOnBackdrop = true,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable
            style={styles.backdrop}
            onPress={dismissOnBackdrop ? onClose : undefined}
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            {
              opacity: anim,
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: FP_GUTTER },
  backdrop: { flex: 1, backgroundColor: FP_COLORS.backdrop },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: FP_COLORS.surface,
    borderWidth: 1,
    borderColor: FP_COLORS.line,
    borderRadius: FP_RADIUS.card,
    padding: FP_SPACING.xl,
  },
});

export default FP_Modal;
