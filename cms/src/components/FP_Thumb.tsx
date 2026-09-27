import { Heart, Play } from 'lucide-react';
import { fpGradientCss, resolveMediaUrl } from '@firon/shared';
import FP_ProgressBar from './FP_ProgressBar';

export interface FP_ThumbProps {
  /** Poster or still image; falls back to the gradient for `gradientIndex`. */
  src?: string | null;
  gradientIndex?: number;
  title?: string;
  /** '24:10' */
  duration?: string | null;
  /** 0..1 watched fraction — draws the lime bar along the bottom. */
  progress?: number;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  showPlay?: boolean;
  height?: number;
  onPress?: () => void;
}

/** Gradient media tile: play button, duration pill, favourite heart, progress. */
export default function FP_Thumb({
  src, gradientIndex = 0, title, duration, progress = 0, favorite,
  onToggleFavorite, showPlay = true, height = 110, onPress,
}: FP_ThumbProps) {
  const url = src ? resolveMediaUrl(src) : null;
  return (
    <div
      className="thumb"
      style={{ height, background: url ? undefined : fpGradientCss(gradientIndex) }}
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress}
      onKeyDown={onPress ? (e) => { if (e.key === 'Enter') onPress(); } : undefined}
    >
      {url ? <img className="thumb__img" src={url} alt={title || ''} /> : null}
      {showPlay ? <span className="thumb__play"><Play size={16} /></span> : null}
      {duration ? <span className="thumb__dur">{duration}</span> : null}
      {onToggleFavorite ? (
        <button
          type="button"
          className="thumb__fav"
          aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={Boolean(favorite)}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        >
          <Heart size={13} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      ) : null}
      {progress > 0 ? (
        <span className="thumb__progress"><FP_ProgressBar value={progress * 100} /></span>
      ) : null}
    </div>
  );
}
