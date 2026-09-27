import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FP_EmptyStateProps {
  title?: ReactNode;
  message?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}

/** Icon + title + message + optional CTA. */
export default function FP_EmptyState({
  title = 'Nothing here yet', message, icon: Icon = Inbox, action,
}: FP_EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon size={20} /></div>
      <div className="empty__title">{title}</div>
      {message ? <div className="empty__sub">{message}</div> : null}
      {action}
    </div>
  );
}
