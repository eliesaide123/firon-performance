import FP_Spinner from './FP_Spinner';

export interface FP_LoadingBlockProps { label?: string }

/** Centred spinner + caption, for a whole-page pending state. */
export default function FP_LoadingBlock({ label = 'Loading…' }: FP_LoadingBlockProps) {
  return (
    <div className="spinner-center">
      <FP_Spinner />
      <span>{label}</span>
    </div>
  );
}
