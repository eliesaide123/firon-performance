import clsx from 'clsx';

export type FP_SocketStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface FP_StatusDotProps {
  status: FP_SocketStatus;
  /** Extra detail for the tooltip, e.g. the socket id. */
  detail?: string | null;
}

const LABEL: Record<FP_SocketStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting…',
  disconnected: 'Offline',
  error: 'Socket error',
  idle: 'Idle',
};

/** Socket connection indicator for the topbar. */
export default function FP_StatusDot({ status, detail }: FP_StatusDotProps) {
  const mod = status === 'connected' ? 'on' : status === 'connecting' ? 'pending' : 'off';
  return (
    <span className={clsx('conn', `conn--${mod}`)} title={detail || `socket ${status}`} role="status">
      <span className="conn__dot" />
      {LABEL[status] ?? status}
    </span>
  );
}
