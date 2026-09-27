import clsx from 'clsx';
import type { ReactNode } from 'react';
import FP_Breadcrumbs from './FP_Breadcrumbs';

export interface FP_ScreenProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; to?: string }>;
  children?: ReactNode;
  className?: string;
}

/** Page wrapper: background, padding, heading block and an actions slot. */
export default function FP_Screen({
  title, subtitle, actions, breadcrumbs, children, className,
}: FP_ScreenProps) {
  return (
    <main className={clsx('page', className)}>
      {(title || actions || breadcrumbs) && (
        <div className="page__head">
          <div>
            {breadcrumbs ? <FP_Breadcrumbs items={breadcrumbs} /> : null}
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <div className="page__sub">{subtitle}</div> : null}
          </div>
          {actions ? <div className="page__actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </main>
  );
}
