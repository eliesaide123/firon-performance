import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { FP_COLORS, FP_GRADIENT_DIRECTION } from '../theme';

export type FP_AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface FP_AvatarProps {
  /** full name — initials are derived like the prototype's `initials()` */
  name?: string;
  /**
   * Render a glyph instead of initials. A plain emoji/string is wrapped in `<Text>` for you —
   * React Native throws "Text strings must be rendered within a <Text> component" otherwise, and
   * most callers pass an emoji.
   */
  glyph?: React.ReactNode;
  size?: FP_AvatarSize | number;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<FP_AvatarSize, number> = { sm: 38, md: 44, lg: 64, xl: 88 };

export function fpInitials(name: string | null | undefined): string {
  if (!name) {
    return '?';
  }
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => (part[0] ? part[0].toUpperCase() : ''))
    .join('');
}

/** `.avatar`: a lime→mint 135deg gradient disc with dark initials. */
export const FP_Avatar: React.FC<FP_AvatarProps> = ({ name, glyph, size = 'md', style }) => {
  const px = typeof size === 'number' ? size : SIZES[size];
  return (
    <LinearGradient
      colors={[FP_COLORS.accent, FP_COLORS.accent2]}
      start={FP_GRADIENT_DIRECTION.start}
      end={FP_GRADIENT_DIRECTION.end}
      style={[styles.avatar, { width: px, height: px, borderRadius: px / 2 }, style]}
    >
      {glyph ? (
        <View style={styles.center}>
          {typeof glyph === 'string' || typeof glyph === 'number' ? (
            <Text style={[styles.glyph, { fontSize: Math.round(px * 0.45) }]}>{glyph}</Text>
          ) : (
            glyph
          )}
        </View>
      ) : (
        <Text style={[styles.text, { fontSize: Math.round(px * 0.36) }]}>{fpInitials(name)}</Text>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  text: { color: FP_COLORS.onAccent, fontWeight: '800' },
  glyph: { textAlign: 'center' },
});

export default FP_Avatar;
