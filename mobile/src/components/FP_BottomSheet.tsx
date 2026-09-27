import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FP_COLORS, FP_GUTTER, FP_RADIUS } from '../theme';

export interface FP_BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** false when the sheet's own content scrolls */
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * `.sheet`: slide-up panel, 82% max height, 26px top corners, scrim backdrop
 * (tap to close) and a grab handle.
 */
export const FP_BottomSheet: React.FC<FP_BottomSheetProps> = ({
  visible,
  onClose,
  children,
  scrollable = true,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const maxHeight = Dimensions.get('window').height * 0.82;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  const body = (
    <View style={[styles.body, { paddingBottom: 30 + insets.bottom }, style]}>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.wrap}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [maxHeight, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.grab} />
          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: FP_COLORS.backdrop },
  sheet: {
    backgroundColor: FP_COLORS.surface,
    borderTopLeftRadius: FP_RADIUS.sheet,
    borderTopRightRadius: FP_RADIUS.sheet,
    paddingTop: 10,
  },
  grab: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: FP_COLORS.line,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  scrollContent: { flexGrow: 1 },
  body: { paddingHorizontal: FP_GUTTER },
});

export default FP_BottomSheet;
