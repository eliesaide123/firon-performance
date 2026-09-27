/**
 * React Navigation theme.
 *
 * The only thing that matters here is that `colors.background` is the `bg` token: React
 * Navigation paints the scene container itself, and its default is white — which shows as a
 * white flash between screens and behind a modal transition on a dark-only app (CONTRACT §2).
 */
import { DarkTheme, type Theme } from '@react-navigation/native';
import { FP_COLORS } from '../theme';

export const FP_NAV_THEME: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: FP_COLORS.accent,
    background: FP_COLORS.bg,
    card: FP_COLORS.surface,
    text: FP_COLORS.text,
    border: FP_COLORS.line,
    notification: FP_COLORS.danger,
  },
};

export default FP_NAV_THEME;
