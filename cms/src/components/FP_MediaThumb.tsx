import { FileVideo, Image as ImageIcon } from 'lucide-react';
import { fpGradientCss, resolveMediaUrl, type MediaAsset } from '@firon/shared';

export interface FP_MediaThumbProps {
  asset?: Partial<MediaAsset> | null;
  gradientIndex?: number;
  className?: string;
  /** Render the actual <video> element instead of a gradient placeholder. */
  showVideo?: boolean;
}

/** Thumbnail for a MediaAsset: poster, still, video frame, or gradient fallback. */
export default function FP_MediaThumb({
  asset, gradientIndex = 0, className = 'media-pick__thumb', showVideo,
}: FP_MediaThumbProps) {
  const thumb = asset?.thumbnailUrl ? resolveMediaUrl(asset.thumbnailUrl) : null;
  const src = asset?.url ? resolveMediaUrl(asset.url) : null;
  const isVideo = asset?.kind === 'video';

  if (thumb) return <span className={className}><img src={thumb} alt={asset?.title || ''} /></span>;
  if (!isVideo && src) return <span className={className}><img src={src} alt={asset?.title || ''} /></span>;
  if (isVideo && src && showVideo) {
    return <span className={className}><video src={src} muted preload="metadata" /></span>;
  }
  return (
    <span className={className} style={{ background: fpGradientCss(gradientIndex) }}>
      {isVideo ? <FileVideo size={20} /> : <ImageIcon size={20} />}
    </span>
  );
}
