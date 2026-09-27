/*
 * Installs the design tokens as CSS custom properties, derived from
 * `@firon/shared` so the CMS cannot drift from the mobile app or the contract.
 * This is why no component (and no stylesheet) contains a hex literal.
 */
import {
  FP_COLORS, FP_GRADIENTS, FP_RADIUS, FP_SPACING, fpCssVariables, fpGradientCss,
} from '@firon/shared';

export function installCssVariables() {
  const vars = [
    fpCssVariables(),
    `--warn:${FP_COLORS.warn}`,
    `--on-accent:${FP_COLORS.onAccent}`,
    `--accent-soft:${FP_COLORS.accentSoftBorder}`,
    `--accent-soft-2:${FP_COLORS.accentSoft}`,
    `--accent2-soft:${FP_COLORS.okSoft}`,
    `--warn-soft:${FP_COLORS.warnSoft}`,
    `--danger-soft:${FP_COLORS.dangerSoft}`,
    `--overlay:${FP_COLORS.backdrop}`,
    `--radius-card:${FP_RADIUS.card}px`,
    `--radius-btn:${FP_RADIUS.button}px`,
    `--radius-input:${FP_RADIUS.input}px`,
    `--radius-chip:${FP_RADIUS.chip}px`,
    `--radius-sheet:${FP_RADIUS.sheet}px`,
    `--radius-thumb:${FP_RADIUS.thumb}px`,
    `--radius-sm:${FP_RADIUS.checkbox}px`,
    `--radius-icon:${FP_RADIUS.iconBtn}px`,
    `--sp-1:${FP_SPACING.xs}px`,
    `--sp-2:${FP_SPACING.sm}px`,
    `--sp-3:${FP_SPACING.md}px`,
    `--sp-4:${FP_SPACING.lg}px`,
    `--sp-5:${FP_SPACING.xl}px`,
    `--sp-6:${FP_SPACING.xxl}px`,
    ...FP_GRADIENTS.map((_g, i) => `--grad-${i}:${fpGradientCss(i)}`),
  ].join(';');

  const el = document.getElementById('fp-tokens') || document.createElement('style');
  el.id = 'fp-tokens';
  el.textContent = `:root{${vars}}`;
  if (!el.parentNode) document.head.appendChild(el);
}

export default installCssVariables;
