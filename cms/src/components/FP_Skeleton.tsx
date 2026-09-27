import type { CSSProperties } from 'react';

export interface FP_SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

/** Shimmer placeholder. */
export default function FP_Skeleton({ width = '100%', height = 13, radius = 8, style }: FP_SkeletonProps) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}
