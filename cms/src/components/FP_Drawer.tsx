import clsx from 'clsx';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import FP_IconButton from './FP_IconButton';
import useFpFocusTrap from './useFpFocusTrap';

export interface FP_DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  sub?: ReactNode;
  wide?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Right-hand side panel for detail views. */
export default function FP_Drawer({
  open, onClose, title, sub, wide, children, footer,
}: FP_DrawerProps) {
  const ref = useFpFocusTrap(open, onClose);
  if (!open) return null;

  return createPortal(
    <>
      <div className="drawer-overlay" onMouseDown={onClose} />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Panel'}
        tabIndex={-1}
        className={clsx('drawer', wide && 'drawer--wide')}
      >
        <div className="drawer__head">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="modal__title">{title}</div>
            {sub ? <div className="card__sub">{sub}</div> : null}
          </div>
          <FP_IconButton icon={X} label="Close" small onPress={onClose} />
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="drawer__foot">{footer}</div> : null}
      </aside>
    </>,
    document.body,
  );
}
