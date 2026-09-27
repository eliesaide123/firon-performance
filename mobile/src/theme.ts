/**
 * Mobile theme surface.
 *
 * The tokens themselves live in `@firon/shared` (CONTRACT §2/§12) — this module re-exports
 * them so components have a single import, and adds the handful of prototype values the
 * shared token set does not carry yet (the toast pill, the today's-session gradient card and
 * the media-tile chrome). Keeping them here means no component contains a colour literal.
 */
import { Platform, TextStyle } from 'react-native';
import {
  FP_COLORS,
  FP_FONT_SIZE,
  FP_FONT_WEIGHT,
  FP_GRADIENTS,
  FP_RADIUS,
  FP_SPACING,
  fpAdherenceColor,
  fpGradient,
} from '@firon/shared';

export { FP_COLORS, FP_RADIUS, FP_SPACING, FP_FONT_SIZE, FP_FONT_WEIGHT, FP_GRADIENTS, fpGradient, fpAdherenceColor };

/**
 * Prototype colours that `@firon/shared`'s FP_COLORS does not define.
 * (Reported upstream — if they land in the shared theme, delete them from here.)
 */
export const FP_EXTRA_COLORS = {
  /** `.toast` pill background */
  toast: '#eef4ef',
  /** today's-session card: `linear-gradient(135deg,#1f3a24,#122a2f)` + `border-color:#2c4a34` */
  todayFrom: '#1f3a24',
  todayTo: '#122a2f',
  todayBorder: '#2c4a34',
  /** `.thumb` base fill before its gradient paints */
  thumbBase: '#20272b',
  /** media-tile chrome */
  onMedia: '#ffffff',
  durationPill: 'rgba(0,0,0,0.65)',
  favPill: 'rgba(0,0,0,0.4)',
  playPill: 'rgba(255,255,255,0.9)',
  scrimTop: 'rgba(0,0,0,0.55)',
  transparent: 'transparent',
} as const;

/** Extra radii the prototype uses that the shared set does not name. */
export const FP_EXTRA_RADIUS = {
  stat: 14,
  seg: 12,
  segButton: 9,
  pill: 999,
} as const;

/** Screen side gutter — the prototype's `.screen { padding-inline: 20px }`. */
export const FP_GUTTER = FP_SPACING.xl;

/** 135deg in CSS == top-left → bottom-right for react-native-linear-gradient. */
export const FP_GRADIENT_DIRECTION = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

const fontFamily = Platform.select({
  ios: undefined, // system == SF Pro Text
  android: 'Roboto',
  default: undefined,
});

export const FP_TYPE = {
  screenTitle: {
    fontFamily,
    fontSize: FP_FONT_SIZE.screenTitle,
    fontWeight: FP_FONT_WEIGHT.bold,
    letterSpacing: -0.4,
    color: FP_COLORS.text,
  } as TextStyle,
  screenTitleSm: {
    fontFamily,
    fontSize: 22,
    fontWeight: FP_FONT_WEIGHT.bold,
    letterSpacing: -0.3,
    color: FP_COLORS.text,
  } as TextStyle,
  sheetTitle: {
    fontFamily,
    fontSize: 20,
    fontWeight: FP_FONT_WEIGHT.bold,
    color: FP_COLORS.text,
  } as TextStyle,
  sectionTitle: {
    fontFamily,
    fontSize: FP_FONT_SIZE.sectionTitle,
    fontWeight: FP_FONT_WEIGHT.bold,
    color: FP_COLORS.text,
  } as TextStyle,
  sectionTitleSm: {
    fontFamily,
    fontSize: FP_FONT_SIZE.cardTitle,
    fontWeight: FP_FONT_WEIGHT.bold,
    color: FP_COLORS.text,
  } as TextStyle,
  cardTitle: {
    fontFamily,
    fontSize: 19,
    fontWeight: FP_FONT_WEIGHT.bold,
    color: FP_COLORS.text,
  } as TextStyle,
  bodyBold: {
    fontFamily,
    fontSize: FP_FONT_SIZE.body,
    fontWeight: FP_FONT_WEIGHT.semibold,
    color: FP_COLORS.text,
  } as TextStyle,
  body: {
    fontFamily,
    fontSize: FP_FONT_SIZE.body,
    fontWeight: FP_FONT_WEIGHT.regular,
    color: FP_COLORS.text,
  } as TextStyle,
  sub: {
    fontFamily,
    fontSize: FP_FONT_SIZE.sub,
    fontWeight: FP_FONT_WEIGHT.regular,
    color: FP_COLORS.muted,
  } as TextStyle,
  subSm: {
    fontFamily,
    fontSize: 12,
    fontWeight: FP_FONT_WEIGHT.regular,
    color: FP_COLORS.muted,
  } as TextStyle,
  label: {
    fontFamily,
    fontSize: FP_FONT_SIZE.label,
    fontWeight: FP_FONT_WEIGHT.medium,
    color: FP_COLORS.muted,
  } as TextStyle,
  tiny: {
    fontFamily,
    fontSize: FP_FONT_SIZE.tiny,
    fontWeight: FP_FONT_WEIGHT.regular,
    color: FP_COLORS.muted,
  } as TextStyle,
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    color: FP_COLORS.muted,
  } as TextStyle,
} as const;
