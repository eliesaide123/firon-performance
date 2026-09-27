import FP_Skeleton from './FP_Skeleton';

export interface FP_SkeletonCardsProps { count?: number; height?: number }

/** A grid of shimmer cards, for a loading stat row or media grid. */
export default function FP_SkeletonCards({ count = 4, height = 92 }: FP_SkeletonCardsProps) {
  return (
    <div className="grid grid--stats">
      {Array.from({ length: count }, (_, i) => <FP_Skeleton key={i} height={height} radius={18} />)}
    </div>
  );
}
