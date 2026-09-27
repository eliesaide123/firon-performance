import { AlertTriangle, RotateCw } from 'lucide-react';
import { isFPError } from '@firon/shared';
import FP_Button from './FP_Button';

export interface FP_ErrorStateProps {
  /** Any thrown value; FPError adds the code line. */
  error?: unknown;
  onRetry?: () => void;
  title?: string;
}

/** Inline failure block for a query that could not load, with a retry. */
export default function FP_ErrorState({
  error, onRetry, title = 'Could not load this',
}: FP_ErrorStateProps) {
  if (!error) return null;
  const message = isFPError(error) ? error.message : ((error as Error)?.message ?? String(error));
  const code = isFPError(error) ? `${error.code}${error.status ? ` · ${error.status}` : ''}` : null;

  return (
    <div className="errorbox" role="alert">
      <div className="row row--top">
        <AlertTriangle size={17} className="danger" style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div className="grow">
          <div className="errorbox__title">{title}</div>
          <div>{message}</div>
          {code ? <div className="mt2"><code>{code}</code></div> : null}
        </div>
        {onRetry ? (
          <FP_Button variant="secondary" size="sm" icon={RotateCw} onPress={onRetry}>Retry</FP_Button>
        ) : null}
      </div>
    </div>
  );
}
