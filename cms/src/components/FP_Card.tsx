import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

export interface FP_CardProps {
  children?: ReactNode;
  /** Remove the inner padding (for a card that wraps a table). */
  flush?: boolean;
  /** The prototype's lime/teal "today's session" gradient card. */
  accent?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Surface + 1px line + radius 18 (CONTRACT §2). */
export default function FP_Card({ children, flush, accent, className, style }: FP_CardProps) {
  return (
    <section
      className={clsx('card', flush && 'card--flush', accent && 'card--accent', className)}
      style={style}
    >
      {children}
    </section>
  );
}

export interface FP_CardHeadProps {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Bordered header row inside a flush card. */
export function FP_CardHead({ title, sub, actions, children }: FP_CardHeadProps) {
  return (
    <header className="card__head">
      {(title || sub) && (
        <div className="grow">
          {title ? <div className="card__title">{title}</div> : null}
          {sub ? <div className="card__sub">{sub}</div> : null}
        </div>
      )}
      {children}
      {actions ? <div className="row">{actions}</div> : null}
    </header>
  );
}
