import FP_Skeleton from './FP_Skeleton';

export interface FP_SkeletonRowsProps { rows?: number; height?: number }

/** A stack of shimmer lines, for a loading list or table. */
export default function FP_SkeletonRows({ rows = 6, height = 14 }: FP_SkeletonRowsProps) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: rows }, (_, i) => (
        <FP_Skeleton key={i} height={height} width={`${100 - (i % 3) * 12}%`} />
      ))}
    </div>
  );
}
