/**
 * Firon Performance — design tokens, lifted from the approved prototype (docs/CONTRACT.md §2).
 * Shared so the CMS and the mobile app cannot drift apart. Values are plain strings/numbers,
 * consumable as CSS variables on web and as StyleSheet values on React Native.
 */

export const FP_COLORS = {
  accent: '#c7ff3f',
  accent2: '#7cf5c4',
  bg: '#0b0f0d',
  surface: '#14191b',
  surface2: '#1c2327',
  surface3: '#242c31',
  text: '#f2f6f4',
  muted: '#8c9a95',
  line: '#242c2e',
  danger: '#ff6b6b',
  warn: '#ffcf4a',
  onAccent: '#0b0f0d',
  /** translucent fills used by badges and selected states */
  accentSoft: 'rgba(199,255,63,0.08)',
  accentSoftBorder: 'rgba(199,255,63,0.15)',
  okSoft: 'rgba(124,245,196,0.15)',
  warnSoft: 'rgba(255,196,0,0.15)',
  dangerSoft: 'rgba(255,107,107,0.4)',
  backdrop: 'rgba(0,0,0,0.55)',
} as const;

export const FP_RADIUS = {
  card: 18,
  button: 15,
  input: 13,
  chip: 999,
  sheet: 26,
  thumb: 14,
  checkbox: 8,
  iconBtn: 12,
} as const;

export const FP_SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

export const FP_FONT_SIZE = {
  screenTitle: 26,
  sectionTitle: 17,
  cardTitle: 15,
  body: 15,
  label: 12.5,
  sub: 13,
  tiny: 11,
  badge: 10.5,
  stat: 22,
} as const;

export const FP_FONT_WEIGHT = {
  regular: '400',
  medium: '600',
  semibold: '700',
  bold: '800',
} as const;

/** Media placeholder gradients — index into this with `Video.gradientIndex`. */
export const FP_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#134e5e', '#71b280'],
  ['#42275a', '#734b6d'],
  ['#0f2027', '#2c5364'],
  ['#603813', '#b29f94'],
  ['#1f4037', '#99f2c8'],
  ['#232526', '#414345'],
  ['#3a1c71', '#d76d77'],
  ['#093028', '#237a57'],
];

export function fpGradient(index: number): readonly [string, string] {
  return FP_GRADIENTS[((index % FP_GRADIENTS.length) + FP_GRADIENTS.length) % FP_GRADIENTS.length]!;
}

/** CSS gradient string for the web CMS. */
export function fpGradientCss(index: number, angle = '135deg'): string {
  const [from, to] = fpGradient(index);
  return `linear-gradient(${angle},${from},${to})`;
}

/** Adherence colour thresholds from the prototype roster. */
export function fpAdherenceColor(pct: number): string {
  if (pct >= 80) return FP_COLORS.accent;
  if (pct >= 70) return FP_COLORS.warn;
  return FP_COLORS.danger;
}

/** Emits the token set as CSS custom properties for the CMS stylesheet. */
export function fpCssVariables(): string {
  return [
    `--accent:${FP_COLORS.accent}`,
    `--accent-2:${FP_COLORS.accent2}`,
    `--bg:${FP_COLORS.bg}`,
    `--surface:${FP_COLORS.surface}`,
    `--surface-2:${FP_COLORS.surface2}`,
    `--surface-3:${FP_COLORS.surface3}`,
    `--text:${FP_COLORS.text}`,
    `--muted:${FP_COLORS.muted}`,
    `--line:${FP_COLORS.line}`,
    `--danger:${FP_COLORS.danger}`,
    `--warn:${FP_COLORS.warn}`,
    `--radius:${FP_RADIUS.card}px`,
  ].join(';');
}
