import { resolveMediaUrl } from '@firon/shared';

export type FP_AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface FP_AvatarProps {
  name?: string | null;
  /** Absolute URL or a stored `/uploads/...` path. */
  src?: string | null;
  size?: FP_AvatarSize | number;
  className?: string;
}

const SIZES: Record<FP_AvatarSize, number> = { sm: 24, md: 34, lg: 46, xl: 64 };

function initialsOf(name?: string | null): string {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
}

/** Lime→mint gradient circle with initials, or the user's photo. */
export default function FP_Avatar({ name, src, size = 'md', className }: FP_AvatarProps) {
  const px = typeof size === 'number' ? size : SIZES[size];
  const url = src ? resolveMediaUrl(src) : null;
  return (
    <span
      className={`avatar ${className || ''}`}
      style={{ width: px, height: px, fontSize: Math.round(px * 0.38) }}
      title={name || undefined}
    >
      {url ? <img src={url} alt={name || ''} /> : initialsOf(name)}
    </span>
  );
}
