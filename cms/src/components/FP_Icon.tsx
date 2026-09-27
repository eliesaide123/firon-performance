import type { LucideIcon } from 'lucide-react';
import { FP_COLORS } from '@firon/shared';

export type FP_IconTone = 'text' | 'muted' | 'accent' | 'accent2' | 'danger' | 'warn' | 'onAccent';

export interface FP_IconProps {
  /** Any lucide icon component, or one of the prototype's own glyph names. */
  icon?: LucideIcon;
  glyph?: 'logo' | 'tab-home' | 'tab-train' | 'tab-videos' | 'tab-profile';
  size?: number;
  tone?: FP_IconTone;
  className?: string;
  title?: string;
}

const TONE: Record<FP_IconTone, string> = {
  text: FP_COLORS.text,
  muted: FP_COLORS.muted,
  accent: FP_COLORS.accent,
  accent2: FP_COLORS.accent2,
  danger: FP_COLORS.danger,
  warn: FP_COLORS.warn,
  onAccent: FP_COLORS.onAccent,
};

/** Prototype SVG paths that have no lucide equivalent. */
const GLYPHS: Record<string, string[]> = {
  'tab-home': ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5'],
  'tab-train': ['M4 8v8M8 6v12M16 6v12M20 8v8', 'M8 12h8'],
  'tab-videos': ['M10 9l5 3-5 3z'],
  'tab-profile': ['M4 21c0-4 4-6 8-6s8 2 8 6'],
};

/**
 * The single icon component. Wraps a lucide glyph, or draws one of the
 * prototype's own paths, always tinted from the shared tokens.
 */
export default function FP_Icon({
  icon: Icon, glyph, size = 16, tone = 'text', className, title,
}: FP_IconProps) {
  const color = TONE[tone];
  if (Icon) return <Icon size={size} color={color} className={className} aria-label={title} />;

  if (glyph === 'logo') {
    return (
      <span className={className} style={{ color, fontSize: size, lineHeight: 1 }} aria-hidden={!title}>
        ◈
      </span>
    );
  }

  const paths = GLYPHS[glyph ?? ''] ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      {glyph === 'tab-videos' && <rect x="3" y="5" width="18" height="14" rx="3" />}
      {glyph === 'tab-profile' && <circle cx="12" cy="8" r="4" />}
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
