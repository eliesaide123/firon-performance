/*
 * Chart parameters, derived from the shared tokens.
 *
 * Every chart plots ONE measure, so each is a single-hue magnitude chart with
 * no categorical scale to confuse — except the media breakdown, which uses the
 * reserved STATUS palette (state, not series) and therefore always ships a
 * legend plus direct labels, never colour alone.
 *
 * Palette validation on the dark surface: the status trio passes chroma, CVD
 * separation (worst adjacent ΔE 13.0 deutan), the normal-vision floor (17.7)
 * and contrast. The accent/accent2 pair fails the normal-vision floor (ΔE 14.8)
 * so those two are NEVER adjacent categories in one scale.
 */
import { FP_COLORS } from '@firon/shared';

export const FP_CHART = {
  single: FP_COLORS.accent,
  singleAlt: FP_COLORS.accent2,
  grid: FP_COLORS.line,
  axis: FP_COLORS.muted,
  surface: FP_COLORS.surface,
  text: FP_COLORS.text,
} as const;

/** Reserved status palette — state only, never "series 4". */
export const FP_STATUS_COLORS = {
  approved: FP_COLORS.accent2,
  pending: FP_COLORS.warn,
  rejected: FP_COLORS.danger,
} as const;

export const fpAxisProps = {
  stroke: FP_CHART.axis,
  tick: { fill: FP_CHART.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const fpTooltipProps = {
  contentStyle: {
    background: FP_COLORS.surface2,
    border: `1px solid ${FP_COLORS.line}`,
    borderRadius: 11,
    fontSize: 12,
    color: FP_COLORS.text,
  },
  labelStyle: { color: FP_COLORS.muted, fontSize: 11 },
  itemStyle: { color: FP_COLORS.text },
  cursor: { fill: 'rgba(255,255,255,.04)' },
} as const;
